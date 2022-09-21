import { parse } from 'java-parser';
import { exec as execProc } from 'child_process';
import { statSync } from 'fs';
import { promisify } from 'util';

import { readFileSyncUtf16le, trims, trimEnd } from './util';
import { SqlTemplate } from '../common/sqliteHelper';
import { config } from '../config/config';
import { configReader } from '../config/configReader';
import { runinsertToDbFirst } from './message';
import { getDbPath } from './common';
import { getStartingToTables, RouteTable } from './traceHelper';
import tClassInfo from '../sqlTemplate/TClassInfo';
import tCommon from '../sqlTemplate/TCommon';
import tCache from '../sqlTemplate/TCache';
import { Keyword } from './classHelper';

export type PathsAndImage = {
  paths: string[];
  image: string;
};

export function getProperty(parent: any, paths: string[]): any {
  const kvList = Object.entries(parent);
  for (let i = 0; i < kvList.length; i++) {
    const [key] = kvList[i];

    if (paths[0] !== key) continue;

    const child = parent[key];
    paths.shift();
    if (paths.length === 0) {
      return child;
    }

    return getProperty(child, paths);
  }

  return null;
}

export function getValue(parent: any, pathDotSeparated: string): string {
  const paths = pathDotSeparated.split('.');

  const prop = getProperty(parent, paths);
  if (prop === null) return '';

  return prop;
}

function getSimplifiedCst(pathsAndImageList: PathsAndImage[]) {
  const treeNew: any = {};
  for (let i = 0; i < pathsAndImageList.length; i++) {
    const { paths, image } = pathsAndImageList[i];

    let child = treeNew;
    for (let i = 0; i < paths.length - 1; i++) {
      const path = paths[i];

      if (!(path in child)) {
        const nextPathIsIndex = !isNaN(parseInt(paths[i + 1]));
        if (nextPathIsIndex) {
          child[path] = [];
        } else {
          child[path] = {};
        }
      }
      child = child[path];
    }
    child[paths[paths.length - 1]] = image;
  }
  return treeNew;
}

function getOpeningPosition(
  list: (PathsAndImage & { binMoved: boolean })[],
  posClose: number,
  symbolOpen: string,
  symbolClose: string
): number {
  let counter = 1;

  for (let i = posClose - 1; i >= 0; i--) {
    const { image } = list[i];
    if (image === symbolClose) {
      counter++;
    } else if (image === symbolOpen) {
      counter--;
    }

    if (counter === 0) {
      return i;
    }
  }

  throw new Error(`Openning symbol not found before ${posClose} index.`);
}
function getPathsAndImageListFromSimpleCst2(parent: any, paths: string[], pathsAndImageList: PathsAndImage[]): void {
  if (typeof parent === 'string') {
    pathsAndImageList.push({ paths, image: parent });
    return;
  }

  const kvList = Object.entries(parent);
  for (let nKv = 0; nKv < kvList.length; nKv++) {
    const [key, value] = kvList[nKv];

    const prop = parent[key];

    const pathsNew = [...paths];
    pathsNew.push(key);
    getPathsAndImageListFromSimpleCst2(prop, pathsNew, pathsAndImageList);
  }
}
function getInsertIdx(list: (PathsAndImage & { binMoved: boolean })[], start: number, offset: number): number {
  let counter = 0;
  for (let i = start; i >= 0; i--) {
    const { image } = list[i];
    if (image === ')') {
      i = getOpeningPosition(list, i, '(', ')');
    }

    counter++;
    if (counter === offset) {
      return i;
    }
  }

  throw new Error(`Not reached by offset: ${offset}`);
}
function moveBinaryOperator(list: (PathsAndImage & { binMoved: boolean })[], posBin: number, lastIdxBin: number): void {
  // [1, 2, 3, 4, +, +, +] -> [1, +, 2, +, 3, +, 4]
  //    : [1, 2, 3, 4, +, +, +]
  // - 3: [1, 2, 3, +, 4, +, +]
  // - 4: [1, 2, +, 3, +, 4, +]
  // - 5: [1, +, 2, +, 3, +, 4]
  let insertIdx = -1;
  let offset = lastIdxBin + 1;
  for (let i = 0; i < lastIdxBin + 1; i++) {
    const cur = list.splice(posBin, 1)[0];
    insertIdx = getInsertIdx(list, posBin - 1, offset);
    list.splice(insertIdx, 0, cur);
    cur.binMoved = true;

    offset++;
  }
}
function reorderBinaryOperator(pathsAndImageList: PathsAndImage[]): PathsAndImage[] {
  const list: (PathsAndImage & { binMoved: boolean })[] = pathsAndImageList.map(({ paths, image }) => ({
    paths,
    image,
    binMoved: false,
  }));
  const dests = ['BinaryOperator', 'Comma'];

  for (let i = list.length - 1; i >= 0; i--) {
    const { paths, binMoved } = list[i];

    const rDigit = /^[0-9]+$/;
    const binOne = dests.includes(paths[paths.length - 1]);
    const binOneMore = dests.includes(paths[paths.length - 2]) && rDigit.test(paths[paths.length - 1]);
    if ((!binOne && !binOneMore) || binMoved) continue;

    const lastIdxS = binOne ? '0' : paths[paths.length - 1];

    moveBinaryOperator(list, i, parseInt(lastIdxS));
  }
  return list.map(({ paths, image }) => ({ paths, image }));
}
export function getPathsAndImagesFromSimpleCst(parent: any) {
  const paths: string[] = [];
  const pathsAndImageList: PathsAndImage[] = [];

  getPathsAndImageListFromSimpleCst2(parent, paths, pathsAndImageList);

  const pathsAndImageListOrdered = reorderBinaryOperator(pathsAndImageList);

  return pathsAndImageListOrdered;
}

function getPathsAndImageListFromCst2(parent: any, paths: string[], pathsAndImageList: PathsAndImage[]): void {
  const children = parent.children;
  // All leaf property name which has value is always 'image', so do not add 'image' to paths
  if ('image' in parent) {
    const image = parent.image;
    pathsAndImageList.push({ paths, image });
    return;
  }
  if (!children) {
    throw new Error(`No children in ${paths.join('.')}`);
  }

  const kvList = Object.entries(children);
  for (let i = 0; i < kvList.length; i++) {
    const [key, value] = kvList[i];

    const prop = children[key];

    if (Array.isArray(value) && value.length) {
      const useIndex = value.length > 1;
      for (let i = 0; i < value.length; i++) {
        const pathsNew = [...paths];
        pathsNew.push(key);
        if (useIndex) pathsNew.push(i.toString());
        getPathsAndImageListFromCst2(prop[i], pathsNew, pathsAndImageList);
      }
    }
  }
}
function getPathsAndImageListFromCst(parent: any) {
  const paths: string[] = [];
  const pathsAndImageList: PathsAndImage[] = [];
  getPathsAndImageListFromCst2(parent, paths, pathsAndImageList);
  return pathsAndImageList;
}

export function endsWith2(paths: string[], finds: Keyword[]): boolean {
  const finds2 = [...finds];

  let index = paths.length;
  for (let i = finds2.length - 1; i >= 0; i--) {
    index--;
    if (finds2[i] !== paths[index]) {
      return false;
    }
  }

  return true;
}
export function endsWith(paths: string[], ...finds: Keyword[]): boolean {
  return endsWith2(paths, finds);
}

export function includes2(paths: string[], finds: Keyword[]): boolean {
  return indexOf2(paths, finds) !== -1;
}
export function includes(paths: string[], ...finds: Keyword[]): boolean {
  return indexOf2(paths, finds) !== -1;
}

export function indexOf2(paths: string[], finds: Keyword[]): number {
  let idxSrc = 0;

  while (true) {
    let idxFirst = paths.indexOf(finds[0], idxSrc);
    if (idxFirst === -1) return -1;

    idxSrc = idxFirst;

    let found = true;
    for (let idxFind = 1; idxFind < finds.length; idxFind++) {
      idxSrc++;
      if (finds[idxFind] !== paths[idxSrc]) {
        found = false;
        break;
      }
    }
    if (found) return idxFirst;
  }
}
export function indexOf(paths: string[], ...finds: Keyword[]): number {
  return indexOf2(paths, finds);
}

export function execImages(r: RegExp, images: string[], separator: string = '', index: number = 0) {
  const value = images.filter((v, i) => i >= index).join(separator);
  return r.exec(value);
}

export function getRCurlyPosition(methodDecls: PathsAndImage[], posLCurly: number): number {
  let counter = 1;

  for (let i = posLCurly + 1; i < methodDecls.length; i++) {
    const { paths } = methodDecls[i];
    if (endsWith(paths, 'LCurly')) {
      counter++;
    } else if (endsWith(paths, 'RCurly')) {
      counter--;
    }

    if (counter === 0) {
      return i;
    }
  }

  throw new Error(`RCurly not found after ${posLCurly} index.`);
}

export function getRBracePosition(pathsAndImages: PathsAndImage[], posLBrace: number): number {
  let counter = 1;

  for (let i = posLBrace + 1; i < pathsAndImages.length; i++) {
    const { paths } = pathsAndImages[i];
    if (endsWith(paths, 'LBrace')) {
      counter++;
    } else if (endsWith(paths, 'RBrace')) {
      counter--;
    }

    if (counter === 0) {
      return i;
    }
  }

  throw new Error(`RBrace not found after ${posLBrace} index.`);
}

export function getCstSimple(fullPath: string): any {
  const content = readFileSyncUtf16le(fullPath);
  const cst = parse(content);

  const pathsAndImages = getPathsAndImageListFromCst(cst);
  const cstSimple = getSimplifiedCst(pathsAndImages);
  return cstSimple;
}
