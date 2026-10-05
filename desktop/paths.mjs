import {join} from 'node:path';

// Keep installed data outside the application directory so upgrades preserve it.
export function desktopPaths({packaged,sourceRoot,resourcesPath,appData}) {
  return {
    dataRoot: packaged ? join(appData,'PaperSpace') : join(sourceRoot,'data'),
    runtimeRoot: join(packaged ? resourcesPath : sourceRoot,'runtime'),
  };
}
