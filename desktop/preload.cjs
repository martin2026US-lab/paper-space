const {contextBridge,ipcRenderer}=require('electron');
const invoke=(action,input)=>ipcRenderer.invoke('paper-space:keys',action,input);
contextBridge.exposeInMainWorld('paperKeys',Object.freeze({status:()=>invoke('status'),get:input=>invoke('get',input),set:input=>invoke('set',input),clear:input=>invoke('clear',input)}));
contextBridge.exposeInMainWorld('paperDesktop',Object.freeze({chatVersion:2,setUILanguage:language=>ipcRenderer.invoke('paper-space:ui-language',language),menu:()=>ipcRenderer.invoke('paper-space:menu'),quit:()=>ipcRenderer.invoke('paper-space:quit'),chats:(action,input)=>ipcRenderer.invoke('paper-space:chats',action,input)}));
