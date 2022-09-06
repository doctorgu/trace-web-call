import { trimStartSpecific } from './util';

export function getDbPath(rootDir: string, fullPath: string): string {
  return trimStartSpecific(fullPath.substring(rootDir.length).replace(/\\/g, '/'), '/');
}
