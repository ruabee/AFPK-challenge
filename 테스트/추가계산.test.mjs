import test from 'node:test';
import assert from 'node:assert/strict';
import {fundingGap,loanPayment} from '../재무설계_계산/생성/재무계산.js';
import {executeTool} from '../AI/재무설계_도구.mjs';
test('생활비 차액과 보유금 초과·누락 처리',()=>{
 assert.equal(fundingGap({requiredAmount:3000000,availableAmount:1800000}).shortage,1200000);
 assert.equal(fundingGap({requiredAmount:100,availableAmount:200}).shortage,0);
 assert.throws(()=>fundingGap({requiredAmount:100}));
});
test('원리금균등 독립 상환잔액 검증 및 영금리',()=>{
 const principal=50000000,months=120,annualRate=4.2;
 const r=loanPayment({principal,months,annualRate});
 let balance=principal;
 for(let i=0;i<months;i++) balance=balance*(1+annualRate/1200)-r.monthlyPayment;
 assert.ok(Math.abs(balance)<100);
 assert.equal(loanPayment({principal:12000000,months:12,annualRate:0}).monthlyPayment,1000000);
 assert.throws(()=>loanPayment({principal,months:0,annualRate}));
 assert.throws(()=>loanPayment({principal,months}));
});
test('실제 도구는 검증된 고객정보 경로만 사용',()=>{
 const ctx={profile:{facts:{'assumptions.gap.amount':{value:3000000,unit:'KRW'},'assumptions.gap.targetAmount':{value:1800000,unit:'KRW'}}},calculations:[]};
 assert.equal(executeTool('calculate_funding_gap',{bindings:{requiredAmount:'assumptions.gap.amount',availableAmount:'assumptions.gap.targetAmount'}},ctx).result.difference,1200000);
 assert.throws(()=>executeTool('calculate_funding_gap',{bindings:{requiredAmount:3000000,availableAmount:1800000}},ctx));
});
test('검증 실패에서도 검증된 차액과 후속질문을 보존',async()=>{
 const {askClaude}=await import('../AI/클로드연결.mjs');
 let n=0;
 const response=content=>new Response(JSON.stringify({content}));
 const result=await askClaude({config:{key:'test',model:'test'},messages:[{role:'user',content:'월 생활비 300만원 연금 180만원'}],indexLoader:async()=>({documents:[],chunks:[]}),fetchImpl:async()=>{
  if(n++===0)return response([{type:'tool_use',id:'a',name:'update_customer_profile',input:{changes:[{path:'assumptions.gap.amount',value:3000000,quote:'월 생활비 300만원',messageIndex:0},{path:'assumptions.gap.targetAmount',value:1800000,quote:'연금 180만원',messageIndex:0}]}},{type:'tool_use',id:'b',name:'calculate_funding_gap',input:{bindings:{requiredAmount:'assumptions.gap.amount',availableAmount:'assumptions.gap.targetAmount'}}}]);
  return response([{type:'text',text:'전체 노후자금은 999억원입니다.'}]);
 }});
 assert.equal(result.body.calculations[0].result.difference,1200000);
 assert.equal(result.body.validation.mode,'advisory');
 assert.ok(result.body.reply.includes('999억원'));
});

test('반복 입력 오류는 고정문 대신 전체 대화를 이용한 확인 질문으로 복구',async()=>{
 const {askClaude}=await import('../AI/클로드연결.mjs');
 const messages=[{role:'user',content:'주식을 예금으로 바꾸자'},{role:'assistant',content:'금액의 기준 시점을 알려주세요.'},{role:'user',content:'뭐를 채우라는거야'}];
 let n=0;
 const result=await askClaude({config:{key:'test',model:'test'},messages,indexLoader:async()=>({documents:[],chunks:[]}),fetchImpl:async(_url,options)=>{
  const request=JSON.parse(options.body);
  if(n++<2) return new Response(JSON.stringify({content:[{type:'tool_use',id:'bad'+n,name:'update_customer_profile',input:{changes:[{path:'totalAssets',value:60000000,quote:'없는 원문',messageIndex:0}]}}]}));
  assert.deepEqual(request.tool_choice,{type:'none'});
  assert.equal(request.messages[2].content,'뭐를 채우라는거야');
  assert.match(JSON.stringify(request.messages.at(-1)),/사용자 잘못이 아니다/);
  return new Response(JSON.stringify({content:[{type:'text',text:'기존 예금은 그대로 두고 주식만 예금으로 바꾸는 뜻인가요, 아니면 예금 총액을 바꾸는 뜻인가요?'}]}));
 }});
 assert.equal(n,3);
 assert.match(result.body.reply,/기존 예금은 그대로/);
 assert.doesNotMatch(result.body.reply,/금액의 기준 시점과 기간/);
 assert.equal(Object.keys(result.body.customerProfile.facts).length,0);
});

test('저장 예고만 최종 답변하면 실제 후속 처리를 요청',async()=>{
 const {askClaude}=await import('../AI/클로드연결.mjs');let n=0;
 const result=await askClaude({config:{key:'test',model:'test'},messages:[{role:'user',content:'매달 50만원 모을 수 있어'}],indexLoader:async()=>({documents:[],chunks:[]}),fetchImpl:async()=>new Response(JSON.stringify({content:[{type:'text',text:n++===0?'네, 먼저 저장하겠습니다.':'말씀하신 월 50만원을 목표 저축액으로 검토하겠습니다. 현재 모은 자금은 얼마인가요?'}]}))});
 assert.equal(n,2);assert.match(result.body.reply,/현재 모은 자금/);assert.equal(result.body.validation.status,'checks_passed');
});
test('원문 금액 재진술은 허용하되 새로운 계산값은 차단',async()=>{
 const {validateAnswer}=await import('../AI/재무설계_검증.mjs');
 const ctx={messages:[{role:'user',content:'매달 50만원 가능해'},{role:'assistant',content:'자산은 9000만원'}]};
 assert.equal(validateAnswer('말씀하신 월 50만 원',ctx).status,'checks_passed');
 assert.equal(validateAnswer('총액 3000만원',ctx).status,'blocked');
 assert.equal(validateAnswer('자산 9000만원',ctx).status,'blocked');
});

test('수익률 없이 원금 목표계산 도구를 실행',async()=>{
 const {savingsPrincipal}=await import('../재무설계_계산/생성/재무계산.js');
 const input={currentAmount:70000000,monthlySaving:500000,months:60,targetAmount:300000000};
 const r=savingsPrincipal(input);assert.equal(r.accumulated,100000000);assert.equal(r.shortage,200000000);assert.equal(r.requiredMonthlySaving,3833333);
 assert.throws(()=>savingsPrincipal({...input,months:undefined}));
 const ctx={profile:{facts:Object.fromEntries(Object.entries(input).map(([k,value])=>[k,{value,unit:k==='months'?'months':'KRW'}]))},calculations:[]};
 assert.deepEqual(executeTool('calculate_savings_principal',{bindings:Object.fromEntries(Object.keys(input).map(k=>[k,k]))},ctx).result,r);
});
test('7천만원 사용자 표현을 7000만원으로 인식',async()=>{
 const {numberInQuote}=await import('../AI/고객정보/고객정보.mjs');
 const {numericClaims}=await import('../AI/재무설계_검증.mjs');
 assert.equal(numberInQuote(70000000,'KRW','7천만원 모았어'),true);
 assert.equal(numericClaims('7천만원')[0].value,70000000);
});
