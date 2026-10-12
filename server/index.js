import http from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {WebSocketServer} from 'ws';
import {createEngine} from '../shared/engine.js';
import {transcribe,synthesize,status} from '../voice/server.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json','.md':'text/plain; charset=utf-8','.svg':'image/svg+xml','.wasm':'application/wasm','.wav':'audio/wav','.webmanifest':'application/manifest+json'};
export async function startServer({port=Number(process.env.PORT)||4173,submissionsDir=path.join(root,'submissions')}={}){
 const forms=Object.fromEntries(await Promise.all(['scholarship','bank-account'].map(async id=>[id,JSON.parse(await readFile(path.join(root,'forms',`${id}.json`),'utf8'))])));
 const respond=(res,code,value,type='application/json')=>{res.writeHead(code,{'Content-Type':type,'Cache-Control':'no-store'});res.end(type==='application/json'?JSON.stringify(value):value);};
 const server=http.createServer(async(req,res)=>{res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('X-Content-Type-Options','nosniff');
 try{const url=new URL(req.url,'http://localhost');
 if(req.headers.origin&&!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.origin))return respond(res,403,{error:'Local origin required.'});
 if(req.method==='GET'&&url.pathname==='/api/forms')return respond(res,200,forms);
 if(req.method==='GET'&&url.pathname==='/api/status')return respond(res,200,{local:true,voice:await status()});
 if(req.method==='POST'&&url.pathname==='/api/transcribe'){let bytes=0;const chunks=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>4*1024*1024)return respond(res,413,{error:'Audio too long.'});chunks.push(chunk);}return respond(res,200,await transcribe(Buffer.concat(chunks)));}
 if(req.method==='GET'&&url.pathname==='/api/tts'){const text=url.searchParams.get('text')||'';if(text.length>5000)return respond(res,400,{error:'Text too long.'});return respond(res,200,await synthesize(text),'audio/wav');}
 if(req.method!=='GET'&&req.method!=='HEAD')return respond(res,405,{error:'Method not allowed.'});
 const pathname=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);
 const allowed=/^\/(LICENSE|precache\.json|index\.html|styles\.css|app\.js|sw\.js|manifest\.webmanifest|JUDGE_GUIDE\.md|LICENSES\.md|persona\.html)$/.test(pathname)||/^\/(shared|forms|frontend|public|assets|models|docs|licenses)\/[a-zA-Z0-9_./-]+$/.test(pathname)||/^\/voice\/(index|client|browser|audio|tts|backends)\.js$/.test(pathname);
 if(!allowed||pathname.split('/').some(p=>p==='..'||p.startsWith('.')))return respond(res,404,{error:'Not found.'});
 const data=await readFile(path.join(root,pathname));res.writeHead(200,{'Content-Type':mime[path.extname(pathname)]||'application/octet-stream'});res.end(req.method==='HEAD'?undefined:data);
 }catch(error){respond(res,error.code==='ENOENT'?404:503,{error:error.code==='ENOENT'?'Not found.':'This local feature is unavailable. Check local setup.'});}});
 const wss=new WebSocketServer({server,maxPayload:65536,verifyClient:({origin},done)=>done(!origin||/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))});
 wss.on('connection',socket=>{const engine=createEngine({forms,onMessage:m=>{if(socket.readyState===1)socket.send(JSON.stringify(m));},onSubmit:async submission=>{const dir=submissionsDir;await mkdir(dir,{recursive:true});await writeFile(path.join(dir,`${randomUUID()}.json`),JSON.stringify(submission,null,2),{mode:0o600});}});socket.on('message',async data=>{try{await engine.send(JSON.parse(data));}catch{if(socket.readyState===1)socket.send(JSON.stringify({type:'speak',text:'That request could not be processed.',id:'error'}));}});});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});return {server,wss,port:server.address().port,close:()=>new Promise(resolve=>{for(const client of wss.clients)client.terminate();wss.close(()=>server.close(resolve));})};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))startServer().then(({port})=>console.log(`AccessForm: http://127.0.0.1:${port}`)).catch(()=>{console.error('AccessForm could not start. Check dependencies and port availability.');process.exitCode=1;});
