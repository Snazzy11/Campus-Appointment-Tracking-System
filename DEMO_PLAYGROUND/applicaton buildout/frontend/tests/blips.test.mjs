import test from 'node:test';
import assert from 'node:assert/strict';
import {createBlipLoader} from '../src/features/maps/blips.ts';
const collection={type:'FeatureCollection',features:[{type:'Feature',geometry:{type:'Point',coordinates:[-84.78,43.59]},properties:{expires_at:'2026-10-14T00:00:00Z'}}]};
test('reports expire locally and refresh failure removes stale markers',async()=>{
 let state, fail=false;
 const loader=createBlipLoader(async()=>{if(fail)throw Error();return collection;},s=>state=s);
 await loader.refresh(); assert.equal(state.data.features.length,1);
 loader.expire(Date.parse('2026-10-14T00:01:00Z')); assert.equal(state.data.features.length,0);
 await loader.refresh(); fail=true; await loader.refresh();
 assert.equal(state.data.features.length,0);assert.match(state.error,/unavailable/);
 loader.stop();
});
test('late report loads cannot overwrite newer results or disposed screens',async()=>{
 const jobs=[];let state,updates=0;
 const loader=createBlipLoader(signal=>new Promise(resolve=>jobs.push({signal,resolve})),s=>{state=s;updates++;});
 const one=loader.refresh(),two=loader.refresh();
 assert.equal(jobs[0].signal.aborted,true);
 jobs[1].resolve(collection);await two;
 jobs[0].resolve({type:'FeatureCollection',features:[]});await one;
 assert.equal(state.data.features.length,1);
 const three=loader.refresh();loader.stop();const count=updates;
 jobs[2].resolve(collection);await three;assert.equal(updates,count);
});
test('report requests are bounded by a timeout',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let signal;
 const loader=createBlipLoader(s=>{signal=s;return new Promise(()=>{});},()=>{});
 void loader.refresh();t.mock.timers.tick(10001);assert.equal(signal.aborted,true);loader.stop();
});

test('report pin coordinates must remain finite and inside the campus boundary',async()=>{
 const {validReportPoint}=await import('../src/features/maps/reportPoint.ts');
 assert.equal(validReportPoint([-84.78,43.59]),true);
 for(const p of [[0,0],[NaN,43.59],[-84.78,Infinity],[-84.81,43.59],[-84.78,43.63]])assert.equal(validReportPoint(p),false);
});

test('moderation validates the moderator reason separately from the report description',async()=>{
 const {moderationProblem}=await import('../src/features/maps/liveReports.ts');
 assert.match(moderationProblem(''),/separate from the report description/);
 assert.match(moderationProblem('  short  '),/10 characters/);
 assert.equal(moderationProblem('Inspected the site and confirmed the report.'),'');
});
test('live snapshots replace state, ignore duplicate delivery and invalidate changed routes',async()=>{
 const {createMapSnapshotReceiver}=await import('../src/features/maps/liveReports.ts');
 const updates=[];
 const receive=createMapSnapshotReceiver((s,changed)=>updates.push({s,changed}));
 const data=JSON.stringify({reports:collection,routing_version:'a'});
 receive(data);receive(data);assert.equal(updates.length,1);assert.equal(updates[0].changed,false);
 receive(JSON.stringify({reports:{type:'FeatureCollection',features:[]},routing_version:'b'}));
 assert.equal(updates[1].changed,true);assert.equal(updates[1].s.reports.features.length,0);
 assert.throws(()=>receive('{}'),/Invalid map snapshot/);
});

test('nearby closure selection excludes distant and invalid distances and previews selected geometry',async()=>{
 const {nearbyPathIds,closurePreview}=await import('../src/features/maps/pathReview.ts');
 const paths=[0,10,10.001,50,NaN,-1].map((distance_m,i)=>({id:i+1,distance_m,length_m:20,geometry:{type:'LineString',coordinates:[[0,0],[1,1]]}}));
 assert.deepEqual(nearbyPathIds(paths),[1,2]);
 const preview=closurePreview(paths,[2]);assert.equal(preview.length,1);assert.equal(preview[0].properties.kind,'closure-preview');assert.deepEqual(preview[0].geometry,paths[1].geometry);
});
