export const CONSENT_VERSION='2026-10-05.1';
export const CONSENT_KEY='paper-space-usage-consent';
export function hasUsageConsent(storage){
  try{const value=JSON.parse(storage.getItem(CONSENT_KEY));return value?.version===CONSENT_VERSION&&value.accepted===true&&Number.isFinite(value.acceptedAt)&&value.acceptedAt>0;}catch{return false;}
}
export function saveUsageConsent(storage,now=Date.now()){
  try{storage.setItem(CONSENT_KEY,JSON.stringify({version:CONSENT_VERSION,accepted:true,acceptedAt:now}));return true;}catch{return false;}
}
export const usageSections=[
  ['文献版权与授权','请确保导入的论文及其他资料来源合法，且你有权按预期方式阅读、处理或使用。向模型接口发送原文、导出或分享内容前，请核对版权、许可及保密要求；不要未经授权上传他人的未公开论文或敏感资料。'],
  ['API 与当地法律','AI 功能由你自行配置的服务提供。请确保所选 API、服务商、访问方式及使用行为符合你所在地区适用的法律法规，并遵守服务商条款。纸间不提供 API Key，也不内置对话大模型或默认连接的 AI 服务。'],
  ['本机处理与数据发送','导入、阅读与文档结构识别在本机进行。随包的 Docling 模型仅用于本机识别段落、表格与公式，不是对话模型。主动使用翻译、解读、导读或聊天时，相应内容会发往你配置的接口；全文导读会使用全文。连接测试及模型检测也会访问该接口，服务商的数据处理规则由其条款决定。'],
  ['结果与责任边界','AI 输出可能有误，请回到原文核对，审慎引用或使用。纸间提供阅读辅助功能，不授予任何第三方内容的使用权，也不代替你对版权、数据发送和 API 使用作出判断。本说明不排除或限制法律规定不得免除的责任。'],
];
