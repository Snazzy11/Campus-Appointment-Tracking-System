import assert from 'node:assert/strict';
import test from 'node:test';
import { createDestinationSearch, emptyDestination, destinationOverlay, accessibilityLabel } from '../src/features/maps/destinations.ts';
function fixture(mock) {
  mock.timers.enable({ apis: ['setTimeout'] });
  const requests=[], states=[];
  const search=createDestinationSearch((path,signal)=>new Promise((resolve,reject)=>requests.push({path,signal,resolve,reject})),state=>states.push(state));
  return {search,requests,states};
}
const flush=async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve();};
const match={id:1,name:'Fixture Hall'};
const building={type:'Feature',id:1,geometry:{type:'Polygon',coordinates:[]},properties:{name:'Fixture Hall',tags:{wheelchair:'yes'},accessibility_verified:false,association_verified:false,bounds:[-84.78,43.59,-84.779,43.591]}};
test('building search debounces two characters and escapes query text',({mock})=>{
  const {search,requests}=fixture(mock);search.change('a');mock.timers.tick(1000);assert.equal(requests.length,0);
  search.change('ab');mock.timers.tick(249);assert.equal(requests.length,0);
  search.change('  a&b  ');mock.timers.tick(250);assert.match(requests[0].path,/q=a%26b&limit=20/);search.stop();
});
test('stale searches and details cannot replace the current query',async({mock})=>{
  const {search,requests}=fixture(mock);search.change('ha');mock.timers.tick(250);search.change('lib');mock.timers.tick(250);
  assert.equal(requests[0].signal.aborted,true);
  requests[1].resolve({results:[match],has_more:false});await flush();requests[0].resolve({results:[],has_more:false});await flush();
  assert.equal(search.snapshot().results[0].id,1);
  search.select(match);search.change('new');requests[2].resolve(building);requests[3].resolve({features:[],next_after:null});await flush();
  assert.equal(search.snapshot().selected,null);search.stop();
});
test('keyboard arrows wrap, Enter selects, and Escape cancels suggestions',async({mock})=>{
  const {search,requests}=fixture(mock);search.change('hall');mock.timers.tick(250);requests[0].resolve({results:[match,{id:2,name:'Other Hall'}],has_more:false});await flush();
  assert.equal(search.key('ArrowUp'),true);assert.equal(search.snapshot().active,1);
  search.key('ArrowDown');assert.equal(search.snapshot().active,0);search.key('Enter');assert.match(requests[1].path,/buildings\/1$/);
  search.change('test');search.key('Escape');mock.timers.tick(300);assert.equal(search.snapshot().searchStatus,'idle');search.stop();
});
test('errors surface, clearing removes selection, and disposal ignores late responses',async({mock})=>{
  const {search,requests,states}=fixture(mock);search.change('hall');mock.timers.tick(250);requests[0].reject(new Error('network'));await flush();assert.equal(search.snapshot().searchStatus,'error');
  search.select(match);requests[1].resolve(building);requests[2].resolve({features:[],next_after:null});await flush();assert.equal(search.snapshot().selected.id,1);
  search.change('');assert.equal(search.snapshot().selected,null);search.select(match);search.stop();const count=states.length;
  requests[3].resolve(building);requests[4].resolve({features:[],next_after:null});await flush();assert.equal(states.length,count);
});
test('destination overlays preserve geometry and never infer accessibility verification',()=>{
  const state={...emptyDestination,selected:building,entrances:[{...building,id:2,geometry:{type:'Point',coordinates:[-84.78,43.59]}}],entranceId:2};
  const overlay=destinationOverlay(state);assert.equal(overlay.features.length,2);assert.equal(overlay.features[1].properties.selected,true);
  assert.equal(accessibilityLabel(building),'Accessibility not verified');assert.equal(destinationOverlay(emptyDestination).features.length,0);
});
test('stalled requests are aborted and detail errors do not retain a previous destination',async({mock})=>{
  const {search,requests}=fixture(mock);search.change('hall');mock.timers.tick(250);mock.timers.tick(10000);assert.equal(requests[0].signal.aborted,true);
  requests[0].reject(new Error('aborted'));await flush();assert.equal(search.snapshot().searchStatus,'error');
  search.select(match);requests[1].reject(new Error('missing'));requests[2].resolve({features:[],next_after:null});await flush();assert.equal(search.snapshot().detailStatus,'error');assert.equal(search.snapshot().selected,null);search.stop();
});
