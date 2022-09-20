import { trimStartList } from './util';
import { PathsAndImage } from './classHelper';

export function getDbPath(rootDir: string, fullPath: string): string {
  return trimStartList(fullPath.substring(rootDir.length).replace(/\\/g, '/'), ['/']);
}
