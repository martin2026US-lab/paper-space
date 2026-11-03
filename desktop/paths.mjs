import {join,relative,isAbsolute,sep} from 'node:path';

export function isPathInside(parent,target) {
  const rel=relative(parent,target);
  return !rel||(!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+sep));
}

// Keep installed data outside the application directory so upgrades preserve it.
export function desktopPaths({packaged,sourceRoot,resourcesPath,appData}) {
  return {
    dataRoot: packaged ? join(appData,'PaperSpace') : join(sourceRoot,'data'),
    runtimeRoot: join(packaged ? resourcesPath : sourceRoot,'runtime'),
  };
}
