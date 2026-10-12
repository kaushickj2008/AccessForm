// Synthetic corpus only. Accuracy is evaluated by the existing shared form engine.
import {createEngine} from '../shared/engine.js';
export const prompts = [
  {id:'c1',category:'command',say:'next',expected:'next'},
  {id:'c2',category:'command',say:'go back',expected:'back'},
  {id:'c3',category:'command',say:'repeat',expected:'repeat'},
  {id:'c4',category:'command',say:'review',expected:'review'},
  {id:'c5',category:'command',say:'change my email',expected:'change_email'},
  {id:'c6',category:'command',say:'confirm submit',expected:'confirm_submit'},
  {id:'d1',category:'phone',say:'nine zero zero zero zero one two three four five',expected:'9000012345'},
  {id:'d2',category:'phone',say:'nine zero zero zero zero one two three four six',expected:'9000012346'},
  {id:'d3',category:'phone',say:'nine zero zero zero zero one two three four seven',expected:'9000012347'},
  {id:'d4',category:'phone',say:'nine zero zero zero zero one two three four eight',expected:'9000012348'},
  {id:'e1',category:'email',say:'test dot student at example dot com',expected:'test.student@example.com'},
  {id:'e2',category:'email',say:'demo dot one at example dot org',expected:'demo.one@example.org'},
  {id:'e3',category:'email',say:'sample dot two at example dot net',expected:'sample.two@example.net'},
  {id:'e4',category:'email',say:'applicant dot test at example dot com',expected:'applicant.test@example.com'},
  {id:'n1',category:'name',say:'Test Student',expected:'Test Student'},
  {id:'n2',category:'name',say:'Demo Applicant',expected:'Demo Applicant'},
  {id:'n3',category:'name',say:'Sample Person',expected:'Sample Person'},
  {id:'n4',category:'name',say:'Practice Learner',expected:'Practice Learner'},
  {id:'s1',category:'spelling',style:'letters',say:'T E S T',expected:'test'},
  {id:'s2',category:'spelling',style:'phonetic',say:'tango echo sierra tango',expected:'test'}
];
export const samples={name:'Test Student',email:'test.student@example.com',phone:'9000012345',course:'Accessible Computing',reason:'Synthetic demo only'};
export async function score(prompt,text,forms){
  let saves=0;const engine=createEngine({forms,onSubmit:()=>{saves++;}});
  await engine.send({type:'hello',mode:'voice'});
  for(const [field,value]of Object.entries(samples))await engine.send({type:'set_value',field,value});
  const target=prompt.category==='phone'?'phone':prompt.category==='email'?'email':'name';
  await engine.send({type:'action',name:'next',field:target});
  if(prompt.category!=='command')await engine.send({type:'set_value',field:target,value:''});
  if(prompt.category==='spelling')await engine.send({type:'action',name:'spell'});
  if(prompt.expected==='back')await engine.send({type:'action',name:'next',field:'email'});
  if(prompt.expected==='confirm_submit')await engine.send({type:'action',name:'review'});
  const before=engine.getState();
  await engine.send({type:'utterance',text,source:'voice'});
  const after=engine.getState();
  if(prompt.category!=='command')return {correct:after.answers[target]===prompt.expected,actualValue:after.answers[target]??'',expectedValue:prompt.expected};
  const sameAnswers=JSON.stringify(before.answers)===JSON.stringify(after.answers);
  const success={next:after.field?.id==='email'&&sameAnswers,back:after.field?.id==='name'&&sameAnswers,repeat:after.caption===before.caption&&sameAnswers,review:after.phase==='reviewing'&&sameAnswers,change_email:after.field?.id==='email'&&sameAnswers,confirm_submit:after.phase==='submitted'&&saves===1&&sameAnswers};
  return {correct:Boolean(success[prompt.expected]),expectedAction:prompt.expected,observed:{phase:after.phase,field:after.field?.id??null,answersUnchanged:sameAnswers,saves}};
}
export function summarize(rows){
  const groups={};for(const model of ['base.en','small.en'])for(const backend of ['cli','persistent']){
    const subset=rows.filter(r=>r.model===model&&r.backend===backend);if(!subset.length)continue;
    const metric=items=>({correct:items.filter(r=>r.correct).length,total:items.length,accuracy:items.length?items.filter(r=>r.correct).length/items.length:null});
    const times=subset.filter(r=>!r.error).map(r=>r.ms).sort((a,b)=>a-b);
    groups[`${model}/${backend}`]={commands:metric(subset.filter(r=>r.category==='command')),exactFields:metric(subset.filter(r=>r.category!=='command')),byCategory:Object.fromEntries(['phone','email','name','spelling'].map(c=>[c,metric(subset.filter(r=>r.category===c))])),latencyMs:{count:times.length,mean:times.length?times.reduce((a,b)=>a+b,0)/times.length:null,p50:times.length?times[Math.ceil(times.length*.5)-1]:null,p95:times.length?times[Math.ceil(times.length*.95)-1]:null},errors:subset.filter(r=>r.error).length};
  }
  const chosen=groups['small.en/cli'];
  return {groups,gate:chosen?.commands.total===6?(chosen.commands.correct===6?'pass':'choice-required'):'incomplete',gateRule:'Predeclared: all 6 small.en CLI command outcomes must be correct. This tiny single-speaker sample does not establish general accuracy.',comparisonNote:'Same recordings are reused for all model/backend combinations. No raw-WER scoring. Exact field equality is case/punctuation sensitive, with no scoring-only normalization. Persistent cold startup is reported separately per row.'};
}
