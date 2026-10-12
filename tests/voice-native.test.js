import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PersistentWhisper } from '../voice/persistent.js';
import { resolveRecognitionOptions, transcribe } from '../voice/server.js';
import { encodeWav } from '../voice/audio.js';

function mockedManager() {
  const children=[],requests=[];
  const manager=new PersistentWhisper({
    reservePort:async()=>39123,
    spawnProcess:(binary,args,options)=>{const child=new EventEmitter();Object.assign(child,{binary,args,options,kill(signal){this.signal=signal;queueMicrotask(()=>this.emit('exit',0));return true;}});children.push(child);return child;},
    fetchLocal:async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>url.endsWith('/health')?{status:'ok'}:{text:' next '}};},
  });
  return {manager,children,requests};
}

test('native selection defaults small.en and CLI; request model/backend are allowlisted',()=>{
  const old=process.env.WHISPER_MODEL;delete process.env.WHISPER_MODEL;
  try{const selected=resolveRecognitionOptions();assert.equal(selected.backend,'cli');assert.equal(selected.modelId,'small.en');assert.match(selected.model,/ggml-small.en.bin$/);assert.throws(()=>resolveRecognitionOptions({model:'../../private'}));assert.throws(()=>resolveRecognitionOptions({backend:'https://remote'}));assert.throws(()=>resolveRecognitionOptions(null));assert.equal(resolveRecognitionOptions({model:'base.en',backend:'persistent'}).modelId,'base.en');}finally{if(old===undefined)delete process.env.WHISPER_MODEL;else process.env.WHISPER_MODEL=old;}
});

test('persistent manager reuses one model, binds loopback, silences logs, and sends multipart audio in memory',async()=>{
  const {manager,children,requests}=mockedManager();
  try{
    const config={binary:'/fake/whisper-server',model:'/fake/small.en'};
    const first=await manager.infer(Buffer.from([1,2,3]),config),second=await manager.infer(Buffer.from([4,5]),config);
    assert.equal(first.text,'next');assert.equal(first.coldStart,true);assert.ok(first.startupMs>=0);assert.equal(second.coldStart,false);assert.equal(second.startupMs,0);assert.equal(children.length,1);
    const child=children[0];assert.equal(child.args[child.args.indexOf('--host')+1],'127.0.0.1');assert.equal(child.options.stdio,'ignore');assert.ok(child.args.includes('-mc'));assert.ok(!child.args.includes('--convert'));
    const inference=requests.find(r=>r.url.endsWith('/inference'));assert.ok(inference.url.startsWith('http://127.0.0.1:39123/accessform-'));assert.equal(inference.options.body.get('file').size,3);
    await manager.infer(Buffer.from([6]),{...config,model:'/fake/base.en'});assert.equal(children.length,2);assert.equal(children[0].signal,'SIGTERM');
  }finally{await manager.stop();}
});

test('persistent failed inference clears the model and sanitizes diagnostic response',async()=>{
  const {manager,children}=mockedManager();manager.fetchLocal=async(url)=>{if(url.endsWith('/health'))return{ok:true,json:async()=>({status:'ok'})};throw new Error('sensitive transcript');};
  await assert.rejects(manager.infer(Buffer.from([1]),{binary:'/fake',model:'/fake'}),error=>/Persistent recognition failed/.test(error.message)&&!error.message.includes('sensitive'));
  assert.equal(manager.child,null);assert.equal(children[0].signal,'SIGTERM');
});

test('invalid recognition options rejected before launching native engine',async()=>{
  const wav=Buffer.from(encodeWav(new Float32Array(160)));
  await assert.rejects(transcribe(wav,{model:'other.en'}),/base.en or small.en/);
  await assert.rejects(transcribe(wav,{backend:'cloud'}),/cli or persistent/);
});
