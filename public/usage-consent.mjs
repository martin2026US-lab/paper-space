import {uiText,uiHTML,uiError,uiDateLocale} from './ui-language.mjs';
export const CONSENT_VERSION='2026-10-05.1';
export const CONSENT_KEY='paper-space-usage-consent';
export function hasUsageConsent(storage){
  try{const value=JSON.parse(storage.getItem(CONSENT_KEY));return value?.version===CONSENT_VERSION&&value.accepted===true&&Number.isFinite(value.acceptedAt)&&value.acceptedAt>0;}catch{return false;}
}
export function saveUsageConsent(storage,now=Date.now()){
  try{storage.setItem(CONSENT_KEY,JSON.stringify({version:CONSENT_VERSION,accepted:true,acceptedAt:now}));return true;}catch{return false;}
}
export const usageSections=[
  [uiText("文献版权与授权"),uiText("请确保导入的论文及其他资料来源合法，且你有权按预期方式阅读、处理或使用。向模型接口发送原文、导出或分享内容前，请核对版权、许可及保密要求；不要未经授权上传他人的未公开论文或敏感资料。")],
  [uiText("API 与当地法律"),uiText("AI 功能由你自行配置的服务提供。请确保所选 API、服务商、访问方式及使用行为符合你所在地区适用的法律法规，并遵守服务商条款。纸间不提供 API Key，也不内置对话大模型或默认连接的 AI 服务。")],
  [uiText("本机处理与数据发送"),uiText("导入与原文阅读在本机进行。Docling 默认在本机识别；只有在自定义识别服务中点击开始，才会将当前完整 PDF 发往所填地址。翻译、解读、导读和聊天发送相应原文，AI 复核发送原文与译文至你选择的接口；全文导读使用全文。接口测试也会访问所填地址。")],
  [uiText("结果与责任边界"),uiText("AI 输出可能有误，请回到原文核对，审慎引用或使用。纸间提供阅读辅助功能，不授予任何第三方内容的使用权，也不代替你对版权、数据发送和 API 使用作出判断。本说明不排除或限制法律规定不得免除的责任。")],
];
