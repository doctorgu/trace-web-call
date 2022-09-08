import { trimStartList } from './util';

export function getDbPath(rootDir: string, fullPath: string): string {
  return trimStartList(fullPath.substring(rootDir.length).replace(/\\/g, '/'), '/');
}
