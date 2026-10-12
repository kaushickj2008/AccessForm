import {createEngine} from './engine.js';
export class InProcessTransport {
  constructor({forms,onSubmit}={}){this.callbacks=new Set();this.engine=createEngine({forms,onSubmit,onMessage:message=>this.callbacks.forEach(cb=>cb(message))});}
  send(message){return this.engine.send(message);}
  onMessage(callback){this.callbacks.add(callback);return()=>this.callbacks.delete(callback);}
  close(){this.callbacks.clear();}
}
export class WebSocketTransport {
  constructor(url){this.callbacks=new Set();this.queue=[];this.socket=new WebSocket(url);this.socket.addEventListener('open',()=>{this.queue.splice(0).forEach(m=>this.socket.send(JSON.stringify(m)));});this.socket.addEventListener('message',event=>{try{const m=JSON.parse(event.data);this.callbacks.forEach(cb=>cb(m));}catch{/* Ignore malformed transport frames. */}});}
  send(message){if(this.socket.readyState===1)this.socket.send(JSON.stringify(message));else if(this.socket.readyState===0)this.queue.push(message);else throw new Error('Local connection is closed. Reload the page.');}
  onMessage(callback){this.callbacks.add(callback);return()=>this.callbacks.delete(callback);}
  close(){this.socket.close();this.callbacks.clear();}
}
