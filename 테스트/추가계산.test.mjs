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
 assert.ok(result.body.reply.includes('1,200,000원'));
 assert.ok(result.body.reply.includes('연금이 시작되는 나이'));
 assert.ok(!result.body.reply.includes('999억원'));
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
