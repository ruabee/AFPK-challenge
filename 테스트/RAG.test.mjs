import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, unlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  buildIndex,
  parseCSV,
  extract,
} from "../AI/재무설계_RAG/인덱스생성.mjs";
import { searchIndex } from "../AI/재무설계_RAG/문서검색.mjs";
const metadata = {
  title: "테스트 전용 가상 공식자료",
  sourceUrl: "https://www.nts.go.kr/test-fixture",
  publisher: "테스트",
  publishedAt: "2026-01-01",
  effectiveFrom: "2026-01-01",
  effectiveTo: "2026-12-31",
  reviewedAt: "2026-10-08",
  appliesTo: "테스트 데이터만",
  reviewed: true,
};
test("문서 로딩·분할·검색·날짜 제외·내용 변경 및 삭제 갱신", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "askyes-rag-"));
  try {
    const f = path.join(dir, "근거.txt"),
      out = path.join(dir, "index.json");
    await writeFile(f, "테스트 전용 연금 납입 조건. ".repeat(150));
    await writeFile(f + ".metadata.json", JSON.stringify(metadata));
    const first = await buildIndex({ root: dir, output: out });
    assert.ok(first.chunks.length > 1);
    assert.ok(
      searchIndex(first, "연금 납입 조건", { asOf: "2026-10-08" }).results
        .length,
    );
    assert.equal(
      searchIndex(first, "연금 납입 조건", { asOf: "2027-01-01" }).results
        .length,
      0,
    );
    await writeFile(f, "주택 자금 목표");
    const second = await buildIndex({ root: dir, output: out });
    assert.notEqual(second.documents[0].hash, first.documents[0].hash);
    assert.equal(searchIndex(second, "연금 납입 조건").results.length, 0);
    await unlink(f);
    assert.equal(
      (await buildIndex({ root: dir, output: out })).chunks.length,
      0,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("검수 안 된 문서·안내문·비공식 출처는 색인하지 않음", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "askyes-rag-"));
  try {
    for (const [name, m] of [
      ["미검수.txt", { ...metadata, reviewed: false }],
      ["블로그.txt", { ...metadata, sourceUrl: "https://example.com" }],
      ["자료_안내.md", metadata],
    ]) {
      const f = path.join(dir, name);
      await writeFile(f, "금융 정보");
      await writeFile(f + ".metadata.json", JSON.stringify(m));
    }
    const index = await buildIndex({
      root: dir,
      output: path.join(dir, "index.json"),
    });
    assert.equal(index.chunks.length, 0);
    assert.equal(index.warnings.length, 2);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("CSV 인용 쉼표·줄바꿈·한글 추출", () => {
  assert.deepEqual(parseCSV('항목,내용\n연금,"가,나\n다"'), [
    ["항목", "내용"],
    ["연금", "가,나\n다"],
  ]);
  assert.throws(() => parseCSV('a,"unfinished'));
});
function pdf(text) {
  const content = `BT /F1 12 Tf 50 100 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(body));
    body += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(body);
  body +=
    `xref\n0 6\n0000000000 65535 f \n` +
    offsets
      .slice(1)
      .map((n) => String(n).padStart(10, "0") + " 00000 n \n")
      .join("") +
    `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return body;
}
test("실제 PDF.js로 PDF 페이지 텍스트 추출 및 빈 PDF 감지", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "askyes-pdf-"));
  try {
    const f = path.join(dir, "fixture.pdf");
    await writeFile(f, pdf("Pension test only"));
    const pages = await extract(f);
    assert.equal(pages[0].page, 1);
    assert.match(pages[0].text, /Pension test only/);
    await writeFile(f, pdf(""));
    await assert.rejects(extract(f), /OCR/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("발행일 미상은 사유 필수이며 검색 허용 기간을 유지", async () => {
  const { validateMetadata } = await import('../AI/재무설계_RAG/인덱스생성.mjs');
  assert.throws(() => validateMetadata({...metadata, publishedAt:null}));
  const m = validateMetadata({...metadata, publishedAt:null, publicationNote:'공식 웹페이지에 발행일 미표시'});
  assert.equal(m.publishedAt,null);
  assert.equal(m.effectiveFrom,metadata.effectiveFrom);
  assert.throws(() => validateMetadata({...metadata,publishedAt:'2026-02-30'}));
});
