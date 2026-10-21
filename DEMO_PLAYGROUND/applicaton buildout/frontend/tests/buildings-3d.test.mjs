import test from 'node:test';
import assert from 'node:assert/strict';
import {heightMeters,buildingVolumes,createBuildingsLoader} from '../src/features/maps/buildings3d.ts';
import {plainMapStyle} from '../src/features/maps/plainMapStyle.ts';
const feature=(id,tags)=>({id,type:'Feature',geometry:{type:'Polygon',coordinates:[[[-84.78,43.59],[-84.779,43.59],[-84.779,43.591],[-84.78,43.59]]]},properties:{name:'Fixture',tags}});
test('heights require explicit valid dimensions; floor counts and malformed values never invent volumes',()=>{
 assert.equal(heightMeters('12 m'),12);assert.equal(heightMeters('10ft'),3.048);assert.equal(heightMeters('20'),20);
 for(const value of [undefined,'','NaN','Infinity','12;15','-2','0','301','10 floors','12m tall'])assert.equal(heightMeters(value),null);
 const data=buildingVolumes({features:[feature(1,{'building:levels':'9'}),feature(2,{height:'20',min_height:'3'}),feature(3,{height:'20',min_height:'30'})],next_after:null});
 assert.deepEqual(data.features.map(f=>[f.properties.height,f.properties.base]),[[0,0],[20,3],[0,0]]);
});
test('optional building data is lazy, bounded by timeout, cancelled in 2D and ignores late replies',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let state;const jobs=[];
 const loader=createBuildingsLoader(signal=>new Promise(resolve=>jobs.push({signal,resolve})),s=>state=s);assert.equal(jobs.length,0);
 const load=loader.enable();loader.disable();assert.equal(jobs[0].signal.aborted,true);jobs[0].resolve({features:[feature(1,{height:'20'})],next_after:null});await load;assert.equal(state.enabled,false);assert.equal(state.data.features.length,0);
 void loader.enable();t.mock.timers.tick(10001);assert.equal(state.enabled,false);assert.match(state.message,/timed out/);assert.equal(jobs[1].signal.aborted,true);loader.dispose();
});
test('successful loading reports missing coverage; errors fall back to 2D; disposal suppresses state writes',async()=>{
 let state,fail=false;const loader=createBuildingsLoader(async()=>{if(fail)throw Error();return {features:[feature(1,{}),feature(2,{height:'20'})],next_after:4};},s=>state=s);
 await loader.enable();assert.equal(state.enabled,true);assert.match(state.message,/1 of 2/);assert.match(state.message,/first 500/);
 fail=true;await loader.enable();assert.equal(state.enabled,false);assert.equal(state.status,'error');loader.dispose();const before=state;await loader.enable();assert.equal(state,before);
});
test('provider-inferred extrusions are removed while all ordinary map layers are preserved',()=>{
 const original={version:8,sources:{},layers:[{id:'ground',type:'background'},{id:'inferred',type:'fill-extrusion'},{id:'labels',type:'symbol'}]};
 assert.deepEqual(plainMapStyle(original).layers.map(l=>l.id),['ground','labels']);assert.equal(original.layers.length,3);
});
test('web optional layers restore after style changes and release sources/listeners on return to 2D',async()=>{
 const {readFileSync}=await import('node:fs');const {default:ts}=await import('typescript');const {runInNewContext}=await import('node:vm');
 const source=ts.transpileModule(readFileSync(new URL('../src/features/maps/BuildingsLayer.web.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 let effect;const exports={};const definitions=[{id:'campus-3d-flat',type:'fill'},{id:'campus-3d-volumes',type:'fill-extrusion'}];
 runInNewContext(source,{exports,require:name=>name==='react'?{useEffect:fn=>effect=fn}:{buildingLayers:definitions}});
 const layers=new Map([['campus-location-accuracy',{}]]),sources=new Map(),events=new Map();let selected;
 const map={getSource:id=>sources.get(id),addSource:(id,value)=>sources.set(id,{...value,setData(data){this.data=data;}}),getLayer:id=>layers.get(id),addLayer:(layer,before)=>{assert.equal(before,'campus-location-accuracy');layers.set(layer.id,layer);},on:(event,fn)=>events.set(event,fn),off:event=>events.delete(event),isStyleLoaded:()=>true,removeLayer:id=>layers.delete(id),removeSource:id=>sources.delete(id),queryRenderedFeatures:()=>[{properties:{buildingId:7}}]};
 exports.BuildingsLayer({map,data:{type:'FeatureCollection',features:[]},onSelect:id=>selected=id,onFailure:()=>assert.fail()});const cleanup=effect();assert.equal(sources.size,1);events.get('click')({point:{x:1,y:2}});assert.equal(selected,7);
 layers.delete('campus-3d-flat');layers.delete('campus-3d-volumes');sources.clear();events.get('style.load')();assert.equal(sources.size,1);cleanup();assert.equal(sources.size,0);assert.equal(events.size,0);assert.deepEqual([...layers.keys()],['campus-location-accuracy']);
});
