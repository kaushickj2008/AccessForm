import { MicCapture } from './audio.js';
export class TypedBackend {
  constructor(){this.cb=()=>{};this.active=false;}
  onText(cb){this.cb=cb;}
  start(){this.active=true;}
  stop(){this.active=false;}
  submit(text){if(this.active)this.cb(text);}
}
export class LocalServerBackend {
  constructor({onError=()=>{},onStatus=()=>{}}={}){this.cb=()=>{};this.onError=onError;this.onStatus=onStatus;this.busy=false;this.muted=false;this.generation=0;this.capture=new MicCapture(wav=>this.transcribe(wav),{onError});}
  onText(cb){this.cb=cb;}
  setMode(mode){this.capture.setMode(mode);}
  startHold(){return this.active&&!this.busy&&this.capture.startHold();}
  finishHold(){this.capture.finishHold();}
  cancelHold(){this.capture.cancelHold();}
  async start(){this.active=true;try{await this.capture.start();}catch(e){this.active=false;throw e;}}
  stop(){this.active=false;this.generation++;this.controller?.abort();return this.capture.stop();}
  setMuted(value){this.muted=value;this.capture.setMuted(value||this.busy);}
  async transcribe(wav){if(this.busy||this.muted||!this.active)return;const generation=this.generation;this.busy=true;this.capture.setMuted(true);this.onStatus('Recognizing on this device…');this.controller=new AbortController();try{const response=await fetch('/api/transcribe',{method:'POST',headers:{'Content-Type':'audio/wav'},body:wav,signal:this.controller.signal});const result=await response.json();if(!response.ok)throw new Error(result.error||'Local transcription unavailable.');if(this.active&&generation===this.generation&&result.text?.trim())this.cb(result.text.trim());}catch(e){if(e.name!=='AbortError')this.onError(e);}finally{this.busy=false;this.capture.setMuted(this.muted);this.onStatus('');}}
}
export class BrowserWasmBackend {
  static available=false;
  static reason='Browser voice is not enabled: no verified WASM model has passed the benchmark. Voice works best in the local build after setup.';
  onText(cb){this.cb=cb;}
  async start(){throw new Error(BrowserWasmBackend.reason);}
  stop(){}
  setMuted(){}
}
export class EspeakServerTTS {
  constructor({onSpeaking=()=>{}}={}){this.onSpeaking=onSpeaking;this.chain=Promise.resolve();this.generation=0;}
  speak(text){const generation=this.generation;this.chain=this.chain.catch(()=>{}).then(()=>generation===this.generation?this.play(text,generation):undefined);return this.chain;}
  cancel(){this.generation++;this.controller?.abort();this.audio?.pause();this.finish?.();this.onSpeaking(false);}
  async play(text,generation){this.onSpeaking(true);let url;this.controller=new AbortController();try{const response=await fetch('/api/tts?text='+encodeURIComponent(text),{cache:'no-store',signal:this.controller.signal});if(!response.ok)throw new Error('Local speech output is unavailable.');const blob=await response.blob();if(generation!==this.generation)return;url=URL.createObjectURL(blob);const audio=new Audio(url);this.audio=audio;await new Promise((resolve,reject)=>{this.finish=resolve;audio.onended=resolve;audio.onerror=()=>reject(new Error('Audio playback failed.'));audio.play().catch(reject);});}finally{if(url)URL.revokeObjectURL(url);this.audio=null;this.finish=null;this.onSpeaking(false);}}
}
export class EspeakWasmTTS {
  static available=false;
  async speak(){throw new Error('Browser speech output is unavailable: an audited eSpeak WASM distribution is not bundled. Read the captions or use the local build.');}
}

// Spoken destructive or submission requests require a separate, explicit UI choice.
export function getRiskyVoiceAction(text) {
  const normalized=String(text).toLowerCase().replace(/[^a-z0-9\s-]/g,'').trim();
  if(/\bsubmit\b/.test(normalized))return {name:'confirm_submit',label:'Submit this synthetic application'};
  if(/\breset\b|\bstart (?:again|over)\b/.test(normalized))return {name:'reset',label:'Reset all answers'};
  if(/\b(?:load|switch|change)\b.*\bform\b/.test(normalized))return {name:'load_form',formId:/\bbank\b/.test(normalized)?'bank-account':/\bscholarship\b/.test(normalized)?'scholarship':null,label:'Load another form and discard current answers'};
  return null;
}
