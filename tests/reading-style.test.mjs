import test from 'node:test';import assert from 'node:assert/strict';
import {loadReadingStyle,saveReadingStyle,loadMagazineLayout,READING_STYLE_KEY} from '../public/reading-style.mjs';
import {createBackup,readBackup,mergeBackupSettings} from '../public/backup.mjs';
const storage=values=>{const map=new Map(Object.entries(values));return{getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value)};};
test('Reading-style preferences preserve an existing classic installation and tolerate unavailable storage',()=>{
 const saved=storage({'paper-space-models':'keep','paper-space-layout':'{"focus":false,"assistant":true}'});assert.equal(loadReadingStyle(saved),'classic');assert.equal(saveReadingStyle(saved,'magazine'),true);assert.equal(loadReadingStyle(saved),'magazine');assert.equal(saved.getItem('paper-space-models'),'keep');assert.equal(saved.getItem('paper-space-layout'),'{"focus":false,"assistant":true}');assert.equal(loadReadingStyle({getItem(){throw Error('denied');}}),'classic');assert.equal(saveReadingStyle(null,'magazine'),false);assert.deepEqual(loadMagazineLayout(saved),{focus:false,assistant:false});
});
test('Portable backups include both style preferences and never replace the destination reading style during merge',async()=>{
 const origin=storage({[READING_STYLE_KEY]:'magazine','paper-space-magazine-layout':'{"assistant":true,"focus":false,"secret":"discard"}','paper-space-layout':'{"assistant":false,"focus":true}'}),archive=await readBackup(await createBackup([],origin));assert.equal(archive.settings[READING_STYLE_KEY],'magazine');assert.deepEqual(JSON.parse(archive.settings['paper-space-magazine-layout']),{focus:false,assistant:true});
 const target=storage({[READING_STYLE_KEY]:'classic','paper-space-magazine-layout':'{"assistant":false,"focus":false}'}),changes=mergeBackupSettings(target,archive.settings);assert.equal(changes[READING_STYLE_KEY],undefined);assert.equal(changes['paper-space-magazine-layout'],undefined);assert.equal(target.getItem(READING_STYLE_KEY),'classic');
});
