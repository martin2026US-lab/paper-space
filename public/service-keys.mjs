export function createServiceKeys({id,formatFor=c=>c.format||'openai'}){
 const vault=globalThis.paperKeys,keys=new Map(),binding=c=>JSON.stringify([c.baseUrl,c.format]),credential=c=>({id,baseUrl:c.baseUrl,format:formatFor(c)});
 return{get:c=>keys.get(binding(c))||'',async load(c){if(!c.baseUrl)return;try{const r=await vault?.get(credential(c));if(r?.ok&&r.saved)keys.set(binding(c),r.key);}catch{}},async save(c,key,remember){if(vault&&c.baseUrl){const r=remember?await vault.set({...credential(c),key}):await vault.clear(credential(c));if(!r.ok)throw Error(r.error||'密钥保存失败。');}keys.set(binding(c),key||'');},canRemember:!!vault};
}
