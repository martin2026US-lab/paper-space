// Native Mac regression checks. All documents and credentials are synthetic.
const {app,Menu,dialog}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
if(process.platform!=='darwin')throw Error('Run this suite on macOS.');
const root=path.resolve(__dirname,'..'),data=path.join(root,'.test-data','mac-desktop-'+Date.now());fs.mkdirSync(data,{recursive:true});
process.env.PAPER_SPACE_TEST_DATA=data;process.env.PAPER_SPACE_TEST_PORT='4598';
const result={passed:false,checks:[],errors:[]};let win,started=false,finishing=false;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));const timeout=setTimeout(()=>finish(Error('Mac desktop timeout')),65000);
function finish(error){if(finishing)return;finishing=true;clearTimeout(timeout);if(error)result.errors.push(error.stack||String(error));fs.writeFileSync(path.join(root,'.test-data','mac-desktop-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));app.quit();setTimeout(()=>app.exit(result.passed?0:1),600);}
app.on('browser-window-created',(_e,window)=>{win=window;window.show=()=>{};window.webContents.setBackgroundThrottling(false);if(!started){started=true;window.webContents.once('did-finish-load',()=>run().catch(finish));}});
async function until(check){const end=Date.now()+20000;while(Date.now()<end){try{if(await check())return;}catch{}await sleep(80);}throw Error('Timed out waiting for Mac UI');}
async function run(){
 const js=code=>win.webContents.executeJavaScript(code);
 await until(()=>js("document.getElementById('usageDialog')?.open"));
 await js("localStorage.setItem('paper-space-seeded','1');const c=document.getElementById('usageAcknowledge');c.checked=true;c.dispatchEvent(new Event('change'));document.getElementById('usageAccept').click()");
 await until(()=>js("document.getElementById('startupScreen')?.hidden"));
 assert.equal(await js('window.paperDesktop.platform'),'darwin');assert.equal(await js("document.body.classList.contains('platform-macos')"),true);
 assert.ok(await js("parseFloat(getComputedStyle(document.getElementById('desktopTitlebar')).paddingLeft)>=80"));
 assert.deepEqual(win.getWindowButtonPosition(),{x:14,y:12});
 const menus=Menu.getApplicationMenu().items;assert.equal(menus[0].role.toLowerCase(),'appmenu');assert.ok(menus.some(item=>item.role==='windowmenu'));
 assert.equal(menus.find(item=>item.role==='windowmenu').label,'窗口');
 assert.equal(menus[0].submenu.items.find(item=>item.role==='quit').accelerator,'Command+Q');
 assert.equal(await js("document.querySelector('#findBtn kbd').textContent"),'⌘ K');
 assert.equal(await js("document.getElementById('focusBtn').getAttribute('aria-keyshortcuts')"),'Meta+Shift+F');
 const version=JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version;
 await until(()=>js(`document.getElementById('appVersion').textContent.includes(${JSON.stringify(version)})`));
 result.checks.push('Localized native menus, Mac shortcut hints, accessibility hints and accurate version');
 await js("localStorage.setItem('paper-space-ui-language','en');location.reload()");
 await until(()=>js("document.getElementById('startupScreen')?.hidden"));
 await until(()=>Menu.getApplicationMenu().items.some(item=>item.role==='windowmenu'&&item.label==='Window'));
 assert.equal(await js("document.querySelector('#findBtn kbd').textContent"),'⌘ K');
 await until(()=>js(`document.getElementById('appVersion').textContent==='Desktop '+${JSON.stringify(version)}`));
 result.checks.push('English UI reload retains Mac shortcuts and localizes the native menu');
 const credential={id:'mac-qa',baseUrl:'http://127.0.0.1:4598',format:'openai',key:'synthetic-macos-key'};
 assert.equal((await js('window.paperKeys.status()')).available,true);
 assert.equal((await js(`window.paperKeys.set(${JSON.stringify(credential)})`)).saved,true);
 assert.equal((await js(`window.paperKeys.get(${JSON.stringify(credential)})`)).key,credential.key);
 assert.equal((await js(`window.paperKeys.clear(${JSON.stringify(credential)})`)).saved,false);
 result.checks.push('Keychain-backed synthetic key save/read/clear through isolated IPC');
 const bytes=fs.readFileSync(path.join(root,'tests','cross-page-fixture.pdf'));
 await js(`(()=>{const transfer=new DataTransfer();transfer.items.add(new File([Uint8Array.from(atob(${JSON.stringify(bytes.toString('base64'))}),c=>c.charCodeAt(0))],'mac-fixture.pdf',{type:'application/pdf'}));const input=document.getElementById('fileInput');input.files=transfer.files;input.dispatchEvent(new Event('change'));})()`);
 await until(()=>js("document.querySelector('.pdf-page canvas')?.width>0&&document.querySelectorAll('.textLayer span').length>0"));
 assert.ok((await js("fetch('/api/health').then(r=>r.json())")).version===JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version);
 result.checks.push('Real PDF canvas, selectable text and bundled frontend assets');
 fs.writeFileSync(path.join(root,'.test-data','mac-desktop.png'),(await win.webContents.capturePage()).toPNG());
 const old=win;await new Promise(resolve=>{old.once('closed',resolve);old.close();});
 await sleep(100);assert.equal(app.isReady(),true);assert.equal(old.isDestroyed(),true);
 const originalDialog=dialog.showMessageBox;let aboutWithoutWindow=false;
 dialog.showMessageBox=(...args)=>{assert.equal(args.length,1);aboutWithoutWindow=true;return Promise.resolve({response:0});};
 try{await Menu.getApplicationMenu().items[0].submenu.items[0].click();assert.equal(aboutWithoutWindow,true);}finally{dialog.showMessageBox=originalDialog;}
 Menu.getApplicationMenu().items.find(item=>item.role==='windowmenu').submenu.items[0].click();
 await until(()=>win!==old&&!win.isDestroyed());await until(()=>js("document.getElementById('startupScreen')?.hidden"));
 assert.equal(await js("!!document.getElementById('usageDialog')?.open"),false);
 result.checks.push('Closing the window keeps menus usable; About works without a window and Window menu restores persisted consent');
 result.passed=true;finish();
}
import(pathToFileURL(process.env.PAPER_SPACE_QA_ENTRY||path.join(root,'desktop','main.mjs')).href).catch(finish);
