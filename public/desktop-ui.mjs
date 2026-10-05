import {conversationPayload,restoreConversationFile} from './conversations.mjs';
export function createDesktopUI({state,toast,flush}){
  const $=id=>document.getElementById(id),api=window.paperDesktop;
  if(!api){$('storageLocation').textContent='浏览器版由浏览器保存对话；桌面版可选择目录。';$('chooseChatFolder').disabled=true;return;}
  document.body.classList.add('desktop-app');$('desktopTitlebar').hidden=false;
  $('appMenu').onclick=()=>api.menu();
  let writing=Promise.resolve();
  async function status(){const r=await api.chats('status');if(r.ok)$('storageLocation').textContent=r.folder;else toast(r.error);}
  $('storageBtn').onclick=()=>{status();$('storageDialog').showModal();};
  $('chooseChatFolder').onclick=async()=>{if(state.busy||state.mutating)return toast('请先停止模型任务。');const btn=$('chooseChatFolder');btn.disabled=true;try{await writing;const r=await api.chats('choose',state.docs.map(conversationPayload));if(r.ok&&!r.cancelled){$('storageLocation').textContent=r.folder;toast('已有对话已复制，之后自动保存到此目录。');}else if(!r.ok)toast(r.error);}finally{btn.disabled=false;}};
  const store={
    save(doc){const snapshot=conversationPayload(doc);writing=writing.then(async()=>{const r=await api.chats('save',snapshot);if(!r.ok)toast('对话目录保存失败；阅读器副本仍保留。'+r.error);}).catch(()=>toast('对话目录保存失败；阅读器副本仍保留。'));return writing;},
    async load(docs){for(const doc of docs){const r=await api.chats('read',doc.id);if(r.ok&&restoreConversationFile(doc,r)){await flush(doc);}else if(!r.ok)toast(r.error);else await store.save(doc);}},
    async remove(ids){await writing;const r=await api.chats('remove',ids);if(!r.ok)throw Error(r.error);},
  };return store;
}
