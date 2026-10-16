import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInThisContext} from 'node:vm';
import ts from 'typescript';
import {createMapSnapshotReceiver} from '../src/features/maps/liveReports.ts';
import {createBlipLoader,emptyBlips} from '../src/features/maps/blips.ts';

test('report stream failures preserve routes; confirmed closure changes invalidate once',()=>{
  const values=[],effects=[];let callbacks;
  const react={useState(initial){const i=values.length;values.push(initial);return [initial,v=>{values[i]=typeof v==='function'?v(values[i]):v;}];},useRef:()=>({current:null}),useEffect:fn=>effects.push(fn)};
  const source=readFileSync(new URL('../src/features/maps/useBlips.ts',import.meta.url),'utf8');
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const mod={exports:{}};
  const dependencies={'react':react,'../../services/api':{api:()=>{}},'../../services/stream':{subscribe:(_path,_token,c)=>{callbacks=c;return ()=>{};}},'./blips':{createBlipLoader,emptyBlips},'./liveReports':{createMapSnapshotReceiver}};
  runInThisContext('(function(require,module,exports){'+js+'})')(name=>dependencies[name],mod,mod.exports);
  mod.exports.useBlips();const cleanup=effects[0]();
  try {
    for(let i=0;i<5;i++)callbacks.onError(new Error('503'));
    callbacks.onEvent({event:'map_unavailable',data:'{}'});
    assert.equal(values[2],0);
    const snapshot=version=>callbacks.onEvent({event:'map_snapshot',data:JSON.stringify({reports:emptyBlips,routing_version:version})});
    snapshot('a');callbacks.onError(new Error('disconnected'));snapshot('a');
    assert.equal(values[2],0);
    snapshot('b');snapshot('b');assert.equal(values[2],1);
    assert.equal(values[0].error,'');
  } finally {cleanup();}
});
