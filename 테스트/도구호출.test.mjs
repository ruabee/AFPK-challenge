import test from "node:test";
import assert from "node:assert/strict";
import { askClaude } from "../AI/클로드연결.mjs";
import { validateAnswer } from "../AI/재무설계_검증.mjs";
const config = { key: "test-only", model: "test-model" },
  indexLoader = async () => ({ documents: [], chunks: [] });
function tool(id, name, input = {}) {
  return { type: "tool_use", id, name, input };
}
function answer(content, stop_reason = "end_turn") {
  return new Response(JSON.stringify({ content, stop_reason }));
}
test("Claude tool_use → 실제 고객정보·계산 → tool_result → 최종답변", async () => {
  const requests = [];
  let turn = 0;
  const messages = [{ role: "user", content: "월 실수령액은 300만원입니다." }];
  const fetchImpl = async (url, options) => {
    requests.push(JSON.parse(options.body));
    if (turn++ === 0)
      return answer(
        [
          tool("t1", "update_customer_profile", {
            changes: [
              {
                path: "monthlyIncome",
                value: 3000000,
                quote: "월 실수령액은 300만원",
                messageIndex: 0,
              },
            ],
          }),
          tool("t2", "calculate_financial_status"),
        ],
        "tool_use",
      );
    return answer([
      {
        type: "text",
        text: "확인한 월 실수령액은 300만원입니다. 생활비를 알려주세요.",
      },
    ]);
  };
  const result = await askClaude({ config, messages, fetchImpl, indexLoader });
  assert.equal(result.status, 200);
  assert.equal(result.body.customerProfile.facts.monthlyIncome.value, 3000000);
  assert.equal(
    result.body.calculations[0].result.metrics.monthlyIncome,
    3000000,
  );
  assert.equal(result.body.toolCalls, 2);
  assert.equal(requests[1].messages.at(-1).content[0].tool_use_id, "t1");
  assert.equal(requests[1].messages.at(-1).content[1].type, "tool_result");
  assert.equal(requests[1].messages.at(-1).content[1].is_error, false);
  const next = await askClaude({
    config,
    messages: [
      ...messages,
      { role: "assistant", content: result.body.reply },
      { role: "user", content: "계속해주세요" },
    ],
    customerProfile: result.body.customerProfile,
    indexLoader,
    fetchImpl: async (_, options) => {
      assert.match(JSON.parse(options.body).system, /monthlyIncome/);
      return answer([
        {
          type: "text",
          text: "알려주신 소득은 유지하고 지출을 확인하겠습니다.",
        },
      ]);
    },
  });
  assert.equal(next.body.customerProfile.facts.monthlyIncome.value, 3000000);
});
test("알 수 없는 도구·잘못된 수치 근거를 is_error로 반환", async () => {
  let n = 0;
  const r = await askClaude({
    config,
    messages: [{ role: "user", content: "안녕" }],
    indexLoader,
    fetchImpl: async (_, options) => {
      if (!n++)
        return answer(
          [
            tool("bad", "read_secret"),
            tool("bad2", "update_customer_profile", {
              changes: [
                {
                  path: "monthlyIncome",
                  value: 999,
                  quote: "안녕",
                  messageIndex: 0,
                },
              ],
            }),
          ],
          "tool_use",
        );
      assert.ok(
        JSON.parse(options.body)
          .messages.at(-1)
          .content.every((x) => x.is_error),
      );
      return answer([
        { type: "text", text: "확인된 금액이 없습니다. 월 소득을 알려주세요." },
      ]);
    },
  });
  assert.equal(r.body.customerProfile.facts.monthlyIncome, undefined);
});
test("반복 도구 요청에 한도를 두고 고객정보 유지", async () => {
  const r = await askClaude({
    config,
    messages: [{ role: "user", content: "안녕" }],
    indexLoader,
    fetchImpl: async () =>
      answer([tool("again", "get_customer_profile")], "tool_use"),
  });
  assert.equal(r.body.validation.issues[0].code, "tool_limit");
  assert.equal(r.body.toolCalls, 8);
});
test("근거 없는 규정·숫자는 재검토 후에도 불일치하면 차단", async () => {
  let calls = 0;
  const r = await askClaude({
    config,
    messages: [{ role: "user", content: "세금 공제 한도가 얼마인가요?" }],
    indexLoader,
    fetchImpl: async () => {
      calls++;
      return answer([{ type: "text", text: "공제 한도는 999만원입니다." }]);
    },
  });
  assert.equal(calls, 2);
  assert.equal(r.body.validation.status, "blocked");
  assert.ok(!r.body.reply.includes("999"));
});
test("출처 위조·금액 불일치·적용 연도를 대조", () => {
  const profile = { facts: { amount: { value: 3000000 } } };
  assert.equal(
    validateAnswer("순자산은 300만원입니다.", {
      profile,
      calculations: [{ result: { metrics: { netWorth: 2000000 } } }],
      asOf: "2026-10-08",
    }).status,
    "blocked",
  );
  assert.equal(
    validateAnswer("[R123456abcdef]", {
      profile,
      sources: [],
      asOf: "2026-10-08",
    }).status,
    "blocked",
  );
  assert.equal(
    validateAnswer("확인 결과입니다.", {
      profile,
      sources: [
        {
          metadata: { effectiveFrom: "2025-01-01", effectiveTo: "2025-12-31" },
        },
      ],
      asOf: "2026-10-08",
    }).status,
    "blocked",
  );
});
test("공식 근거가 없으면 부족함을 명시한 설명 허용", () => {
  const r = validateAnswer("적용 연도에 맞는 공식 자료 확인이 필요합니다.", {
    profile: { facts: {} },
    question: "세금 규정",
    sources: [],
    asOf: "2026-10-08",
  });
  assert.equal(r.status, "needs_review");
});
test("과거 검색 기준일 보존·잘못된 출처 형식·금액과 비율의 혼동 차단", () => {
  const source = {
    id: "R123456abcdef",
    searchedAsOf: "2025-06-01",
    text: "자료 설명",
    metadata: { effectiveFrom: "2025-01-01", effectiveTo: "2025-12-31" },
  };
  assert.equal(
    validateAnswer("과거 자료 [R123456abcdef]", {
      sources: [source],
      asOf: "2026-10-08",
    }).status,
    "checks_passed",
  );
  assert.equal(
    validateAnswer("[R가짜출처]", { sources: [], asOf: "2026-10-08" }).status,
    "blocked",
  );
  assert.equal(
    validateAnswer("5원입니다.", {
      profile: { facts: { rate: { value: 5, unit: "percent" } } },
    }).status,
    "blocked",
  );
  assert.equal(
    validateAnswer("5%입니다.", {
      profile: { facts: { rate: { value: 5, unit: "percent" } } },
    }).status,
    "checks_passed",
  );
  assert.equal(
    validateAnswer("월 저축률 16.67%입니다.", {
      calculations: [{ result: { metrics: { savingsRate: 100 / 6 } } }],
    }).status,
    "checks_passed",
  );
  assert.equal(
    validateAnswer("규정상 가능합니다.", { question: "알려줘", sources: [] })
      .status,
    "blocked",
  );
});
test("검증된 월환산 지출·반올림 비율·세금 제외 설명은 답변 가능", () => {
  const result = {
    metrics: { monthlyIrregularExpenses: 200000, savingsRate: 100 / 6 },
  };
  assert.equal(
    validateAnswer(
      "월 비정기지출은 20만원, 저축률은 16.7%입니다. 세금·수수료는 미반영입니다.",
      { calculations: [{ result }] },
    ).status,
    "checks_passed",
  );
  assert.equal(
    validateAnswer("저축률은 16.8%입니다.", { calculations: [{ result }] })
      .status,
    "blocked",
  );
});
test("공식 문서 검색 tool_result와 최종 출처·기준일 연결", async () => {
  const id = "R123456abcdef",
    source = {
      id,
      documentId: "test.md",
      page: 1,
      text: "테스트 연금 규정은 예시 자료를 검토합니다.",
      metadata: {
        reviewed: true,
        title: "연금 검토 테스트",
        sourceUrl: "https://www.nps.or.kr/",
        publisher: "테스트",
        effectiveFrom: "2025-01-01",
        effectiveTo: "2099-12-31",
        reviewedAt: "2026-01-01",
        appliesTo: "테스트 전용",
      },
    };
  let n = 0;
  const r = await askClaude({
    config,
    messages: [{ role: "user", content: "연금 규정 자료를 찾아주세요" }],
    indexLoader: async () => ({ documents: [{}], chunks: [source] }),
    fetchImpl: async (_, options) => {
      if (!n++)
        return answer(
          [
            tool("search", "search_official_documents", {
              query: "연금 규정",
              asOf: "2025-06-01",
            }),
          ],
          "tool_use",
        );
      const result = JSON.parse(
        JSON.parse(options.body).messages.at(-1).content[0].content,
      );
      assert.equal(result.asOf, "2025-06-01");
      assert.equal(result.results[0].id, id);
      return answer([
        {
          type: "text",
          text: "자료를 검토할 수 있습니다. [R123456abcdef] 적용 대상은 테스트 전용이며 실제 금융규정으로 사용할 수 없습니다.",
        },
      ]);
    },
  });
  assert.equal(r.body.sources[0].url, "https://www.nps.or.kr/");
  assert.equal(r.body.validation.status, "checks_passed");
});
test("Markdown 표의 지표 불일치·저축 전후 정의 혼동 차단", () => {
  const context = {
    calculations: [
      {
        result: {
          metrics: {
            netWorth: 25000000,
            monthlySurplus: 1000000,
            afterSavings: 500000,
          },
        },
      },
    ],
    profile: { facts: { asset: { value: 30000000, unit: "KRW" } } },
  };
  assert.equal(
    validateAnswer("| **순자산** | 3000만원 |", context).status,
    "blocked",
  );
  assert.equal(
    validateAnswer(
      "월 잉여현금흐름 100만원. 저축 후 남은 현금 기준입니다.",
      context,
    ).status,
    "blocked",
  );
  assert.equal(
    validateAnswer(
      "월 잉여현금흐름은 100만원, 저축 후 잔액은 50만원입니다.",
      context,
    ).status,
    "checks_passed",
  );
});
test("기존 시뮬레이터 만원 문맥은 도구 검증과 최종 검증 모두 유지", async () => {
  let n = 0;
  const text =
    "초기 투자금 100만원, 월 적립 10만원, 예상 평가액 220만원, 가정 수익률 0%입니다.";
  const r = await askClaude({
    config,
    messages: [{ role: "user", content: "이 투자 조건을 검토해주세요." }],
    simulation: {
      initial: 100,
      monthly: 10,
      value: 220,
      principal: 220,
      rate: 0,
      years: 1,
    },
    indexLoader,
    fetchImpl: async (_, options) => {
      if (!n++)
        return answer(
          [tool("check", "validate_financial_plan", { answer: text })],
          "tool_use",
        );
      const result = JSON.parse(
        JSON.parse(options.body).messages.at(-1).content[0].content,
      );
      assert.equal(result.status, "checks_passed");
      return answer([{ type: "text", text }]);
    },
  });
  assert.equal(r.body.validation.status, "checks_passed");
  assert.equal(r.body.reply, text);
});

test("설명이 섞인 비표준 출처 인용을 누락 없이 차단", () => {
 const r=validateAnswer('안내 [R123456789abc, 국민연금공단 기준]',{profile:{facts:{}},sources:[]});
 assert.ok(r.issues.some(x=>x.code==='malformed_source' && x.blocking));
});
test("검색만 되고 답변에 인용되지 않은 자료는 표시하지 않음",async()=>{
 const meta={title:'테스트',publisher:'테스트',sourceUrl:'https://www.nps.or.kr/test',effectiveFrom:'2026-01-01',effectiveTo:'2099-12-31',reviewed:true};
 const result=await askClaude({config,messages:[{role:'user',content:'은퇴 연금 상담'}],indexLoader:async()=>({documents:[{}],chunks:[{id:'R123456789abc',documentId:'test',text:'은퇴 연금 상담',metadata:meta}]}),fetchImpl:async()=>answer([{type:'text',text:'원하시는 상담 목표를 알려주세요.'}])});
 assert.equal(result.body.sources.length,0);
});
