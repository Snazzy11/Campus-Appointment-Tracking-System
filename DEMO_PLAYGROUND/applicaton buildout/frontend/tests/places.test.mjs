import test from 'node:test';
import assert from 'node:assert/strict';
import {readPlaces,addPlace} from '../src/features/maps/places.ts';
test('corrupt or malformed device records are discarded',()=>{
 for(const raw of ['broken','null','[]','{}'])assert.deepEqual(readPlaces(raw),{recent:[],saved:[]});
 assert.deepEqual(readPlaces(JSON.stringify({saved:[{id:-1,name:'Bad'},{id:2,name:'Valid',latitude:43}]})),{recent:[],saved:[{id:2,name:'Valid'}]});
});
test('recent destinations are bounded, deduplicated and exclude position data',()=>{
 let places=[];for(let id=1;id<=8;id++)places=addPlace(places,{id,name:'Building '+id,latitude:43});
 assert.deepEqual(places.map(p=>p.id),[8,7,6,5,4]);
 places=addPlace(places,{id:5,name:'Renamed'});assert.deepEqual(places.map(p=>p.id),[5,8,7,6,4]);assert.equal(places[0].latitude,undefined);
});
