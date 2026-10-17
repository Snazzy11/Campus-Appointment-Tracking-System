import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInThisContext} from 'node:vm';
import ts from 'typescript';
import {createSseParser} from '../src/services/sse-parser.ts';
class ApiError extends Error {constructor(status,message){super(message);this.status=status;}}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function transport(fetch){
 const source=readFileSync(new URL('../src/services/stream.ts',import.meta.url),'utf8');
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const mod={exports:{}};
 runInThisContext('(function(require,module,exports){'+js+'})')(name=>name==='expo/fetch'?{fetch}:name==='./api'?{API_URL:'http://fixture',ApiError,sessionHeaders:()=>({})}:{createSseParser},mod,mod.exports);
 return mod.exports.subscribe;
}
test('SSE reconnects after interruption and cleanup prevents additional retries',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 let attempts=0,events=0,errors=0,finish;
 const subscribe=transport(async()=>{
   if(++attempts===1)throw Error('offline');
   let first=true;
   return {ok:true,body:{getReader:()=>({read:()=>first?(first=false,Promise.resolve({done:false,value:new TextEncoder().encode('event: map_snapshot\ndata: {}\n\n')})):new Promise(r=>finish=r),cancel:async()=>finish?.({done:true})})}};
 });
 const stop=subscribe('/stream',null,{onOpen(){},onEvent(){events++;},onError(){errors++;}});
 await tick();assert.equal(errors,1);
 t.mock.timers.tick(2001);await tick();assert.equal(attempts,2);assert.equal(events,1);
 stop();await tick();t.mock.timers.tick(10000);await tick();assert.equal(attempts,2);
});
test('SSE deadline aborts stalls; revoked permissions do not retry',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 let errors=0;
 const subscribe=transport((_,options)=>new Promise((_,reject)=>options.signal.addEventListener('abort',()=>reject(Error('aborted')))));
 const stop=subscribe('/stream',null,{idleTimeoutMs:30000,onOpen(){},onEvent(){},onError(){errors++;}});
 t.mock.timers.tick(30001);await tick();assert.equal(errors,1);stop();
 let attempts=0;
 const denied=transport(async()=>{attempts++;return {ok:false,status:403};});
 const stopDenied=denied('/stream',null,{onOpen(){},onEvent(){},onError(){}});
 await tick();t.mock.timers.tick(10000);await tick();assert.equal(attempts,1);stopDenied();
});
