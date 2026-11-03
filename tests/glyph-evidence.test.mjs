import test from 'node:test';
import assert from 'node:assert/strict';
import {editionFor} from '../public/reading-edition.mjs';
import {readingEvidence} from '../public/reading-evidence.mjs';
import {translationText} from '../public/reading-text.mjs';
const box={page:1,x:20,y:40,right:250,bottom:80,pageWidth:600,pageHeight:800};
const make=(normalized)=>({fileFingerprint:'source',pages:1,blocks:[],readingLayout:{blocks:[{sourceRef:'p',kind:'text',text:'old raw'}],normalizedBlocks:normalized,quality:{version:'reading-quality-v2',events:[],uncertain:[]}}});
test('typography survives model serialization without changes to the preserved source',()=>{
 const d=make([{sourceRef:'p',sourceRefs:['p'],kind:'text',text:'Zoë 177Lu BPnd',textRuns:[{text:'Zoë '},{text:'177',script:'sup'},{text:'Lu BP'},{text:'nd',script:'sub'}],evidenceText:'Zoë ^{177}Lu BP_{nd}',boxes:[box]}]),before=structuredClone(d),u=editionFor(d).units[0];
 assert.equal(translationText(u),'Zoë ^{177}Lu BP_{nd}');assert.equal(readingEvidence(d)[0].text,translationText(u));assert.equal(u.textRuns[1].script,'sup');assert.deepEqual(d,before);
});
test('uncertain glyphs retain original crops and no candidate transcript reaches the assistant',()=>{
 const d=make([{sourceRef:'p',kind:'text',text:'',rawText:'bad\u0013name',candidateText:'Never send this',visualOnly:true,glyphFallback:true,textRuns:[],evidenceText:'[字符待核对，保留原图]',boxes:[box],visualBoxes:[box]}]);
 const u=editionFor(d).units[0];assert.equal(u.visual,true);assert.equal(u.glyphFallback,true);assert.equal(u.text,'');assert.doesNotMatch(JSON.stringify(readingEvidence(d)),/Never send|bad/);
});
