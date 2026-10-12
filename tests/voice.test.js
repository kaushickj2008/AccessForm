import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeWav,resample } from '../voice/audio.js';
import {validateWav} from '../voice/server.js';
import {TypedBackend,BrowserWasmBackend} from '../voice/backends.js';
test('capture encoding makes 16 kHz mono WAV accepted by server',()=>{const signal=Float32Array.from({length:48000},(_,i)=>Math.sin(i/10));const pcm=resample(signal,48000);assert.equal(pcm.length,16000);const wav=Buffer.from(encodeWav(pcm));assert.equal(wav.length,32044);validateWav(wav);});
test('reject non-audio and unsupported sample rate',()=>{assert.throws(()=>validateWav(Buffer.from('not audio')));assert.throws(()=>validateWav(Buffer.from(encodeWav(new Float32Array(32),44100))));});
test('typed adapter respects start and stop',()=>{const backend=new TypedBackend();let text='';backend.onText(v=>text=v);backend.submit('ignored');assert.equal(text,'');backend.start();backend.submit('next');assert.equal(text,'next');backend.stop();backend.submit('back');assert.equal(text,'next');});
test('unbenchmarked browser voice fails explicitly without requesting microphone',async()=>{assert.equal(BrowserWasmBackend.available,false);await assert.rejects(new BrowserWasmBackend().start(),/not enabled/);});

test('VAD emits one WAV after trailing silence and discards muted speech',async()=>{
  const {MicCapture}=await import('../voice/audio.js');const emitted=[];const capture=new MicCapture(wav=>emitted.push(wav),{silenceMs:200});capture.context={sampleRate:16000};capture.setMode('vad');
  const speech=new Float32Array(1600).fill(.1),silence=new Float32Array(1600);
  capture.setMuted(true);capture.consume(speech);capture.consume(silence);assert.equal(emitted.length,0);
  capture.setMuted(false);capture.consume(speech);capture.consume(silence);capture.consume(silence);assert.equal(emitted.length,1);validateWav(Buffer.from(emitted[0]));capture.consume(silence);assert.equal(emitted.length,1);
});

test('stopped local adapter ignores in-flight transcription and does not emit stale text',async()=>{
  const {LocalServerBackend}=await import('../voice/backends.js');const original=globalThis.fetch;let resolveFetch;globalThis.fetch=()=>new Promise(resolve=>{resolveFetch=resolve;});
  try{const backend=new LocalServerBackend();backend.capture={setMuted(){},stop(){}};backend.active=true;let received='';backend.onText(value=>received=value);const task=backend.transcribe(new ArrayBuffer(0));backend.stop();resolveFetch({ok:true,json:async()=>({text:'confirm submit'})});await task;assert.equal(received,'');}finally{globalThis.fetch=original;}
});


test('PTT is default and enabling capture alone sends no audio',async()=>{
  const {MicCapture}=await import('../voice/audio.js');const emitted=[];const capture=new MicCapture(wav=>emitted.push(wav));capture.context={sampleRate:16000};assert.equal(capture.mode,'ptt');capture.consume(new Float32Array(1600).fill(.1));assert.equal(emitted.length,0);assert.equal(capture.length,0);
  assert.equal(capture.startHold(),true);capture.consume(new Float32Array(1600).fill(.1));assert.equal(emitted.length,0);capture.finishHold();assert.equal(emitted.length,1);validateWav(Buffer.from(emitted[0]));capture.finishHold();assert.equal(emitted.length,1);
});
test('PTT cancels rather than emitting on cancellation or mute and caps at 25 seconds',async()=>{
  const {MicCapture}=await import('../voice/audio.js');const emitted=[];const capture=new MicCapture(wav=>emitted.push(wav));capture.context={sampleRate:16000};capture.startHold();capture.consume(new Float32Array(1600));capture.cancelHold();assert.equal(emitted.length,0);capture.startHold();capture.consume(new Float32Array(1600));capture.setMuted(true);capture.finishHold();assert.equal(emitted.length,0);capture.setMuted(false);capture.startHold();capture.consume(new Float32Array(16000*26));assert.equal(emitted.length,1);assert.equal(emitted[0].byteLength,44+16000*25*2);assert.equal(capture.holding,false);
});
test('risky spoken requests are identified for explicit UI confirmation',async()=>{
  const {getRiskyVoiceAction}=await import('../voice/backends.js');assert.equal(getRiskyVoiceAction('confirm submit.').name,'confirm_submit');assert.equal(getRiskyVoiceAction('reset').name,'reset');assert.equal(getRiskyVoiceAction('load bank account form').formId,'bank-account');assert.equal(getRiskyVoiceAction('change my email'),null);assert.equal(getRiskyVoiceAction('next'),null);
});
