// Only update application-owned controls, never document text or saved content.
export function platformShortcuts(platform='') {
  const mac=/^(darwin|mac)/i.test(platform);
  return {mac,find:mac?'⌘ K':'Ctrl K',focus:mac?'⌘ ⇧ F':'Ctrl Shift F',pages:mac?'⌥ ← / →':'Alt ← / →',findKey:mac?'Meta+K':'Control+K',focusKey:mac?'Meta+Shift+F':'Control+Shift+F'};
}
export function applyPlatformUI(root,{platform='',translate=(key,value)=>key.replace('{0}',value)}={}) {
  const keys=platformShortcuts(platform);
  root.body?.classList.toggle('platform-macos',keys.mac);
  for(const node of root.querySelectorAll('[data-shortcut]')) {
    const value=keys[node.dataset.shortcut];if(value)node.textContent=value;
  }
  for(const [id,key,title]of [['findBtn','find','快速查找 · {0}'],['focusBtn','focus','专注阅读 · {0}']]) {
    const node=root.getElementById(id);if(!node)continue;
    node.title=translate(title,keys[key]);node.setAttribute('aria-keyshortcuts',keys[key+'Key']);
  }
  return keys;
}
export function updateVersion(root,version,{desktop=false,translate=(key,value)=>key.replace('{0}',value)}={}) {
  if(typeof version!=='string'||!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version))return;
  const node=root.getElementById('appVersion');
  if(node){node.textContent=translate(desktop?'桌面 {0}':'版本 {0}',version);node.dataset.version=version;}
}
