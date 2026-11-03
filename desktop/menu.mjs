// Native shell differences live here; reading and document features stay shared.
export function desktopMenu({platform,name,t,actions}) {
  const mac=platform==='darwin';
  const item=(key,role,extra={})=>({label:t(key),role,...extra});
  return [
    ...(mac?[{role:'appMenu',label:name,submenu:[
      {label:t('关于纸间'),click:actions.about},{type:'separator'},
      item('服务','services'),{type:'separator'},item('隐藏纸间','hide'),
      item('隐藏其他','hideOthers'),item('显示全部','unhide'),{type:'separator'},
      item('退出纸间','quit',{accelerator:'Command+Q'}),
    ]}]:[]),
    {label:t('文件'),submenu:mac?[item('关闭窗口','close')]:[item('退出纸间','quit',{accelerator:'Alt+F4'})]},
    {label:t('编辑'),submenu:[item('撤销','undo'),item('重做','redo'),{type:'separator'},item('剪切','cut'),item('复制','copy'),item('粘贴','paste'),item('全选','selectAll')]},
    {label:t('视图'),submenu:[item('刷新界面','reload',{accelerator:'CommandOrControl+R'}),item('忽略缓存并刷新','forceReload',{accelerator:'CommandOrControl+Shift+R'}),{type:'separator'},item('放大','zoomIn'),item('缩小','zoomOut'),item('恢复缩放','resetZoom'),{type:'separator'},item('全屏','togglefullscreen',{accelerator:mac?'Control+Command+F':'F11'})]},
    ...(mac?[{role:'windowMenu',label:t('窗口'),submenu:[
      {label:t('打开阅读窗口'),accelerator:'Command+0',click:actions.reopen},
      item('最小化','minimize'),item('缩放窗口','zoom'),{type:'separator'},item('全部置于前面','front'),
    ]}]:[]),
    {label:t('调试'),submenu:[{label:t('开发者工具'),accelerator:mac?'Command+Alt+I':'F12',click:actions.tools},{label:t('打开界面源码目录'),click:actions.source},{label:t('打开应用数据目录'),click:actions.data},{label:t('打开诊断日志目录'),click:actions.logs},{type:'separator'},{label:t('重启应用'),click:actions.restart}]},
    {label:t('帮助'),submenu:[{label:t('调试说明'),click:actions.debug},{label:t('关于纸间'),click:actions.about}]},
  ];
}
