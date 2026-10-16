import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocationFollower, locationOverlay, locationBounds } from '../src/features/maps/following.ts';
const fix={longitude:-84.78,latitude:43.59,accuracy:12,timestamp:100000};
const inCampus=([x,y])=>x>=-84.80&&x<=-84.74&&y>=43.56&&y<=43.62;
function fixture(){
 let state;const watchers=[];
 const controller=createLocationFollower((signal,update,fail)=>new Promise(resolve=>watchers.push({signal,update,fail,resolve})),s=>state=s,inCampus,()=>100000);
 return {controller,watchers,state:()=>state};
}
test('no location request until explicit start; stop aborts and rejects late subscriptions and fixes',async()=>{
 const f=fixture();assert.equal(f.watchers.length,0);f.controller.start();assert.equal(f.state().status,'locating');
 const w=f.watchers[0];w.update(fix);assert.equal(f.state().status,'following');f.controller.stop();
 assert.equal(w.signal.aborted,true);let removed=0;w.resolve(()=>removed++);await Promise.resolve();assert.equal(removed,1);
 w.update(fix);assert.equal(f.state().fix,null);f.controller.dispose();
});
test('restart ignores old callbacks and disposal releases the current watch',async()=>{
 const f=fixture();f.controller.start();const old=f.watchers[0];let removed=0;old.resolve(()=>removed++);await Promise.resolve();
 f.controller.start();assert.equal(removed,1);old.fail('Old failure');assert.equal(f.state().status,'locating');
 const next=f.watchers[1];next.resolve(()=>removed++);await Promise.resolve();next.update(fix);const before=f.state();f.controller.dispose();next.update({...fix,accuracy:100});assert.equal(removed,2);assert.equal(f.state(),before);
});
test('permission errors, off-campus, stale and invalid fixes clear geometry and stop watching',()=>{
 for(const patch of [{longitude:0},{latitude:NaN},{accuracy:null},{accuracy:-1},{accuracy:1001},{timestamp:69000},{timestamp:111000}]){
 const f=fixture();f.controller.start();f.watchers[0].update({...fix,...patch});assert.equal(f.state().status,'error');assert.equal(f.state().fix,null);assert.equal(f.watchers[0].signal.aborted,true);f.controller.dispose();
 }
 const f=fixture();f.controller.start();f.watchers[0].fail('Location permission was denied.');assert.match(f.state().message,/permission/);assert.equal(f.state().fix,null);f.controller.dispose();
});
test('acquisition and stale-stream deadlines stop tracking',t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const f=fixture();f.controller.start();t.mock.timers.tick(25001);assert.equal(f.state().status,'error');
 f.controller.start();f.watchers[1].update(fix);t.mock.timers.tick(59000);assert.equal(f.state().status,'following');t.mock.timers.tick(1001);assert.equal(f.state().fix,null);assert.equal(f.watchers[1].signal.aborted,true);f.controller.dispose();
});
test('approximate fixes warn, and accuracy polygons close around the reported point',()=>{
 const f=fixture();f.controller.start();f.watchers[0].update({...fix,accuracy:150});assert.match(f.state().message,/too low/);f.controller.dispose();
 const [area,point]=locationOverlay(fix);assert.equal(area.geometry.type,'Polygon');const ring=area.geometry.coordinates[0];assert.deepEqual(ring[0],ring.at(-1));assert.deepEqual(point.geometry.coordinates,[-84.78,43.59]);assert.equal(ring.length,49);
 const b=locationBounds(fix);assert.ok(b[0]<fix.longitude&&b[2]>fix.longitude&&b[1]<fix.latitude&&b[3]>fix.latitude);assert.deepEqual(locationOverlay(null),[]);assert.equal(locationBounds(null),null);
});

async function webAdapter(geolocation,secure=true) {
 const {readFileSync}=await import('node:fs'); const {default:ts}=await import('typescript'); const {runInNewContext}=await import('node:vm');
 const source=ts.transpileModule(readFileSync(new URL('../src/features/maps/watchLocation.web.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};runInNewContext(source,{exports,navigator:{geolocation},window:{isSecureContext:secure}});return exports.watchLocation;
}
test('browser watch requests bounded foreground fixes and clears the sensor on abort',async()=>{
 let callback,options,clears=0;
 const watch=await webAdapter({watchPosition(update,_fail,opts){callback=update;options=opts;return 7;},clearWatch(id){assert.equal(id,7);clears++;}});
 const abort=new AbortController();let received;
 const stop=await watch(abort.signal,p=>received=p,()=>assert.fail());
 assert.equal(options.maximumAge,10000);assert.equal(options.timeout,20000);
 callback({coords:fix,timestamp:fix.timestamp});assert.equal(received.longitude,fix.longitude);
 abort.abort();assert.equal(clears,1);stop();assert.equal(clears,1);
});
test('insecure or unavailable geolocation never starts a sensor',async()=>{
 const watch=await webAdapter({watchPosition(){assert.fail('Must not start');}},false);
 let message;await watch(new AbortController().signal,()=>assert.fail(),e=>message=e);assert.match(message,/secure/);
});
async function nativeAdapter(location) {
 const {readFileSync}=await import('node:fs');const {default:ts}=await import('typescript');const {runInNewContext}=await import('node:vm');
 const source=ts.transpileModule(readFileSync(new URL('../src/features/maps/watchLocation.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};runInNewContext(source,{exports,require:name=>{assert.equal(name,'expo-location');return location;}});return exports.watchLocation;
}
test('native cancellation during permission acquisition never starts a watch',async()=>{
 let grant;const permission=new Promise(resolve=>grant=resolve);
 const watch=await nativeAdapter({requestForegroundPermissionsAsync:()=>permission,watchPositionAsync(){assert.fail('Must not watch after cancel');}});
 const abort=new AbortController();const pending=watch(abort.signal,()=>assert.fail(),()=>assert.fail());await Promise.resolve();abort.abort();grant({granted:true});const cleanup=await pending;cleanup();
});
test('native subscription arriving after cancellation is immediately removed',async()=>{
 let resolveWatch,removed=0;const subscription=new Promise(resolve=>resolveWatch=resolve);
 const watch=await nativeAdapter({Accuracy:{High:4},requestForegroundPermissionsAsync:async()=>({granted:true}),watchPositionAsync:()=>subscription});
 const abort=new AbortController();const pending=watch(abort.signal,()=>assert.fail(),()=>assert.fail());
 for(let i=0;i<5;i++)await Promise.resolve();abort.abort();resolveWatch({remove:()=>removed++});const cleanup=await pending;cleanup();assert.equal(removed,1);
});
test('browser background and pagehide stop tracking and cleanup removes lifecycle listeners',async()=>{
 const {readFileSync}=await import('node:fs');const {default:ts}=await import('typescript');const {runInNewContext}=await import('node:vm');
 const source=ts.transpileModule(readFileSync(new URL('../src/features/maps/locationVisibility.web.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 const listeners=new Map();const target={addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
 const document={...target,visibilityState:'visible'};const exports={};runInNewContext(source,{exports,document,window:target});
 let stops=0;const cleanup=exports.onLocationHidden(()=>stops++);listeners.get('visibilitychange')();assert.equal(stops,0);
 document.visibilityState='hidden';listeners.get('visibilitychange')();assert.equal(stops,1);listeners.get('pagehide')();assert.equal(stops,2);cleanup();assert.equal(listeners.size,0);
});
