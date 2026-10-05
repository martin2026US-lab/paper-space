import {app,BrowserWindow,Menu,dialog,screen,shell,safeStorage,ipcMain} from 'electron';
import {createKeyStore,trustedSender} from './key-store.mjs';
import {createChatStore,chatSnapshot} from './chat-store.mjs';
import {mkdirSync,appendFileSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from '../server.mjs';

const sourceRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const portableRoot=app.isPackaged?dirname(process.execPath):sourceRoot;
const testRoot=process.env.PAPER_SPACE_TEST_DATA;
if(testRoot&&!process.env.PAPER_SPACE_TEST_PORT)throw new Error('隔离测试必须指定独立端口');
const dataRoot=testRoot?resolve(testRoot):join(portableRoot,'data');
const logRoot=join(dataRoot,'logs');
const boundsFile=join(dataRoot,'window.json');
const port=Number(process.env.PAPER_SPACE_TEST_PORT)||4319;
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('无效本机端口');
if(testRoot){const target=dataRoot.toLowerCase();const forbidden=['data','runtime'].map(name=>resolve(portableRoot,name).toLowerCase());if(port===4319||forbidden.some(p=>target===p||target.startsWith(p+'\\')))throw new Error('隔离测试不得使用正式资料目录或端口');}
const origin=`http://127.0.0.1:${port}`;
const debugMode=process.argv.includes('--debug');
let mainWindow,server,quitting=false;

mkdirSync(logRoot,{recursive:true});
app.setName('纸间');
app.setPath('userData',dataRoot);
app.setPath('sessionData',join(dataRoot,'session'));
mkdirSync(app.getPath('sessionData'),{recursive:true});
app.enableSandbox();

// Diagnostic events only. Never log prompts, documents, response text or API keys.
function log(event,details='') {
  try{appendFileSync(join(logRoot,'desktop.log'),`${new Date().toISOString()} ${event}${details?' '+details:''}\n`);}catch{}
}
function saveWindow() {
  if(!mainWindow||mainWindow.isDestroyed())return;
  try{const bounds=mainWindow.getNormalBounds();writeFileSync(boundsFile,JSON.stringify({width:bounds.width,height:bounds.height,maximized:mainWindow.isMaximized()}));}catch{}
}
function initialWindow() {
  const area=screen.getPrimaryDisplay().workAreaSize;
  let stored={};try{stored=JSON.parse(readFileSync(boundsFile,'utf8'));}catch{}
  const width=Math.min(area.width,Math.max(Math.min(1040,area.width),Number(stored.width)||1540));
  const height=Math.min(area.height,Math.max(Math.min(650,area.height),Number(stored.height)||980));
  return{width,height,maximized:!!stored.maximized};
}
function openFolder(path) { shell.openPath(path).then(error=>{if(error)dialog.showErrorBox('无法打开目录',error);}); }
function toggleTools() {
  if(!mainWindow||mainWindow.isDestroyed())return;
  if(mainWindow.webContents.isDevToolsOpened())mainWindow.webContents.closeDevTools();
  else mainWindow.webContents.openDevTools({mode:'detach'});
}
function setupMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {label:'文件',submenu:[{label:'退出纸间',role:'quit',accelerator:'Alt+F4'}]},
    {label:'编辑',submenu:[{label:'撤销',role:'undo'},{label:'重做',role:'redo'},{type:'separator'},{label:'剪切',role:'cut'},{label:'复制',role:'copy'},{label:'粘贴',role:'paste'},{label:'全选',role:'selectAll'}]},
    {label:'视图',submenu:[{label:'刷新界面',role:'reload',accelerator:'CommandOrControl+R'},{label:'忽略缓存并刷新',role:'forceReload',accelerator:'CommandOrControl+Shift+R'},{type:'separator'},{label:'放大',role:'zoomIn'},{label:'缩小',role:'zoomOut'},{label:'恢复缩放',role:'resetZoom'},{type:'separator'},{label:'全屏',role:'togglefullscreen',accelerator:'F11'}]},
    {label:'调试',submenu:[{label:'开发者工具',accelerator:'F12',click:toggleTools},{label:'打开界面源码目录',click:()=>openFolder(join(sourceRoot,'public'))},{label:'打开应用数据目录',click:()=>openFolder(dataRoot)},{label:'打开诊断日志目录',click:()=>openFolder(logRoot)},{type:'separator'},{label:'重启应用',click:()=>{app.relaunch();app.quit();}}]},
    {label:'帮助',submenu:[{label:'调试说明',click:()=>dialog.showMessageBox(mainWindow,{type:'info',title:'纸间 · 调试说明',message:'F12 打开开发者工具；Ctrl+R 刷新界面。',detail:'修改 public/app.mjs、style.css 或 index.html 后刷新即可。修改 server.mjs 或 desktop/main.mjs 后，通过“调试 → 重启应用”重新加载。\n\n数据保存在程序目录的 data 文件夹。API Key 可在设置中选择由 Windows 系统加密记住，并可按接口清除。'})},{label:'关于纸间',click:()=>dialog.showMessageBox(mainWindow,{type:'info',title:'关于纸间',message:`纸间 ${app.getVersion()} · 本机论文阅读工作台`,detail:`Electron ${process.versions.electron}\n无需登录。文件在本机解析；AI 功能使用你配置的接口。\n\n这是可调试的便携开发版。`})}]},
  ]));
}
async function createWindow() {
  const size=initialWindow();
  mainWindow=new BrowserWindow({
    width:size.width,height:size.height,minWidth:840,minHeight:600,
    title:'纸间 · Paper Space',show:false,backgroundColor:'#e9ddc8',titleBarStyle:'hidden',titleBarOverlay:{color:'#ece0cb',symbolColor:'#574126',height:38},autoHideMenuBar:true,
    icon:join(sourceRoot,'desktop','icon.png'),
    webPreferences:{preload:join(sourceRoot,'desktop','preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,devTools:true},
  });
  mainWindow.setMenu(null);
  mainWindow.webContents.on('before-input-event',(event,input)=>{if(input.type!=='keyDown')return;if(input.key==='F12'){event.preventDefault();toggleTools();}else if(input.control&&input.key.toLowerCase()==='r'){event.preventDefault();input.shift?mainWindow.webContents.reloadIgnoringCache():mainWindow.webContents.reload();}});
  // Documents cannot navigate the app or grant OS capabilities.
  mainWindow.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  mainWindow.webContents.on('will-navigate',(event,url)=>{try{if(new URL(url).origin!==origin)event.preventDefault();}catch{event.preventDefault();}});
  mainWindow.webContents.on('will-attach-webview',event=>event.preventDefault());
  mainWindow.webContents.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
  mainWindow.webContents.session.setPermissionCheckHandler(()=>false);
  mainWindow.webContents.on('did-fail-load',(_event,code)=>log('page-load-failed',String(code)));
  mainWindow.webContents.on('render-process-gone',(_event,details)=>log('renderer-ended',details.reason));
  mainWindow.webContents.on('devtools-opened',()=>log('devtools-opened'));
  mainWindow.webContents.on('devtools-closed',()=>log('devtools-closed'));
  mainWindow.on('close',saveWindow);
  mainWindow.on('closed',()=>{mainWindow=null;});
  mainWindow.once('ready-to-show',()=>{if(size.maximized)mainWindow.maximize();mainWindow.show();});
  await mainWindow.loadURL(origin+'/');
  if(debugMode)mainWindow.webContents.openDevTools({mode:'detach'});
  log('ready',`version=${app.getVersion()} electron=${process.versions.electron} port=${port}`);
}

if(!app.requestSingleInstanceLock())app.quit();
else {
  app.on('second-instance',(_event,argv)=>{if(mainWindow){if(mainWindow.isMinimized())mainWindow.restore();mainWindow.show();mainWindow.focus();if(argv.includes('--debug')&&!mainWindow.webContents.isDevToolsOpened())mainWindow.webContents.openDevTools({mode:'detach'});}});
  app.on('window-all-closed',()=>app.quit());
  app.on('before-quit',event=>{
    if(quitting||!server?.listening)return;
    event.preventDefault();quitting=true;saveWindow();log('exit');
    server.close(()=>app.exit(0));server.closeAllConnections();
  });
  app.whenReady().then(async()=>{
    const keys=createKeyStore(join(dataRoot,'credentials.enc.json'),safeStorage);
    const chats=createChatStore(dataRoot);
    ipcMain.handle('paper-space:menu',event=>{if(!trustedSender(event,mainWindow,origin))return;Menu.getApplicationMenu()?.popup({window:mainWindow,x:12,y:38});});
    ipcMain.handle('paper-space:chats',async(event,action,input)=>{
      if(!trustedSender(event,mainWindow,origin))return{ok:false,error:'不受信任的对话存储请求'};
      try{
        if(action==='status')return{ok:true,...await chats.status()};
        if(action==='save')return{ok:true,version:2,...await chats.save(chatSnapshot(input))};
        if(action==='read'&&typeof input==='string'&&input.length<=300)return{ok:true,...await chats.read(input)};
        if(action==='remove'&&Array.isArray(input)&&input.length<=1000){await chats.remove(input);return{ok:true};}
        if(action==='choose'&&Array.isArray(input)&&input.length<=1000){const snapshots=input.map(chatSnapshot);const choice=await dialog.showOpenDialog(mainWindow,{title:'选择对话保存位置',properties:['openDirectory','createDirectory'],buttonLabel:'使用此目录'});if(choice.canceled)return{ok:true,cancelled:true};return{ok:true,...await chats.choose(choice.filePaths[0],snapshots)};}
        return{ok:false,error:'无效对话存储操作'};
      }catch{return{ok:false,error:'目录无法读写，请检查权限、磁盘空间或目录是否可用。'};}
    });
    ipcMain.handle('paper-space:keys',(event,action,input)=>{
      if(!trustedSender(event,mainWindow,origin))return{ok:false,error:'不受信任的密钥请求'};
      if(!['status','get','set','clear'].includes(action))return{ok:false,error:'无效密钥操作'};
      try{return{ok:true,...keys[action](input)};}catch(error){return{ok:false,error:error.message};}
    });
    server=createServer({runtimeRoot:process.env.PAPER_SPACE_RUNTIME||join(portableRoot,'runtime'),dataRoot});
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
    setupMenu();await createWindow();
  }).catch(error=>{
    log('startup-failed',error.code||error.name);
    dialog.showErrorBox('纸间启动失败',error.code==='EADDRINUSE'?`本机端口 ${port} 已被其他程序占用，请关闭占用程序后重试。`:String(error.message));
    app.quit();
  });
}
