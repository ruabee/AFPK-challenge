import { readFile } from "node:fs/promises";
export const INDEX = new URL("./검색인덱스.json", import.meta.url);
export function tokens(text) {
  const words =
    String(text)
      .normalize("NFKC")
      .toLowerCase()
      .match(/[가-힣a-z0-9]+/g) || [];
  return [
    ...new Set(
      words.flatMap((w) =>
        /^[가-힣]+$/.test(w) && w.length > 2
          ? [
              w,
              ...Array.from({ length: w.length - 1 }, (_, i) =>
                w.slice(i, i + 2),
              ),
            ]
          : [w],
      ),
    ),
  ];
}

// 일상 표현과 공식 용어가 다른 경우를 위한 보수적인 동의어 사전.
// 검색어만 확장하며, 확장어 자체를 답변의 금융 사실로 취급하지 않는다.
const QUERY_ALIASES = [
  [/연금.{0,8}(미리|일찍|조기).{0,6}(받|타|수령)|조기.{0,6}연금/iu, ["조기노령연금", "조기연금", "조기 수령", "수급 개시 연령"]],
  [/연금.{0,8}(늦게|미뤄|연기).{0,6}(받|수령)|연기.{0,4}연금/iu, ["연기연금", "연금 지급 연기", "수급 개시 연령"]],
  [/대출.{0,12}(매달|매월|똑같|같은 금액|균등).{0,8}(갚|상환)|원리금균등/iu, ["원리금균등분할상환", "원리금균등상환", "원금균등분할상환", "대출 상환 방식"]],
  [/연금.{0,8}(깨|깰|해지|중도인출)|중도해지.{0,5}연금/iu, ["연금외수령", "중도해지", "연금저축 해지", "퇴직연금 중도인출", "인출 과세"]],
  [/(적금|예금).{0,8}(깨|해지|중도)|중도해지.{0,5}(이자|금리)/iu, ["중도해지이율", "중도해지이자", "약정이자", "만기 전 해지"]],
  [/이자.{0,8}배당|배당.{0,8}이자|금융소득.{0,8}(세금|과세)/iu, ["금융소득종합과세", "이자소득", "배당소득", "종합과세"]],
  [/(월급|월 소득).{0,8}(세금|세후)|연말정산/iu, ["근로소득", "소득세", "소득공제", "세액공제"]],
  [/(집|주택|아파트).{0,8}(대출|살|구입)|주택담보대출/iu, ["주택담보대출", "대출 자격", "대출 한도", "상환 방식"]],
  [/(보험료|보험).{0,8}(점검|비싸|줄|해지)/iu, ["보장성보험", "보험료 납입", "보장 범위", "해지환급금"]],
];

export function expandQuery(query) {
  const aliases = QUERY_ALIASES
    .filter(([pattern]) => pattern.test(query))
    .flatMap(([, terms]) => terms);
  return [...new Set(aliases)];
}
export async function loadIndex(path = INDEX) {
  try {
    const data = JSON.parse(await readFile(path, "utf8"));
    if (data.version !== 1 || !Array.isArray(data.chunks))
      throw new Error("invalid");
    return data;
  } catch {
    return {
      version: 1,
      chunks: [],
      documents: [],
      warnings: ["검색 인덱스가 없습니다. npm run rag:index를 실행해주세요."],
    };
  }
}
export function searchIndex(
  index,
  query,
  {
    asOf = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }),
    limit = 5,
  } = {},
) {
  if (typeof query !== "string" || !query.trim() || query.length > 2000)
    throw new Error("검색어는 1~2000자로 입력해주세요.");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(asOf) ||
    Number.isNaN(Date.parse(asOf)) ||
    new Date(asOf).toISOString().slice(0, 10) !== asOf
  )
    throw new Error("검색 기준일은 YYYY-MM-DD로 입력해주세요.");
  const aliases = expandQuery(query);
  const original = tokens(query);
  const expanded = tokens(aliases.join(" "));
  const normalizePhrase = (value) =>
    String(value).normalize("NFKC").toLowerCase().replace(/[\s·ㆍ]/g, "");
  const q = [...new Set([...original, ...expanded])],
    candidates = index.chunks.filter(
      (c) =>
        c.metadata.reviewed === true &&
        c.metadata.effectiveFrom <= asOf &&
        c.metadata.effectiveTo >= asOf,
    );
  const replaced = new Set(
    candidates.flatMap((c) => c.metadata.supersedes || []),
  );
  const eligible = candidates.filter((c) => !replaced.has(c.documentId));
  const documents = eligible.map((c) => ({
    c,
    titleWords: tokens(c.metadata.title + " " + c.documentId.split("/")[0]),
    scopeWords: tokens(c.metadata.appliesTo || ""),
    words: tokens(c.text),
  }));
  const documentFrequency = new Map();
  for (const document of documents)
    for (const term of document.words)
      documentFrequency.set(term, (documentFrequency.get(term) || 0) + 1);
  const scored = documents
    .map(({ c, titleWords, scopeWords, words }) => {
      const originalHits = original.filter((t) => words.includes(t));
      const normalizedBody = normalizePhrase(c.text);
      const bodyWords = c.text
        .normalize("NFKC")
        .toLowerCase()
        .match(/[가-힣a-z0-9]+/g) || [];
      const particles = new Set([
        "은", "는", "이", "가", "을", "를", "에", "도", "만", "의", "와", "과", "로", "으로", "에서", "에게", "까지", "부터",
      ]);
      const expandedHits = aliases.filter((term) => {
        if (/\s/.test(term))
          return normalizedBody.includes(normalizePhrase(term));
        return bodyWords.some((word) => {
          if (word === term) return true;
          const suffix = word.startsWith(term) ? word.slice(term.length) : "";
          return particles.has(suffix);
        });
      });
      const common = [...new Set([...originalHits, ...expandedHits])];
      const weightedHits = (terms, weight) =>
        terms.reduce((sum, term) => {
          if (!words.includes(term)) return sum;
          const idf = Math.log(
            1 +
              documents.length /
                (1 + (documentFrequency.get(term) || 0)),
          );
          return sum + idf * weight;
        }, 0);
      const titleHits = [...new Set([...original, ...expanded])].filter(
        (t) => titleWords.includes(t),
      ).length;
      const scopeHits = [...new Set([...original, ...expanded])].filter(
        (t) => scopeWords.includes(t),
      ).length;
      const score =
        weightedHits(original, 1.4) +
      weightedHits(expanded, 0.8) +
        titleHits * 2.5 +
        scopeHits * 0.7;
      return {
        ...c,
        searchedAsOf: asOf,
        score: score / (1 + words.length / 1800),
        matched: common.length + titleHits + scopeHits,
        bodyMatches: common.length,
        originalMatches: originalHits.length,
        expandedMatches: expandedHits.length,
      };
    })
    .filter((c) =>
      aliases.length
        ? c.originalMatches > 0 && c.expandedMatches > 0
        : original.length <= 1
          ? c.originalMatches > 0
          : c.originalMatches >= 2,
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, Math.min(5, limit)));
  return {
    asOf,
    expandedQueries: aliases,
    results: scored,
    coverage: scored.length
      ? "검토 대상 자료 있음"
      : "적용 시점과 검색어가 일치하는 공식 근거 없음",
    limitations:
      "메타데이터는 자료 등록자가 검수합니다. 검색 적합성과 개인 적용 조건은 별도 확인해야 합니다.",
  };
}
