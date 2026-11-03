import test from 'node:test';
import assert from 'node:assert/strict';
import {platformShortcuts,applyPlatformUI,updateVersion} from '../public/platform-ui.mjs';
import {formatUI} from '../public/ui-language.mjs';
import {desktopMenu} from '../desktop/menu.mjs';

test('Mac desktop and browser platforms show Command/Option hints; Windows and Linux retain Control/Alt',()=>{
 for(const platform of ['darwin','MacIntel','macOS']){const k=platformShortcuts(platform);assert.equal(k.find,'⌘ K');assert.equal(k.focusKey,'Meta+Shift+F');assert.equal(k.pages,'⌥ ← / →');}
 for(const platform of ['win32','Win32','Linux x86_64','']){assert.equal(platformShortcuts(platform).find,'Ctrl K');assert.equal(platformShortcuts(platform).findKey,'Control+K');}
});

test('Platform hints update only marked app controls and use localized, validated version metadata',()=>{
 const controls=Object.fromEntries(['findBtn','focusBtn','appVersion'].map(id=>[id,{textContent:'',dataset:{},setAttribute(key,value){this[key]=value;}}]));
 const hint={dataset:{shortcut:'find'},textContent:'Ctrl K'};
 const root={body:{classList:{toggle(){}}},querySelectorAll:()=>[hint],getElementById:id=>controls[id]};
 applyPlatformUI(root,{platform:'darwin',translate:(...args)=>formatUI(args[0],'en',...args.slice(1))});
 assert.equal(hint.textContent,'⌘ K');assert.equal(controls.findBtn.title,'Quick find · ⌘ K');assert.equal(controls.focusBtn['aria-keyshortcuts'],'Meta+Shift+F');
 const translate=(...args)=>formatUI(args[0],'en',...args.slice(1));
 updateVersion(root,'1.3.7',{desktop:true,translate});assert.equal(controls.appVersion.textContent,'Desktop 1.3.7');assert.equal(controls.appVersion.dataset.version,'1.3.7');
 updateVersion(root,'<script>bad</script>',{desktop:true,translate});assert.equal(controls.appVersion.textContent,'Desktop 1.3.7');
});

test('Mac menu localizes native actions and retains the same reading shell actions as Windows',()=>{
 const actions={about(){},debug(){},reopen(){},tools(){},source(){},data(){},logs(){},restart(){}};
 const mac=desktopMenu({platform:'darwin',name:'Paper Space',t:key=>formatUI(key,'zh-CN'),actions});
 assert.equal(mac[0].role,'appMenu');assert.equal(mac[0].submenu.find(i=>i.role==='quit').accelerator,'Command+Q');
 assert.equal(mac.find(i=>i.role==='windowMenu').label,'窗口');assert.equal(mac.find(i=>i.role==='windowMenu').submenu[0].click,actions.reopen);
 assert.equal(mac.find(i=>i.label==='调试').submenu[0].accelerator,'Command+Alt+I');
 const en=desktopMenu({platform:'darwin',name:'Paper Space',t:key=>formatUI(key,'en'),actions});assert.equal(en.find(i=>i.role==='windowMenu').label,'Window');
 const win=desktopMenu({platform:'win32',name:'Paper Space',t:key=>key,actions});
 assert.equal(win[0].label,'文件');assert.equal(win[0].submenu[0].accelerator,'Alt+F4');assert.equal(win.find(i=>i.label==='调试').submenu[0].accelerator,'F12');assert.ok(!win.some(i=>i.role==='windowMenu'));
});
