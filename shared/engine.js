/** Pure shared engine. field is null when idle/submitted or the form has no fields. */
export function createEngine({forms={},onMessage=()=>{},onSubmit=()=>{}}={}) {
  let formId=Object.keys(forms)[0]||'scholarship', phase='idle', index=0, answers={}, errors={}, listening=false, caption='', history=[], spelling=false, submitting=false;
  const form=()=>forms[formId];
  const field=()=>form()?.fields[index]||null;
  const snapshot=()=>({formId,phase,index,answers:{...answers},errors:{...errors},spelling});
  const remember=()=>history.push(snapshot());
  const getState=()=>({type:'state',formId,phase,index,total:form()?.fields.length||0,field:phase==='idle'||phase==='submitted'?null:field(),answers:{...answers},errors:{...errors},caption,listening});
  function emit(text,speak=true){caption=text;onMessage(getState());if(speak&&text)onMessage({type:'speak',text,id:`speech-${++emit.sequence}`});}
  emit.sequence=0;
  function validate(f,v){v=String(v??'').trim();if(f.required&&!v)return `Please enter ${f.label.toLowerCase()}.`;if(!v)return '';if(f.kind==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))return 'Enter an email address with an @ sign and a domain, such as test.student@example.com.';if(f.kind==='tel'&&!/^\d{10}$/.test(v.replace(/[\s()-]/g,'')))return 'Enter a 10-digit synthetic phone number.';if(f.options&&!f.options.map(x=>typeof x==='string'?x:x.value).includes(v))return `Choose ${f.options.map(x=>typeof x==='string'?x:x.value).join(' or ')}.`;return '';}
  function prompt(){const f=field();emit(f?`${f.label}. ${f.hint||''}${answers[f.id]?` Current answer: ${answers[f.id]}.`:''}`:'Load a form to start.');}
  function check(){errors={};for(const f of form()?.fields||[]){const error=validate(f,answers[f.id]);if(error)errors[f.id]=error;}return !Object.keys(errors).length;}
  function review(){if(!check()){index=form().fields.findIndex(f=>errors[f.id]);phase='asking';emit(errors[field().id]);return;}phase='reviewing';spelling=false;emit(`Review your answers. ${form().fields.map(f=>`${f.label}: ${answers[f.id]||'Not provided'}`).join('. ')}. Say confirm submit to save this synthetic application, or change a field.`);}
  function resolveField(value){const normalized=String(value||'').toLowerCase().trim();return form()?.fields.find(f=>[f.id.toLowerCase(),f.label.toLowerCase(),f.label.toLowerCase().replace(/ address| number/g,'')].includes(normalized));}
  const readChars=v=>Array.from(v).map(c=>c===' '?'space':c==='@'?'at sign':c==='.'?'dot':c).join(', ');
  const charWords={at:'@',dot:'.',period:'.',dash:'-',hyphen:'-',underscore:'_',space:' ',zero:'0',one:'1',two:'2',three:'3',four:'4',five:'5',six:'6',seven:'7',eight:'8',nine:'9'};
  function spellTokens(text){return text.toLowerCase().replace(/\b([a-z])\s+as\s+in\s+[a-z]+\b/g,'$1').split(/[ ,]+/).filter(Boolean).map(t=>charWords[t]??(/^[a-z0-9@._-]$/.test(t)?t:null));}
  function spelled(text){const tokens=spellTokens(text);return tokens.some(t=>t===null)?null:tokens.join('');}
  function setValue(id,value){const f=resolveField(id);if(!f||phase==='submitted')return emit('Choose a field before entering an answer.');remember();answers[f.id]=String(value);delete errors[f.id];phase='asking';index=form().fields.indexOf(f);emit(spelling?`${f.label}: ${readChars(answers[f.id])}. Say next when correct, or change a numbered character.`:`${f.label}: ${answers[f.id]}. Say next, or change your answer.`);}
  async function action(msg){const name=msg.name;
    if(name==='load_form'){if(!forms[msg.formId])return emit('That form is not available.');formId=msg.formId;phase='asking';index=0;answers={};errors={};history=[];spelling=false;return prompt();}
    if(name==='reset'){phase='asking';index=0;answers={};errors={};history=[];spelling=false;return prompt();}
    if(name==='pause'){listening=false;return emit('Listening paused. Use the Resume button or keyboard to resume.');}
    if(name==='resume'){listening=true;return emit('Listening resumed.');}
    if(name==='undo'){const previous=history.pop();if(!previous)return emit('There is nothing to undo.');({formId,phase,index,answers,errors,spelling}=previous);return emit(`Undone. ${field()?.label||''}: ${answers[field()?.id]||'No answer'}.`);}
    if(phase==='submitted')return emit('Submitted (synthetic data). Reset to start again.');
    if(msg.field){const f=resolveField(msg.field);if(!f)return emit('That field was not found.');index=form().fields.indexOf(f);phase='asking';}
    if(name==='repeat')return spelling?emit(readChars(answers[field()?.id]||'')):prompt();
    if(name==='spell'){spelling=true;return emit(`Spell ${field()?.label||'your answer'} using letters or a as in apple. Each spoken answer replaces the full spelling; use change a numbered character for corrections. ${answers[field()?.id]?readChars(answers[field().id]):''}`);}
    if(name==='review')return review();
    if(name==='back'){remember();index=Math.max(0,index-1);phase='asking';spelling=false;return prompt();}
    if(name==='next'){if(msg.field)return prompt();const f=field();if(!f)return prompt();const error=validate(f,answers[f.id]);if(error){errors[f.id]=error;return emit(error);}remember();spelling=false;if(index<form().fields.length-1){index++;phase='asking';return prompt();}return review();}
    if(name==='confirm_submit'){if(submitting)return;if(phase!=='reviewing'&&phase!=='confirming')return review();if(!check())return review();phase='confirming';submitting=true;emit('Saving your confirmed synthetic application.');try{await onSubmit({formId,answers:{...answers},synthetic:true});phase='submitted';listening=false;history=[];emit('Submitted (synthetic data). Your confirmed application has been saved.');}catch{phase='reviewing';emit('The application could not be saved. Your answers are still here. Please try confirm submit again.');}finally{submitting=false;}return;}
    emit('That action is not available.');
  }
  function utterance(text,source){text=String(text).trim();const command=text.toLowerCase().replace(/[.!?]+$/,'').trim();const commands={next:'next',back:'back','go back':'back',repeat:'repeat',review:'review',undo:'undo',pause:'pause','pause listening':'pause',resume:'resume','resume listening':'resume','confirm submit':'confirm_submit',spell:'spell','spell mode':'spell'};if(source==='voice'&&({nex:'next','go bak':'back',repeet:'repeat',revew:'review'})[command])return action({name:({nex:'next','go bak':'back',repeet:'repeat',revew:'review'})[command]});if(commands[command])return action({name:commands[command]});
    const correction=command.match(/^change (?:the )?(\d+|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)(?:st|nd|rd|th)? (?:letter|character|digit) to (.+)$/);if(correction){const ord=['first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth'];const pos=/^\d+$/.test(correction[1])?Number(correction[1])-1:ord.indexOf(correction[1]);const chars=Array.from(answers[field()?.id]||'');const replacement=spelled(correction[2]);if(pos<0||pos>=chars.length||replacement===null||replacement.length!==1)return emit('Choose an existing character position and one replacement character.');chars[pos]=replacement;spelling=true;return setValue(field().id,chars.join(''));}
    const change=command.match(/^change (?:my )?(.+)$/);if(change){const f=resolveField(change[1]);return f?action({name:'next',field:f.id}):emit('Say change my followed by the field name, such as email.');}const value=spelling?spelled(text):text;if(value===null)return emit('I could not interpret that spelling. Say individual letters, digits, or a as in apple. Your answer has not changed.');return setValue(field()?.id,value);
  }
  function send(msg){if(!msg||typeof msg!=='object')return;if(submitting)return;if(msg.type==='hello'){listening=msg.mode==='voice';if(phase==='idle')phase='asking';return prompt();}if(msg.type==='utterance')return utterance(msg.text,msg.source);if(msg.type==='set_value')return setValue(msg.field,msg.value);if(msg.type==='action')return action(msg);}
  return {send,getState};
}
