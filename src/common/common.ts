import { trimStarts } from './util';
import { PathsAndImage } from './classHelper';

export function getDbPath(rootDir: string, fullPath: string): string {
  return trimStarts(fullPath.substring(rootDir.length).replace(/\\/g, '/'), ['/']);
}
