import { trimStarts } from './util';
import { PathsAndImage } from './cstSimpleHelper';
import tCommon from '../sqlTemplate/TCommon';

export function getDbPath(rootDir: string, fullPath: string): string {
  return trimStarts(fullPath.substring(rootDir.length).replace(/\\/g, '/'), ['/']);
}

export function deleteNoNeedRouteTableRouteBatch() {
  tCommon.deleteNoNeedRouteTableRouteBatch();
}
