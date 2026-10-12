import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {transcribe,validateWav} from '../voice/server.js';
import {prompts,score,summarize} from '../gate/protocol.js';
const sessions=new Map();
let activeRun=null;
async function removeAudio(session){if(session.dir){await rm(session.dir,{recursive:true,force:true});session.dir=null;}}
export async function closeGate(){for(const s of sessions.values()){s.cancelled=true;clearTimeout(s.timer);await removeAudio(s);}sessions.clear();}
async function run(s,forms){
  s.state='running';s.rows=[];s.done=0;s.total=80;activeRun=s.id;
  try{
    for(const model of ['base.en','small.en'])for(const backend of ['cli','persistent'])for(const prompt of prompts){
      if(s.cancelled)throw new Error('cancelled');
      const wav=await readFile(path.join(s.dir,prompt.id+'.wav'));
      try{const result=await transcribe(wav,{model,backend});const outcome=await score(prompt,result.text,forms);s.rows.push({id:prompt.id,category:prompt.category,style:prompt.style,model,backend,heard:result.text,ms:result.ms,startupMs:result.startupMs??0,...outcome});}
      catch{s.rows.push({id:prompt.id,category:prompt.category,model,backend,correct:false,error:'Recognition or scoring failed.'});}
      s.done++;
    }
    s.report={kind:'Headset microphone recordings provided by the operator; one speaker, one pass',measuredAt:new Date().toISOString(),...summarize(s.rows),rows:s.rows};s.state='complete';
  }catch{s.state='cancelled';}finally{await removeAudio(s);activeRun=null;s.audioDeleted=true;}
}
export async function handleGate(req,res,url,forms,respond){
  if(!url.pathname.startsWith('/api/voice-gate'))return false;
  res.setHeader('Cache-Control','no-store');
  if(req.method==='POST'&&url.pathname==='/api/voice-gate/start'){
    if(sessions.size>=5){respond(res,429,{error:'Close an existing recording session first.'});return true;}
    const id=randomUUID(),dir=await mkdtemp(path.join(tmpdir(),'accessform-gate-'));
    const s={id,dir,clips:new Set(),state:'recording',done:0,total:80,audioDeleted:false};
    s.timer=setTimeout(async()=>{s.cancelled=true;await removeAudio(s);sessions.delete(id);},30*60*1000);s.timer.unref();sessions.set(id,s);respond(res,200,{sessionId:id,prompts,expiresInMinutes:30});return true;
  }
  const parts=url.pathname.split('/'),s=sessions.get(parts[3]);
  if(!s){respond(res,404,{error:'Recording session expired. Start again.'});return true;}
  if(req.method==='DELETE'){s.cancelled=true;clearTimeout(s.timer);await removeAudio(s);sessions.delete(s.id);respond(res,200,{audioDeleted:true});return true;}
  if(req.method==='POST'&&parts[4]==='clip'){
    if(s.state!=='recording'||!prompts.some(p=>p.id===parts[5])){respond(res,400,{error:'Invalid recording prompt.'});return true;}
    let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>1100000){respond(res,413,{error:'Keep each recording under 30 seconds.'});return true;}chunks.push(chunk);}
    const wav=Buffer.concat(chunks);validateWav(wav);await writeFile(path.join(s.dir,parts[5]+'.wav'),wav,{mode:0o600});s.clips.add(parts[5]);respond(res,200,{recorded:s.clips.size});return true;
  }
  if(req.method==='POST'&&parts[4]==='run'){
    if(s.clips.size!==20||s.state!=='recording'||activeRun){respond(res,409,{error:'Record all 20 prompts and wait for any active benchmark.'});return true;}
    s.state='running';activeRun=s.id;void run(s,forms);respond(res,202,{state:s.state});return true;
  }
  if(req.method==='GET'){respond(res,200,{state:s.state,done:s.done,total:s.total,recorded:s.clips.size,audioDeleted:s.audioDeleted,report:s.report??null});return true;}
  respond(res,405,{error:'Method not allowed.'});return true;
}
