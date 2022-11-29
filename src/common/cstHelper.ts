import { findLastIndex } from './util';
import { Keyword } from './classHelper';
import { PathsAndImage } from './cstSimpleHelper';

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

export function getValue(parent: any, pathDotSeparated: string, joinSeparator: string = '.'): string {
  const paths = pathDotSeparated.split('.');

  let prop = getProperty(parent, paths);
  if (prop === null) return '';

  if (Array.isArray(prop)) {
    prop = prop.join(joinSeparator);
  }

  return prop;
}

export function startsWith2(paths: string[], finds: (string | RegExp)[]): boolean {
  const finds2 = [...finds];

  let index = -1;
  for (let i = 0; i < finds2.length; i++) {
    const find = finds2[i];

    index++;

    if (typeof find === 'string') {
      if (find !== paths[index]) {
        return false;
      }
    } else {
      if (!find.test(paths[index])) {
        return false;
      }
    }
  }

  return true;
}
export function startsWith(paths: string[], ...finds: (string | RegExp)[]): boolean {
  return startsWith2(paths, finds);
}

export function endsWith2(paths: string[], finds: (string | RegExp)[]): boolean {
  const finds2 = [...finds];

  let index = paths.length;
  for (let i = finds2.length - 1; i >= 0; i--) {
    const find = finds2[i];

    index--;

    if (typeof find === 'string') {
      if (find !== paths[index]) {
        return false;
      }
    } else {
      if (!find.test(paths[index])) {
        return false;
      }
    }
  }

  return true;
}
export function endsWith(paths: string[], ...finds: (string | RegExp)[]): boolean {
  return endsWith2(paths, finds);
}

export function indexOf2(paths: string[], finds: (string | RegExp)[]): number {
  let idxSrc = 0;

  while (true) {
    const findFirst = finds[0];
    let idxFirst = paths.findIndex((v, i) => {
      if (i < idxSrc) return false;

      if (typeof findFirst === 'string') {
        return v === findFirst;
      } else {
        return findFirst.test(v);
      }
    });
    if (idxFirst === -1) return -1;

    idxSrc = idxFirst;

    let found = true;
    for (let idxFind = 1; idxFind < finds.length; idxFind++) {
      const find = finds[idxFind];

      idxSrc++;

      if (typeof find === 'string') {
        if (find !== paths[idxSrc]) {
          found = false;
          break;
        }
      } else {
        if (!find.test(paths[idxSrc])) {
          found = false;
          break;
        }
      }
    }
    if (found) return idxFirst;
  }
}
export function indexOf(paths: string[], ...finds: (string | RegExp)[]): number {
  return indexOf2(paths, finds);
}
export function includes2(paths: string[], finds: (string | RegExp)[]): boolean {
  return indexOf2(paths, finds) !== -1;
}
export function includes(paths: string[], ...finds: (string | RegExp)[]): boolean {
  return indexOf2(paths, finds) !== -1;
}

export function rangeOfImages(
  blocks: PathsAndImage[],
  start: number,
  end: number,
  finds: (string | RegExp)[]
): { matches: RegExpExecArray[]; start: number; end: number } | null {
  let idxBlocks = start;

  while (true) {
    const matches: RegExpExecArray[] = [];

    const findFirst = finds[0];
    const idxFirst = blocks.findIndex(({ image }, i) => {
      if (i < idxBlocks || i > end) return false;

      if (typeof findFirst === 'string') {
        if (findFirst !== image) return false;
      } else {
        const match = findFirst.exec(image);
        if (!match) return false;
      }

      return true;
    });
    if (idxFirst === -1) return null;

    idxBlocks = idxFirst - 1;
    let found = true;
    for (let idxFind = 0; idxFind < finds.length; idxFind++) {
      const find = finds[idxFind];

      idxBlocks++;
      if (idxBlocks > end) {
        found = false;
        break;
      }

      const { image } = blocks[idxBlocks];

      if (typeof find === 'string') {
        if (find !== image) {
          found = false;
          break;
        }
      } else {
        const match = find.exec(image);
        if (!match) {
          found = false;
          break;
        }

        matches.push(match);
      }
    }
    if (found) {
      return { matches, start: idxFirst, end: idxBlocks };
    }
  }
}
export function lastRangeOfImages(
  blocks: PathsAndImage[],
  startFromRtoL: number,
  endFromRtoL: number,
  finds: (string | RegExp)[]
): { matches: RegExpExecArray[]; start: number; end: number } | null {
  let idxBlocks = startFromRtoL;

  while (true) {
    const matches: RegExpExecArray[] = [];

    const findLast = finds[finds.length - 1];
    const idxLast = findLastIndex(blocks, ({ image }, i) => {
      if (i > idxBlocks || i < endFromRtoL) return false;

      if (typeof findLast === 'string') {
        if (findLast !== image) return false;
      } else {
        const match = findLast.exec(image);
        if (!match) return false;
      }

      return true;
    });
    if (idxLast === -1) return null;

    idxBlocks = idxLast + 1;
    let found = true;
    for (let idxFind = finds.length - 1; idxFind >= 0; idxFind--) {
      const find = finds[idxFind];

      idxBlocks--;
      if (idxBlocks < endFromRtoL) {
        found = false;
        break;
      }

      const { image } = blocks[idxBlocks];

      if (typeof find === 'string') {
        if (find !== image) {
          found = false;
          break;
        }
      } else {
        const match = find.exec(image);
        if (!match) {
          found = false;
          break;
        }

        matches.push(match);
      }
    }
    if (found) {
      return { matches, start: idxBlocks + 1, end: idxLast };
    }
  }
}

// export function execImages(r: RegExp, images: string[], separator: string = '', index: number = 0) {
//   const value = images.filter((v, i) => i >= index).join(separator);
//   return r.exec(value);
// }
export function execImages(
  r: RegExp,
  blocks: PathsAndImage[],
  separator: string = '',
  start: number = 0
): { match: RegExpExecArray; start: number; end: number } | null {
  const images: string[] = [];

  for (let i = start; i < blocks.length; i++) {
    const { image } = blocks[i];
    images.push(image);
    const match = r.exec(images.join(separator));
    if (match) {
      return { match, start, end: i };
    }
  }

  return null;
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

function getPathsAndImages(parent: any, paths: string[], pathsAndImages: PathsAndImage[]): void {
  if (typeof parent === 'string') {
    pathsAndImages.push({ paths, image: parent });
    return;
  }

  const kvList = Object.entries(parent);
  for (let nKv = 0; nKv < kvList.length; nKv++) {
    const [key, value] = kvList[nKv];

    const prop = parent[key];

    const pathsNew = [...paths];
    pathsNew.push(key);
    getPathsAndImages(prop, pathsNew, pathsAndImages);
  }
}

function moveBinOpComma(
  list: PathsAndImage[],
  posBinInList: number,
  posBinInPath: number,
  indexBin: number
): PathsAndImage[] {
  // num + 1:
  // "num" unaryExpression,0,primary,primaryPrefix,fqnOrRefType,fqnOrRefTypePartFirst,fqnOrRefTypePartCommon,Identifier
  // "1"   unaryExpression,1,primary,primaryPrefix,literal,integerLiteral,DecimalLiteral
  // "+"   BinaryOperator

  const { paths: pathsPrev } = list[posBinInList - 1];
  const toInsert = list.splice(posBinInList, 1)[0];
  const { paths: pathsBin } = toInsert;

  const prevSiblingName = pathsPrev.slice(posBinInPath, posBinInPath + 1)[0];
  const pathsPrefix = [...pathsBin.slice(0, posBinInPath), prevSiblingName, (indexBin + 1).toString()];

  for (let i = posBinInList - 1; i >= 0; i--) {
    const { paths } = list[i];
    // find end index of group
    if (startsWith2(paths, pathsPrefix)) {
      // find start index of group
      for (let j = i - 1; j >= 0; j--) {
        const { paths: paths2 } = list[j];
        if (!startsWith2(paths2, pathsPrefix)) {
          const indexStart = j + 1;
          list.splice(indexStart, 0, toInsert);
          return list;
        }
      }
    }
  }

  // String[] a = { "a", "b", };
  // console.error(`Cannot find pathsPrefix: ${pathsPrefix.join(',')}`);

  return list;
}
export function reorderBinOpCommaColon(pathsAndImageList: PathsAndImage[]): PathsAndImage[] {
  const list = [...pathsAndImageList];
  const dests: (string | RegExp)[][] = [
    ['BinaryOperator'],
    ['BinaryOperator', /^[0-9]+$/],
    ['Comma'],
    ['Comma', /^[0-9]+$/],
    ['ternaryExpression', 'Colon'],
  ];

  const rDigit = /^[0-9]+$/;

  for (let i = 0; i < list.length; i++) {
    const { paths } = list[i];

    let found = false;
    let endsWithDigit = false;
    for (const dest of dests) {
      if (endsWith2(paths, dest)) {
        endsWithDigit = rDigit.test(paths[paths.length - 1]);
        found = true;
        break;
      }
    }
    if (!found) continue;

    const posBinInList = i;
    const posBinInPath = paths.length - (endsWithDigit ? 2 : 1);
    const indexBin = endsWithDigit ? parseInt(paths[paths.length - 1], 10) : 0;
    moveBinOpComma(list, posBinInList, posBinInPath, indexBin);
  }
  return list;
}
export function getPathsAndImagesFromCstSimple(cstSimple: any): PathsAndImage[] {
  const paths: string[] = [];
  const pathsAndImages: PathsAndImage[] = [];
  getPathsAndImages(cstSimple, paths, pathsAndImages);

  const pathsAndImageListOrdered = reorderBinOpCommaColon(pathsAndImages);
  return pathsAndImageListOrdered;
}
