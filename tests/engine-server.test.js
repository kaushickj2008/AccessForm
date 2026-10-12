import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readdir,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {startServer} from '../server/index.js';
import {WebSocketTransport} from '../shared/transports.js';
function exchange(t,msg,predicate=m=>m.type==='state'){return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{off();reject(Error('Websocket timeout'));},3000);const off=t.onMessage(m=>{if(predicate(m)){clearTimeout(timeout);off();resolve(m);}});t.send(msg);});}
test('local transport saves only confirmed valid data, isolates sessions and blocks private paths',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'accessform-test-'));let app;const clients=[];
 try{app=await startServer({port:0,submissionsDir:directory});const base=`http://127.0.0.1:${app.port}`;
 assert.equal((await fetch(base+'/api/status').then(r=>r.json())).local,true);
 assert.ok((await fetch(base+'/api/forms').then(r=>r.json())).scholarship);
 for(const route of ['/server/index.js','/.git/config','/submissions/test.json','/voice/server.js'])assert.equal((await fetch(base+route)).status,404);
 assert.equal((await fetch(base+'/api/forms',{headers:{Origin:'https://untrusted.example'}})).status,403);
 const t=new WebSocketTransport(`ws://127.0.0.1:${app.port}`);clients.push(t);
 assert.equal((await exchange(t,{type:'hello',mode:'keyboard'})).field.id,'name');
 await exchange(t,{type:'action',name:'confirm_submit'});assert.deepEqual(await readdir(directory),[]);
 for(const [field,value] of Object.entries({name:'Test Student',email:'test.student@example.com',phone:'9000012345',course:'Computing',reason:'Synthetic practice'}))await exchange(t,{type:'set_value',field,value});
 const second=new WebSocketTransport(`ws://127.0.0.1:${app.port}`);clients.push(second);assert.deepEqual((await exchange(second,{type:'hello',mode:'keyboard'})).answers,{});
 assert.equal((await exchange(t,{type:'action',name:'review'})).phase,'reviewing');assert.deepEqual(await readdir(directory),[]);
 await exchange(t,{type:'action',name:'confirm_submit'},m=>m.type==='state'&&m.phase==='submitted');
 const files=await readdir(directory);assert.equal(files.length,1);assert.equal(JSON.parse(await readFile(path.join(directory,files[0]),'utf8')).synthetic,true);
 await exchange(t,{type:'action',name:'confirm_submit'});assert.equal((await readdir(directory)).length,1);
 }finally{clients.forEach(c=>c.close());if(app)await app.close();await rm(directory,{recursive:true,force:true});}
});
