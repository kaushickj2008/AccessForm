import { access, mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, basename } from 'node:path';
import { PersistentWhisper } from './persistent.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);
const persistent = new PersistentWhisper();
let recognitionQueue = Promise.resolve();
process.once('exit', () => persistent.killOnExit());
const MODELS = new Set(['base.en', 'small.en']);
const BACKENDS = new Set(['cli', 'persistent']);
export function resolveRecognitionOptions(options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new Error('Recognition options must be an object.');
  if (options.model !== undefined && !MODELS.has(options.model)) throw new Error('Choose base.en or small.en.');
  const backend = options.backend ?? 'cli';
  if (!BACKENDS.has(backend)) throw new Error('Choose cli or persistent.');
  const model = resolve(options.model ? `.voice/models/ggml-${options.model}.bin` : process.env.WHISPER_MODEL || '.voice/models/ggml-small.en.bin');
  return { backend, model, modelId: basename(model).replace(/^ggml-/, '').replace(/\.bin$/, '') };
}
function serialized(job) { const result = recognitionQueue.then(job); recognitionQueue = result.catch(() => {}); return result; }
export function shutdownPersistent() { return serialized(() => persistent.stop()); }
async function binary(name, override) {
  const candidates = override ? [override] : [`${process.cwd()}/.voice/bin/${name}`, ...(process.env.PATH || '').split(':').map(p => join(p,name))];
  for (const p of candidates) { try { await access(p, constants.X_OK); return p; } catch {} }
  return null;
}
export async function status() {
  const whisper = await binary('whisper-cli', process.env.WHISPER_BIN);
  const espeak = await binary('espeak-ng', process.env.ESPEAK_BIN);
  const { model, modelId } = resolveRecognitionOptions();
  const whisperServer = await binary('whisper-server', process.env.WHISPER_SERVER_BIN);
  let modelExists = false; try { await access(model); modelExists = true; } catch {}
  return { asr: Boolean(whisper && modelExists), tts: Boolean(espeak), available: Boolean(whisper && modelExists && espeak), whisper, whisperServer, persistentAvailable: Boolean(whisperServer && modelExists), defaultBackend: 'cli', defaultModel: modelId, espeak, model: modelExists ? model : null, browserVoice: false, reason: whisper && modelExists && espeak ? '' : 'Local voice needs whisper-cli, an English Whisper model, and eSpeak NG. See docs/VOICE.md.' };
}
export function validateWav(buf) {
  if (buf.length < 44 || buf.toString('ascii',0,4) !== 'RIFF' || buf.toString('ascii',8,12) !== 'WAVE') throw new Error('Expected a PCM WAV file.');
  let format = false, data = false;
  for (let p=12;p+8<=buf.length;) {
    const kind=buf.toString('ascii',p,p+4), size=buf.readUInt32LE(p+4);
    if (p+8+size>buf.length) throw new Error('Truncated WAV.');
    if (kind==='fmt ') { if(size<16 || buf.readUInt16LE(p+8)!==1 || buf.readUInt16LE(p+10)!==1 || buf.readUInt32LE(p+12)!==16000 || buf.readUInt16LE(p+22)!==16) throw new Error('Use 16 kHz mono 16-bit PCM WAV.'); format=true; }
    if(kind==='data') data=size>0;
    p+=8+size+(size%2);
  }
  if(!format || !data) throw new Error('WAV is missing audio data.');
}
export async function transcribe(wavBuffer, options = {}) {
  if (!Buffer.isBuffer(wavBuffer)) throw new Error('Expected WAV bytes.');
  if(wavBuffer.length>16000*2*31+4096) throw new Error('Audio must be at most 30 seconds.');
  validateWav(wavBuffer);
  const selected = resolveRecognitionOptions(options);
  return serialized(async () => {
    const config = await status();
    try { await access(selected.model); } catch { throw new Error('Requested local speech model is not installed.'); }
    if (selected.backend === 'persistent') {
      if (!config.whisperServer) throw new Error('whisper-server is not installed. Use the CLI backend.');
      return { ...await persistent.infer(wavBuffer, { binary: config.whisperServer, model: selected.model, cpu: process.env.WHISPER_CPU === '1' }), model: selected.modelId };
    }
    if (!config.whisper) throw new Error('whisper-cli is not installed.');
    // Switching backends releases the previous model before loading another one.
    await persistent.stop();
    const dir=await mkdtemp(join(tmpdir(),'accessform-audio-')); const started=performance.now();
    try {
      const input=join(dir,'input.wav'), output=join(dir,'transcript'); await writeFile(input,wavBuffer,{mode:0o600});
      await exec(config.whisper,['-m',selected.model,'-f',input,'-l','en','-nt','-otxt','-of',output,...(process.env.WHISPER_CPU==='1'?['-ng']:[])],{timeout:60000,maxBuffer:2*1024*1024});
      return {text:(await readFile(output+'.txt','utf8')).trim(),ms:Math.round(performance.now()-started),startupMs:null,coldStart:true,backend:'cli',model:selected.modelId};
    } catch { throw new Error('Local recognition failed. Check the speech engine and model; continue with typed input.'); } finally { await rm(dir,{recursive:true,force:true}); }
  });
}
export async function synthesize(text) {
  if(typeof text!=='string' || !text.trim() || text.length>4000) throw new Error('Speech text must be between 1 and 4000 characters.');
  const config=await status(); if(!config.tts) throw new Error(config.reason);
  try { const {stdout}=await exec(config.espeak,['--stdout','-v','en','-s','155','--',text],{encoding:'buffer',timeout:15000,maxBuffer:16*1024*1024}); return stdout; } catch { throw new Error('Local speech synthesis failed. Read the captions or check eSpeak NG.'); }
}
