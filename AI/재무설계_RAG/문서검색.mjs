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
  const q = tokens(query),
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
    words: tokens(c.metadata.title + " " + c.text),
  }));
  const scored = documents
    .map(({ c, words }) => {
      const common = q.filter((t) => words.includes(t));
      const score =
        common.reduce(
          (n, t) =>
            n +
            Math.log(
              1 +
                documents.length /
                  (1 + documents.filter((d) => d.words.includes(t)).length),
            ),
          0,
        ) /
        (1 + words.length / 1500);
      return { ...c, searchedAsOf: asOf, score, matched: common.length };
    })
    .filter((c) => c.matched >= Math.min(2, q.length))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, Math.min(5, limit)));
  return {
    asOf,
    results: scored,
    coverage: scored.length
      ? "검토 대상 자료 있음"
      : "적용 시점과 검색어가 일치하는 공식 근거 없음",
    limitations:
      "메타데이터는 자료 등록자가 검수합니다. 검색 적합성과 개인 적용 조건은 별도 확인해야 합니다.",
  };
}
