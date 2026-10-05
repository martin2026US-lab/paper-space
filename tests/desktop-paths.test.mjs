import test from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {desktopPaths} from '../desktop/paths.mjs';

test('installed data is stable across installation upgrades and separate from bundled runtime',()=>{
  const common={packaged:true,appData:join('user','appdata')};
  const a=desktopPaths({...common,sourceRoot:'install-v1',resourcesPath:join('install-v1','resources')});
  const b=desktopPaths({...common,sourceRoot:'install-v2',resourcesPath:join('install-v2','resources')});
  assert.equal(a.dataRoot,b.dataRoot);
  assert.equal(a.dataRoot,join('user','appdata','PaperSpace'));
  assert.equal(b.runtimeRoot,join('install-v2','resources','runtime'));
});
test('source development keeps data and runtime within the checkout',()=>{
  assert.deepEqual(desktopPaths({packaged:false,sourceRoot:'checkout',resourcesPath:'electron',appData:'user'}),{
    dataRoot:join('checkout','data'),runtimeRoot:join('checkout','runtime'),
  });
});
