import { trimStarts } from './util';
import { PathsAndImage } from './cstSimpleHelper';

export function getDbPath(rootDir: string, fullPath: string): string {
  return trimStarts(fullPath.substring(rootDir.length).replace(/\\/g, '/'), ['/']);
}
