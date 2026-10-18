// Run with Electron. Optional PAPER_SPACE_QA_ENTRY points at a packaged desktop/main.mjs.
// All data, keys and consent are confined to an isolated test directory and port.
const {app,Menu}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),data=path.join(root,'.test-data','ui-language-desktop');fs.mkdirSync(data,{recursive:true});
process.env.PAPER_SPACE_TEST_DATA=data;process.env.PAPER_SPACE_TEST_PORT='4593';
process.env.PAPER_SPACE_RUNTIME=process.env.PAPER_SPACE_RUNTIME||path.join(root,'build','runtime');
const result={passed:false,checks:[],errors:[]},sleep=ms=>new Promise(r=>setTimeout(r,ms));let win;
const timeout=setTimeout(()=>finish(Error('Native UI QA timeout')),60000);
function finish(error){clearTimeout(timeout);if(error)result.errors.push(error.stack||String(error));fs.writeFileSync(path.join(data,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));app.quit();setTimeout(()=>app.exit(result.passed?0:1),500);}
app.on('browser-window-created',(_event,window)=>{win=window;window.show=()=>{};window.webContents.setBackgroundThrottling(false);window.webContents.once('did-finish-load',()=>run().catch(finish));});
async function run(){
 const js=code=>win.webContents.executeJavaScript(code),until=async(code)=>{const end=Date.now()+20000;while(Date.now()<end){try{if(await js(code))return;}catch{}await sleep(80);}throw Error('Timeout: '+code);};
 await until("document.getElementById('usageDialog')?.open||document.getElementById('startupScreen')?.hidden");
 assert.equal(app.getPath('userData').toLowerCase(),data.toLowerCase());assert.equal((await js("fetch('/api/health').then(r=>r.json())")).version,JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version);
 if(await js("document.documentElement.lang!=='en'")){await js("document.getElementById('usageUILanguage').value='en';document.getElementById('usageUILanguage').dispatchEvent(new Event('change'))");await until("document.documentElement.lang==='en'&&document.getElementById('usageDialog')?.open");}
 await sleep(150);assert.deepEqual(Menu.getApplicationMenu().items.map(i=>i.label),['File','Edit','View','Debug','Help']);assert.equal(Menu.getApplicationMenu().items[1].submenu.items.find(i=>i.role==='redo').label,'Redo');result.checks.push('Trusted UI selection updates real Electron menus in English');
 assert.equal(JSON.parse(fs.readFileSync(path.join(data,'ui-language.json'),'utf8')).language,'en');
 const denied=await js("window.paperDesktop.setUILanguage('unsupported')");assert.equal(denied.ok,false);assert.equal(Menu.getApplicationMenu().items[0].label,'File');result.checks.push('Native language choice is persisted and unsupported IPC values are rejected');
 const error=await js("window.paperKeys.get({id:'invalid id',baseUrl:'https://example.test',format:'openai'})");assert.equal(error.ok,false);assert.equal(error.error,'Invalid endpoint ID');result.checks.push('Native credential errors use the selected UI language');
 if(await js("!!document.getElementById('usageDialog')?.open")){assert.equal(await js("document.getElementById('usageAccept').disabled"),true);await js("const c=document.getElementById('usageAcknowledge');c.checked=true;c.dispatchEvent(new Event('change'));localStorage.setItem('paper-space-seeded','1');document.getElementById('usageAccept').click()");}await until("document.getElementById('startupScreen')?.hidden");
 assert.equal(await js("document.getElementById('desktopTitlebar').hidden"),false);assert.equal(await js("getComputedStyle(document.querySelector('.library .brand')).display"),'none');assert.equal(await js("document.querySelector('#appMenu span').textContent"),'Paper Space');result.checks.push('Packaged desktop shows one English brand and preserves the consent gate');
 assert.equal((await js("fetch('/api/pdf/status').then(r=>r.json())")).available,true);result.checks.push('The offline recognition runtime remains available');
 await win.loadURL('http://127.0.0.1:4593');await until("document.getElementById('startupScreen')?.hidden");assert.equal(await js('document.documentElement.lang'),'en');assert.equal(Menu.getApplicationMenu().items[0].label,'File');result.checks.push('English UI and native menu remain selected after reloading');
 fs.writeFileSync(path.join(data,'english-native.png'),(await win.webContents.capturePage()).toPNG());result.passed=true;finish();
}
import(pathToFileURL(process.env.PAPER_SPACE_QA_ENTRY||path.join(root,'desktop','main.mjs')).href).catch(finish);
