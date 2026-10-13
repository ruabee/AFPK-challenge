import {
  readdir,
  readFile,
  writeFile,
  mkdir,
  rename,
  stat,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
const ROOT = fileURLToPath(new URL("../../재무설계_자료/", import.meta.url));
const OUTPUT = fileURLToPath(new URL("./검색인덱스.json", import.meta.url));
const official = [
  "fpsbkorea.org",
  "fpsb.org",
  "nts.go.kr",
  "law.go.kr",
  "nps.or.kr",
  "fss.or.kr",
  "fsc.go.kr",
  "bok.or.kr",
  "kosis.kr",
  "kostat.go.kr",
  "mods.go.kr",
  "hf.go.kr",
  "kinfa.or.kr",
  "kdic.or.kr",
  "klia.or.kr",
  "knia.or.kr",
];
export function validateMetadata(m) {
  for (const k of [
    "title",
    "sourceUrl",
    "publisher",
    "effectiveFrom",
    "effectiveTo",
    "reviewedAt",
    "appliesTo",
  ])
    if (typeof m?.[k] !== "string" || !m[k].trim())
      throw new Error(`메타데이터 ${k} 필요`);
  const u = new URL(m.sourceUrl);
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    !official.some((d) => u.hostname === d || u.hostname.endsWith("." + d))
  )
    throw new Error(
      "검수 대상 공식 도메인이 아닙니다. 공식 출처 목록을 먼저 검토하세요.",
    );
  if (m.publishedAt === null && (!m.publicationNote || typeof m.publicationNote !== "string"))
    throw new Error("발행일 미확인 사유가 필요합니다.");
  for (const k of [...(m.publishedAt === null ? [] : ["publishedAt"]), "effectiveFrom", "effectiveTo", "reviewedAt"])
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(m[k]) ||
      Number.isNaN(Date.parse(m[k])) ||
      new Date(m[k]).toISOString().slice(0, 10) !== m[k]
    )
      throw new Error(`${k} 날짜 형식 오류`);
  if (m.effectiveFrom > m.effectiveTo)
    throw new Error("적용 시작일이 종료일보다 늦습니다.");
  if (m.reviewed !== true)
    throw new Error(
      "자료·시행일·적용대상을 검수한 뒤 reviewed:true로 설정하세요.",
    );
  if (
    m.supersedes !== undefined &&
    (!Array.isArray(m.supersedes) ||
      m.supersedes.some((x) => typeof x !== "string"))
  )
    throw new Error("supersedes는 이전 문서 상대경로 배열이어야 합니다.");
  return Object.fromEntries(
    [
      "title",
      "sourceUrl",
      "publisher",
      "publishedAt",
      "effectiveFrom",
      "effectiveTo",
      "reviewedAt",
      "appliesTo",
      "supersedes",
      "publicationNote",
    ]
      .map((k) => [k, k === "publishedAt" ? m[k] : m[k] ?? (k === "supersedes" ? [] : "")])
      .concat([["reviewed", true]]),
  );
}
export function parseCSV(text) {
  const rows = [];
  let row = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" && !quoted) {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw new Error("CSV 따옴표가 닫히지 않았습니다.");
  if (cell || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}
export async function extract(file) {
  const ext = path.extname(file).toLowerCase();
  if ((await stat(file)).size > 20 * 1024 * 1024)
    throw new Error("20MB 초과 자료는 분리해주세요.");
  if (ext === ".pdf") {
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const task = getDocument({
      data: new Uint8Array(await readFile(file)),
      isEvalSupported: false,
      useSystemFonts: true,
    });
    const doc = await task.promise;
    const pages = [];
    try {
      if (doc.numPages > 500) throw new Error("500쪽 초과 PDF는 분리해주세요.");
      for (let page = 1; page <= doc.numPages; page++) {
        const text = (await (await doc.getPage(page)).getTextContent()).items
          .map((i) => i.str ?? "")
          .join(" ");
        if (text.trim()) pages.push({ page, text });
      }
      if (!pages.length)
        throw new Error(
          "텍스트 없음: 스캔 PDF는 OCR 및 원문 대조가 필요합니다.",
        );
      return pages;
    } finally {
      await doc.destroy();
    }
  }
  const text = (await readFile(file, "utf8")).replace(/^\uFEFF/, "");
  if (ext === ".csv") {
    const rows = parseCSV(text);
    const header = rows.shift() || [];
    return rows.map((row, i) => ({
      page: i + 2,
      text: header.map((name, j) => `${name}: ${row[j] ?? ""}`).join(" | "),
    }));
  }
  return [{ page: 1, text }];
}
export function splitText(text, size = 1200, overlap = 150) {
  const clean = text.replace(/\r\n/g, "\n").trim(),
    parts = [];
  for (let start = 0; start < clean.length; start += size - overlap)
    parts.push(clean.slice(start, start + size));
  return parts;
}
async function files(root) {
  const result = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const f = path.join(root, entry.name);
    if (entry.isDirectory()) result.push(...(await files(f)));
    else if (
      /\.(pdf|md|txt|csv)$/i.test(entry.name) &&
      !/^(자료_안내|자료_수집_안내|README|예시)\.(md|txt)$/i.test(entry.name)
    )
      result.push(f);
  }
  return result.sort();
}
export async function buildIndex({ root = ROOT, output = OUTPUT } = {}) {
  const index = {
    version: 1,
    generatedAt: new Date().toISOString(),
    documents: [],
    chunks: [],
    warnings: [],
  };
  await mkdir(root, { recursive: true });
  for (const file of await files(root)) {
    const documentId = path.relative(root, file).split(path.sep).join("/");
    try {
      const m = validateMetadata(
        JSON.parse(await readFile(file + ".metadata.json", "utf8")),
      );
      const content = await readFile(file);
      const hash = createHash("sha256")
        .update(content)
        .update(JSON.stringify(m))
        .digest("hex");
      const pages = await extract(file);
      let count = 0;
      for (const p of pages)
        for (const text of splitText(p.text)) {
          const id =
            "R" +
            createHash("sha256")
              .update(documentId + hash + p.page + count)
              .digest("hex")
              .slice(0, 12);
          index.chunks.push({
            id,
            documentId,
            hash,
            page: p.page,
            text,
            metadata: m,
          });
          count++;
        }
      index.documents.push({ documentId, hash, chunks: count });
    } catch (e) {
      index.warnings.push(
        `${documentId}: ${e.code === "ENOENT" ? "문서명.metadata.json 파일이 필요합니다." : e.message}`,
      );
    }
  }
  await mkdir(path.dirname(output), { recursive: true });
  const temporary = output + ".tmp";
  await writeFile(temporary, JSON.stringify(index, null, 2));
  await rename(temporary, output);
  return index;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const index = await buildIndex();
  console.log(
    `공식자료 ${index.documents.length}개 / 검색 조각 ${index.chunks.length}개`,
  );
  for (const warning of index.warnings) console.warn(warning);
}
