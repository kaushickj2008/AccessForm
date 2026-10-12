import {InProcessTransport, WebSocketTransport} from './shared/transports.js';
import {LocalServerBackend, EspeakServerTTS, BrowserWasmBackend, getRiskyVoiceAction} from './voice/index.js';

const $ = id => document.getElementById(id);
let forms = {}, transport, state, mode = 'keyboard', local = false, localStatus = {}, started = false;
let pendingVoiceAction=null, holdSource=null;
let voice, tts, voiceActive = false, speaking = false, latestSubmission;
let scanTimer, scanIndex = 0, scanPaused = false, lastField;
const sample = {name:'Test Student', email:'test.student@example.com', phone:'9000012345', course:'Accessible Computing', reason:'Synthetic demo only.', accountType:'savings'};
const baseScanActions = [['Enter characters','characters'],['Delete last character','delete_character'],['Next field','next'],['Back','back'],['Repeat prompt','repeat'],['Review answers','review'],['Undo','undo'],['Spell & verify','spell'],['Confirm submit','confirm_submit']];
let scanActions = baseScanActions;
function fail(error) { $('app-error').hidden = false; $('app-error').textContent = String(error?.message || error); }
function send(message) { try { transport.send(message); } catch(error) { fail(error); } }
function action(name, extra={}) { if(['reset','load_form'].includes(name)){tts?.cancel?.();stopVoice();}send({type:'action', name, ...extra}); }
function saveNext() {
  if (!state?.field || state.phase === 'submitted') return;
  const value = state.field.kind === 'select' ? $('answer-select').value : $('answer-input').value;
  send({type:'set_value',field:state.field.id,value}); action('next');
}
function stopVoice(){cancelHold();pendingVoiceAction=null;$('voice-confirmation').hidden=true;$('capture-controls').hidden=true;if(voiceActive){voice?.stop();voiceActive=false;$('enable-voice').hidden=false;$('pause-voice').hidden=true;$('voice-status').textContent='Microphone stopped. Use Enable voice to start again.';}}
function updateConnection() {
  $('connection').textContent = navigator.onLine ? (local ? 'Local · device only' : 'Web demo · online') : 'Offline · device only';
}
function setMode(next) {
  tts?.cancel?.();
  mode = next; $('mode-select').value = next;
  $('voice-panel').hidden = next !== 'voice'; $('switch-panel').hidden = next !== 'switch';
  if (next !== 'voice') stopVoice();
  if (next === 'switch') { scanPaused = false; $('scan-toggle').textContent = 'Pause scanning'; $('scan-toggle').setAttribute('aria-pressed','true'); startScan(); } else clearInterval(scanTimer);
  if(started) send({type:'hello',mode});
}
function render(message) {
  if (message.type === 'speak') { if(voiceActive && tts) {tts.cancel();tts.speak(message.text).catch(error=>{ if(error.name==='AbortError')return; $('voice-status').textContent = `Speech output unavailable: ${error.message}. Read the captions below.`; });} return; }
  if (message.type !== 'state') return;
  state=message;
  const form=forms[state.formId] || Object.values(forms)[0];
  const isReview=['reviewing','confirming'].includes(state.phase), submitted=state.phase==='submitted';
  $('form-title').textContent=form.title; $('form-select').value=state.formId;
  $('progress-label').textContent=submitted ? 'Application complete' : isReview ? 'Your final review' : `${Math.min(state.index+1,state.total)} of ${state.total} questions`;
  $('progress-bar').style.width=`${submitted?100:Math.round(Object.keys(state.answers).filter(k=>String(state.answers[k]??'').trim()).length / Math.max(state.total,1)*100)}%`;
  $('step-label').textContent=submitted?'ALL DONE':isReview?'CHECK BEFORE YOU CONFIRM':`QUESTION ${String(state.index+1).padStart(2,'0')} / ${String(state.total).padStart(2,'0')}`;
  $('question-kicker').textContent=submitted?'SAVED ON THIS DEVICE':isReview?'YOU HAVE THE FINAL SAY':'ONE STEP AT A TIME';
  $('question-label').textContent=submitted?'Submitted (synthetic data)':isReview?'Let’s check your answers.':state.field?.label || 'Ready when you are.';
  $('field-hint').textContent=submitted?'This is a demonstration. No real application has been sent.':isReview?'Review every answer. You can change any field before explicitly confirming.':state.field?.hint || '';
  $('answer-area').hidden=isReview||submitted; $('review-area').hidden=!isReview; $('submitted-area').hidden=!submitted;
  if(state.field && !isReview && !submitted) {
    const select=state.field.kind==='select';
    $('answer-input').hidden=select; $('answer-select').hidden=!select;
    $('answer-label').textContent=state.field.label;$('answer-select').setAttribute('aria-label',state.field.label);$('answer-select').setAttribute('aria-invalid',String(Boolean(state.errors?.[state.field.id])));
    $('answer-input').type='text'; $('answer-input').inputMode=state.field.kind==='email'?'email':state.field.kind==='tel'?'tel':'text';
    if(select){ $('answer-select').replaceChildren(...[new Option('Choose an option',''),...(form.fields.find(f=>f.id===state.field.id)?.options||[]).map(o=>new Option(typeof o==='string'?o:o.label,typeof o==='string'?o:o.value))]);$('answer-select').value=state.answers[state.field.id]||''; }
    else $('answer-input').value=state.answers[state.field.id]||'';
    $('field-error').textContent=state.errors?.[state.field.id] || '';
    $('answer-input').setAttribute('aria-invalid',String(Boolean(state.errors?.[state.field.id])));
    $('answer-select').setAttribute('aria-invalid',String(Boolean(state.errors?.[state.field.id])));
    $('save-next').innerHTML=state.index===state.total-1?'Save & review <span aria-hidden="true">→</span>':'Save & continue <span aria-hidden="true">→</span>';
  }
  $('caption').textContent=state.caption || 'Ready when you are.';
  $('field-progress').replaceChildren(...form.fields.map((field,i)=>{
    const li=document.createElement('li'),button=document.createElement('button'),number=document.createElement('span'),label=document.createElement('span');
    const complete=Boolean(String(state.answers[field.id]??'').trim());
    button.className=(!isReview&&!submitted&&i===state.index?'current ':'')+(complete?'complete':'');
    if(i===state.index&&!isReview&&!submitted) button.setAttribute('aria-current','step');
    number.className='step-circle';number.textContent=complete?'✓':i+1;number.setAttribute('aria-hidden','true');label.textContent=field.label;
    button.append(number,label);button.disabled=submitted;button.addEventListener('click',()=>send({type:'utterance',text:`change my ${field.id}`,source:'typed'}));li.append(button);return li;
  }));
  if(isReview) $('review-list').replaceChildren(...form.fields.map(field=>{
    const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd'),edit=document.createElement('button');
    dt.textContent=field.label;dd.textContent=state.answers[field.id]||'Not provided';edit.textContent=`Edit ${field.label.toLowerCase()}`;edit.addEventListener('click',()=>send({type:'utterance',text:`change my ${field.id}`,source:'typed'}));dd.append(edit);row.append(dt,dd);return row;
  }));
  if(submitted){latestSubmission={formId:state.formId,answers:{...state.answers},synthetic:true};stopVoice();}
  if(voice) voice.setMuted(speaking||!state.listening);
  $('pause-voice').textContent=state.listening?'Pause listening':'Resume listening';
  const focusKey=`${state.phase}/${state.field?.id}`;
  if(started&&lastField!==focusKey){$('question-label').focus({preventScroll:true});lastField=focusKey;if(mode==='switch')updateScanOptions(baseScanActions);}
}
function startScan(){ clearInterval(scanTimer);scanIndex=0;paintScan();if(!scanPaused)scanTimer=setInterval(()=>{scanIndex=(scanIndex+1)%scanActions.length;paintScan();},1800); }
function paintScan(){ [...$('scan-options').children].forEach((el,i)=>{el.classList.toggle('scanning',i===scanIndex);el.setAttribute('aria-pressed',String(i===scanIndex));});$('switch-select').textContent=`Select: ${scanActions[scanIndex][0]}`;$('scan-status').textContent=mode==='switch'?`Highlighted: ${scanActions[scanIndex][0]}`:''; }
function updateScanOptions(options){if(options===baseScanActions&&state?.field?.kind==='select')options=options.map(([label,name])=>[name==='characters'?'Choose account type':label,name]);scanActions=options;$('scan-options').replaceChildren(...options.map(([label,name])=>{const button=document.createElement('button');button.textContent=label;button.addEventListener('click',()=>performScan(name));return button;}));startScan();}
function performScan(name){
  if(name==='characters'&&state?.field?.kind==='select'){const f=forms[state.formId].fields.find(f=>f.id===state.field.id);updateScanOptions(f.options.map(o=>[typeof o==='string'?o:o.label,`choice:${typeof o==='string'?o:o.value}`]).concat([['Back to actions','actions']]));return;}
  if(name.startsWith('choice:')){send({type:'set_value',field:state.field.id,value:name.slice(7)});updateScanOptions(baseScanActions);return;}
  if(name==='characters'){updateScanOptions([['Letters a–f','group:abcdef'],['Letters g–l','group:ghijkl'],['Letters m–r','group:mnopqr'],['Letters s–z','group:stuvwxyz'],['Digits 0–4','group:01234'],['Digits 5–9','group:56789'],['Symbols and space','group: @._-'],['Back to actions','actions']]);return;}
  if(name.startsWith('group:')){updateScanOptions([...name.slice(6)].map(c=>[c===' '?'Space':c==='@'?'At sign':c==='.'?'Dot':c,`char:${c}`]).concat([['Back to groups','characters']]));return;}
  if(name==='actions'){updateScanOptions(baseScanActions);return;}
  if(name.startsWith('char:')||name==='delete_character'){
    if(state?.field&&state.phase==='asking'){const current=state.answers[state.field.id]||'';send({type:'set_value',field:state.field.id,value:name==='delete_character'?current.slice(0,-1):current+name.slice(5)});}
    return;
  }
  action(name);
}
function chooseScan(){performScan(scanActions[scanIndex][1]);}
async function init(){
  const loaded=await Promise.all(['scholarship','bank-account'].map(async id=>{const response=await fetch(`forms/${id}.json`);if(!response.ok)throw new Error(`Could not load ${id} form.`);return response.json();}));
  forms=Object.fromEntries(loaded.map(form=>[form.id,form]));
  if(['localhost','127.0.0.1','[::1]'].includes(location.hostname)) {try {const response=await fetch('/api/status');if(response.ok){localStatus=await response.json();local=true;}}catch{/* Static mode stays available. */}}
  if(local) transport=new WebSocketTransport(`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}`);
  else transport=new InProcessTransport({forms,onSubmit:submission=>{localStorage.setItem('accessform-submission',JSON.stringify(submission));latestSubmission=submission;}});
  transport.onMessage(render);updateConnection();
  if(local){$('voice-gate-link').hidden=false;$('voice-status').textContent=localStatus.voice?.available?'Local voice is installed. Enable your microphone, then speak after each prompt. Pause stops microphone processing; use Resume listening to restart.':localStatus.voice?.reason||'Local voice setup is incomplete. See docs/VOICE.md. Keyboard input works now.';$('enable-voice').disabled=!localStatus.voice?.available;$('storage-note').textContent='Confirmed synthetic submissions are saved in the local submissions folder. Audio and answers stay on this device.';}
  else {$('voice-status').textContent=BrowserWasmBackend.reason || 'Voice works best in the local build. Browser voice is not enabled because its model and accuracy have not been verified. Keyboard, captions and switch navigation work without model downloads.';$('enable-voice').textContent='Browser voice unavailable';}
  if(transport.socket)transport.socket.addEventListener('close',()=>fail('Local connection closed. Reload the page after restarting ./start.sh.'));
  $('try-demo').disabled=false;
}
$('try-demo').disabled=true;
document.querySelectorAll('[data-start-mode]').forEach(button=>button.addEventListener('click',()=>{mode=button.dataset.startMode;document.querySelectorAll('[data-start-mode]').forEach(b=>{b.classList.toggle('selected',b===button);b.setAttribute('aria-pressed',String(b===button));});}));
$('try-demo').addEventListener('click',()=>{$('landing').hidden=true;$('workspace').hidden=false;started=true;setMode(mode);$('question-label').focus();});
$('mode-select').addEventListener('change',e=>setMode(e.target.value));
document.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',()=>action(button.dataset.action)));
$('save-next').addEventListener('click',saveNext);$('answer-input').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();saveNext();}});
$('confirm-submit').addEventListener('click',()=>action('confirm_submit'));
function sendCommand(){const text=$('command-input').value.trim();if(text){$('command-input').value='';send({type:'utterance',text,source:'typed'});}}
$('send-command').addEventListener('click',sendCommand);$('command-input').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();sendCommand();}});
$('form-select').addEventListener('change',e=>action('load_form',{formId:e.target.value}));
$('sample-fill').addEventListener('click',()=>{if(state?.phase==='submitted')action('reset');for(const field of forms[state.formId].fields)send({type:'set_value',field:field.id,value:sample[field.id]||'Synthetic sample'});action('review');});
$('contrast').addEventListener('click',()=>{const enabled=document.body.classList.toggle('high-contrast');$('contrast').setAttribute('aria-pressed',String(enabled));});
$('caption-size').addEventListener('click',()=>{const enabled=$('caption').classList.toggle('large');$('caption-size').setAttribute('aria-pressed',String(enabled));});
$('download-submission').addEventListener('click',()=>{if(!latestSubmission)return;const blob=new Blob([JSON.stringify(latestSubmission,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=`accessform-${latestSubmission.formId}-synthetic.json`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
updateScanOptions(baseScanActions);clearInterval(scanTimer);
$('switch-select').addEventListener('click',chooseScan);$('scan-toggle').addEventListener('click',()=>{scanPaused=!scanPaused;$('scan-toggle').textContent=scanPaused?'Resume scanning':'Pause scanning';$('scan-toggle').setAttribute('aria-pressed',String(!scanPaused));if(scanPaused)clearInterval(scanTimer);else startScan();});
document.addEventListener('keydown',e=>{if(mode==='switch'&&!scanPaused&&e.code==='Space'&&!['INPUT','TEXTAREA','SELECT','BUTTON'].includes(e.target.tagName)){e.preventDefault();chooseScan();}});
$('enable-voice').addEventListener('click',async()=>{try{$('enable-voice').disabled=true;voice ??= new LocalServerBackend({onError:error=>{$('voice-status').textContent=`Voice error: ${error.message}. You can continue with typed commands.`;},onStatus:text=>{if(text)$('voice-status').textContent=text;else $('voice-status').textContent=state?.listening?($('capture-mode').value==='ptt'?'Ready. Hold to speak after the prompt.':'Listening locally. Speak after the prompt.'):'Listening paused. Use Resume listening to restart.';}});if(!tts){tts=new EspeakServerTTS({onSpeaking:value=>{speaking=value;voice.setMuted(speaking||!state?.listening);}});voice.onText(handleVoiceText);}voice.setMode($('capture-mode').value);await voice.start();voiceActive=true;$('capture-controls').hidden=false;action('resume');$('enable-voice').hidden=true;$('pause-voice').hidden=false;action('repeat');}catch(error){$('voice-status').textContent=`Voice could not start: ${error.message}. Continue with keyboard or typed commands.`;}finally{$('enable-voice').disabled=false;}});
$('pause-voice').addEventListener('click',()=>action(state?.listening?'pause':'resume'));
window.addEventListener('online',updateConnection);window.addEventListener('offline',updateConnection);
init().catch(fail);
const cacheNote=document.createElement('p');cacheNote.className='helper';cacheNote.textContent='Offline cache: not yet verified.';$('storage-note').after(cacheNote);
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').then(()=>navigator.serviceWorker.ready).then(()=>{cacheNote.textContent='App cache installed. Verify offline use by disconnecting Wi-Fi and reloading. Local voice also requires installed models.';}).catch(()=>{cacheNote.textContent='Offline cache could not install. Keep this page open or use the local build.';});

function handleVoiceText(text){
  $('heard-text').textContent=`Heard: “${text}”`;
  const risky=getRiskyVoiceAction(text);
  if(risky){pendingVoiceAction=risky;$('voice-confirmation').hidden=false;$('voice-confirmation-text').textContent=`You requested: ${risky.label}. Nothing has changed. Confirm using the button below, or cancel.`;$('approve-voice-action').disabled=risky.name==='load_form'&&!risky.formId;if(risky.name==='load_form'&&!risky.formId)$('voice-confirmation-text').textContent+=' Choose the target form in the form selector.';return;}
  pendingVoiceAction=null;$('voice-confirmation').hidden=true;send({type:'utterance',text,source:'voice'});
}
function beginHold(source){if(holdSource||!voiceActive||$('capture-mode').value!=='ptt')return;tts?.cancel();if(voice.startHold()){holdSource=source;$('push-to-talk').setAttribute('aria-pressed','true');$('push-to-talk').textContent='Speaking… release to recognize';}}
function endHold(source){if(holdSource!==source)return;holdSource=null;voice?.finishHold();$('push-to-talk').setAttribute('aria-pressed','false');$('push-to-talk').textContent='Hold to speak';}
function cancelHold(){holdSource=null;voice?.cancelHold();$('push-to-talk').setAttribute('aria-pressed','false');$('push-to-talk').textContent='Hold to speak';}
$('capture-mode').addEventListener('change',()=>{cancelHold();voice?.setMode($('capture-mode').value);$('push-to-talk').hidden=$('capture-mode').value!=='ptt';});
$('push-to-talk').addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();$('push-to-talk').setPointerCapture(e.pointerId);beginHold('pointer');});
$('push-to-talk').addEventListener('pointerup',()=>endHold('pointer'));
$('push-to-talk').addEventListener('pointercancel',cancelHold);
$('push-to-talk').addEventListener('lostpointercapture',()=>{if(holdSource==='pointer')cancelHold();});
$('push-to-talk').addEventListener('keydown',e=>{if(['Space','Enter'].includes(e.code)){e.preventDefault();if(!e.repeat)beginHold('button');}});
$('push-to-talk').addEventListener('keyup',e=>{if(['Space','Enter'].includes(e.code)){e.preventDefault();endHold('button');}});
$('push-to-talk').addEventListener('blur',cancelHold);
document.addEventListener('keydown',e=>{if(e.altKey&&e.code==='Space'&&!e.repeat&&!['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)&&!e.target.isContentEditable){e.preventDefault();beginHold('shortcut');}});
document.addEventListener('keyup',e=>{if(e.code==='Space'&&holdSource==='shortcut'){e.preventDefault();endHold('shortcut');}});
window.addEventListener('blur',cancelHold);
document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelHold();});
$('approve-voice-action').addEventListener('click',()=>{const pending=pendingVoiceAction;pendingVoiceAction=null;$('voice-confirmation').hidden=true;if(pending)action(pending.name,pending.formId?{formId:pending.formId}:{});});
$('cancel-voice-action').addEventListener('click',()=>{pendingVoiceAction=null;$('voice-confirmation').hidden=true;$('voice-status').textContent='Spoken action cancelled. Your answers are unchanged.';});
