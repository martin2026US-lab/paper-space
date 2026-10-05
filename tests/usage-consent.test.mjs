import test from 'node:test';
import assert from 'node:assert/strict';
import {CONSENT_KEY,CONSENT_VERSION,hasUsageConsent,saveUsageConsent} from '../public/usage-consent.mjs';
const storage=()=>{const m=new Map();return{getItem:key=>m.get(key)||null,setItem:(key,value)=>m.set(key,value)};};
test('first launch and changed notice require fresh explicit consent',()=>{
  const s=storage();assert.equal(hasUsageConsent(s),false);
  for(const value of ['broken','null',JSON.stringify({version:'old',accepted:true,acceptedAt:1}),JSON.stringify({version:CONSENT_VERSION,accepted:false,acceptedAt:1}),JSON.stringify({version:CONSENT_VERSION,accepted:true})]){s.setItem(CONSENT_KEY,value);assert.equal(hasUsageConsent(s),false);}
  assert.equal(saveUsageConsent(s,12345),true);assert.equal(hasUsageConsent(s),true);
  assert.deepEqual(JSON.parse(s.getItem(CONSENT_KEY)),{version:CONSENT_VERSION,accepted:true,acceptedAt:12345});
});
test('unavailable local storage does not silently count as consent',()=>{
  const blocked={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}};
  assert.equal(hasUsageConsent(blocked),false);assert.equal(saveUsageConsent(blocked),false);assert.equal(hasUsageConsent(null),false);
});
