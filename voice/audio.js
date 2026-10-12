export function resample(samples, fromRate, toRate=16000) {
  if(fromRate===toRate) return new Float32Array(samples);
  const ratio=fromRate/toRate, output=new Float32Array(Math.floor(samples.length/ratio));
  for(let i=0;i<output.length;i++) { const start=i*ratio, end=(i+1)*ratio; let sum=0, weight=0; for(let j=Math.floor(start);j<Math.ceil(end)&&j<samples.length;j++){const w=Math.min(end,j+1)-Math.max(start,j);sum+=samples[j]*w;weight+=w;} output[i]=weight?sum/weight:0; }
  return output;
}
export function encodeWav(samples, rate=16000) {
  const buffer=new ArrayBuffer(44+samples.length*2), view=new DataView(buffer);
  const str=(at,s)=>[...s].forEach((c,i)=>view.setUint8(at+i,c.charCodeAt(0)));
  str(0,'RIFF');view.setUint32(4,36+samples.length*2,true);str(8,'WAVE');str(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);str(36,'data');view.setUint32(40,samples.length*2,true);
  samples.forEach((v,i)=>view.setInt16(44+i*2,Math.round(Math.max(-1,Math.min(1,v))*(v<0?32768:32767)),true));return buffer;
}
export class MicCapture {
  constructor(onAudio,{onError=()=>{},threshold=.012,silenceMs=1000}={}) { Object.assign(this,{onAudio,onError,threshold,silenceMs});this.muted=false;this.chunks=[];this.pre=[];this.active=false;this.silent=0;this.length=0;this.generation=0;this.mode='ptt';this.holding=false; }
  async start() {
    if(this.context)return;
    const generation=++this.generation;
    const stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true},video:false});
    if(generation!==this.generation){stream.getTracks().forEach(t=>t.stop());return;}this.stream=stream;
    try{this.context=new AudioContext();await this.context.resume();}catch(error){await this.stop();throw error;}
    // Local audio processing only. ScriptProcessor is supported across target browsers.
    this.processor=this.context.createScriptProcessor(4096,1,1);this.source=this.context.createMediaStreamSource(this.stream);this.gain=this.context.createGain();this.gain.gain.value=0;
    this.processor.onaudioprocess=e=>this.consume(new Float32Array(e.inputBuffer.getChannelData(0)));
    this.source.connect(this.processor);this.processor.connect(this.gain);this.gain.connect(this.context.destination);
  }
  setMode(mode){if(!['ptt','vad'].includes(mode))throw new Error('Unknown capture mode');this.cancelHold();this.mode=mode;}
  startHold(){if(this.mode!=='ptt'||this.muted||!this.context||this.holding)return false;this.clear();this.holding=true;return true;}
  finishHold(){if(!this.holding)return;this.holding=false;this.emitAudio();}
  cancelHold(){this.holding=false;this.clear();}
  setMuted(value){this.muted=value;if(value)this.cancelHold();}
  emitAudio(){if(!this.length){this.clear();return;}const audio=new Float32Array(this.length);let pos=0;for(const c of this.chunks){audio.set(c,pos);pos+=c.length;}const wav=encodeWav(resample(audio,this.context.sampleRate));this.clear();Promise.resolve(this.onAudio(wav)).catch(this.onError);}
  clear(){this.chunks=[];this.pre=[];this.active=false;this.silent=0;this.length=0;}
  consume(chunk) {
    if(this.muted||!this.context)return;
    if(this.mode==='ptt'){
      if(!this.holding)return;
      const remaining=Math.max(0,Math.floor(this.context.sampleRate*25)-this.length);
      const part=chunk.length>remaining?chunk.slice(0,remaining):chunk;
      if(part.length){this.chunks.push(part);this.length+=part.length;}
      if(this.length>=this.context.sampleRate*25)this.finishHold();
      return;
    }
    const ms=chunk.length/this.context.sampleRate*1000, rms=Math.sqrt(chunk.reduce((s,v)=>s+v*v,0)/chunk.length);
    if(!this.active){this.pre.push(chunk);if(this.pre.length>3)this.pre.shift();if(rms<this.threshold)return;this.active=true;this.chunks=this.pre;this.pre=[];this.length=this.chunks.reduce((s,c)=>s+c.length,0);}
    else {this.chunks.push(chunk);this.length+=chunk.length;}
    this.silent=rms<this.threshold?this.silent+ms:0;
    if(this.silent>=this.silenceMs||this.length/this.context.sampleRate>=25){this.emitAudio();}
  }
  async stop(){this.generation++;this.cancelHold();this.stream?.getTracks().forEach(t=>t.stop());this.processor?.disconnect();this.source?.disconnect();this.gain?.disconnect();if(this.context)await this.context.close();this.context=null;}
}
