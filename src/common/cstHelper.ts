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

export function getValue(parent: any, pathDotSeparated: string): string {
  const paths = pathDotSeparated.split('.');

  const prop = getProperty(parent, paths);
  if (prop === null) return '';

  return prop;
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

export function startsWith2(paths: string[], finds: string[]): boolean {
  const finds2 = [...finds];

  let index = -1;
  for (let i = 0; i < finds2.length; i++) {
    index++;
    if (finds2[i] !== paths[index]) {
      return false;
    }
  }

  return true;
}
export function startsWith(paths: string[], ...finds: string[]): boolean {
  return startsWith2(paths, finds);
}

export function endsWith2(paths: string[], finds: string[]): boolean {
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
export function endsWith(paths: string[], ...finds: string[]): boolean {
  return endsWith2(paths, finds);
}

export function indexOf2(paths: string[], finds: string[]): number {
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
export function indexOf(paths: string[], ...finds: string[]): number {
  return indexOf2(paths, finds);
}
export function includes2(paths: string[], finds: string[]): boolean {
  return indexOf2(paths, finds) !== -1;
}
export function includes(paths: string[], ...finds: string[]): boolean {
  return indexOf2(paths, finds) !== -1;
}

export function rangeOfImages(
  blocks: PathsAndImage[],
  start: number,
  end: number,
  finds: (string | RegExp)[]
): { matches: RegExpExecArray[]; start: number; end: number } | null {
  const matches: RegExpExecArray[] = [];

  const findFirst = finds[0];
  const idxFirst = blocks.findIndex(({ image }, i) => {
    if (i < start || i > end) return false;

    if (typeof findFirst === 'string') {
      if (findFirst !== image) return false;
    } else {
      const match = findFirst.exec(image);
      if (!match) return false;
    }

    return true;
  });
  if (idxFirst === -1) return null;

  let idxBlocks = idxFirst - 1;
  for (let idxFind = 0; idxFind < finds.length; idxFind++) {
    const find = finds[idxFind];

    idxBlocks++;
    if (idxBlocks > end) return null;

    const { image } = blocks[idxBlocks];

    if (typeof find === 'string') {
      if (find !== image) return null;
    } else {
      const match = find.exec(image);
      if (!match) return null;

      matches.push(match);
    }
  }

  return { matches, start: idxFirst, end: idxBlocks };
}
export function lastRangeOfImages(
  blocks: PathsAndImage[],
  startFromRtoL: number,
  finds: (string | RegExp)[]
): { matches: RegExpExecArray[]; start: number; end: number } | null {
  const matches: RegExpExecArray[] = [];

  const findLast = finds[finds.length - 1];
  const idxLast = findLastIndex(blocks, ({ image }, i) => {
    if (i > startFromRtoL) return false;

    if (typeof findLast === 'string') {
      if (findLast !== image) return false;
    } else {
      const match = findLast.exec(image);
      if (!match) return false;
    }

    return true;
  });
  if (idxLast === -1) return null;

  let idxBlocks = idxLast;
  for (let idxFind = finds.length - 1; idxFind >= 0; idxFind--) {
    const find = finds[idxFind];
    const { image } = blocks[idxBlocks--];

    if (typeof find === 'string') {
      if (find !== image) return null;
    } else {
      const match = find.exec(image);
      if (!match) return null;

      matches.push(match);
    }
  }

  return { matches, start: idxBlocks + 1, end: idxLast };
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

// function getInsertIdx(list: (PathsAndImage & { binMoved: boolean })[], start: number, offset: number): number {
//   let counter = 0;
//   for (let i = start; i >= 0; i--) {
//     const { image } = list[i];
//     if (image === ')') {
//       i = getOpeningPosition(list, i, '(', ')');
//     }

//     counter++;
//     if (counter === offset) {
//       return i;
//     }
//   }

//   throw new Error(`Not reached by offset: ${offset}`);
// }
// function moveBinaryOperator(list: (PathsAndImage & { binMoved: boolean })[], posBin: number, lastIdxBin: number): void {
//   // [1, 2, 3, 4, +, +, +] -> [1, +, 2, +, 3, +, 4]
//   //    : [1, 2, 3, 4, +, +, +]
//   // - 3: [1, 2, 3, +, 4, +, +]
//   // - 4: [1, 2, +, 3, +, 4, +]
//   // - 5: [1, +, 2, +, 3, +, 4]
//   let insertIdx = -1;
//   let offset = lastIdxBin + 1;
//   for (let i = 0; i < lastIdxBin + 1; i++) {
//     const cur = list.splice(posBin, 1)[0];
//     insertIdx = getInsertIdx(list, posBin - 1, offset);
//     list.splice(insertIdx, 0, cur);
//     cur.binMoved = true;

//     offset++;
//   }
// }
// export function reorderBinaryOperator(pathsAndImageList: PathsAndImage[]): PathsAndImage[] {
//   const list: (PathsAndImage & { binMoved: boolean })[] = pathsAndImageList.map(({ paths, image }) => ({
//     paths,
//     image,
//     binMoved: false,
//   }));
//   const dests = ['BinaryOperator', 'Comma'];

//   for (let i = list.length - 1; i >= 0; i--) {
//     const { paths, binMoved } = list[i];

//     const rDigit = /^[0-9]+$/;
//     const binOne = dests.includes(paths[paths.length - 1]);
//     const binOneMore = dests.includes(paths[paths.length - 2]) && rDigit.test(paths[paths.length - 1]);
//     if ((!binOne && !binOneMore) || binMoved) continue;

//     const lastIdxS = binOne ? '0' : paths[paths.length - 1];

//     moveBinaryOperator(list, i, parseInt(lastIdxS));
//   }
//   return list.map(({ paths, image }) => ({ paths, image }));
// }
// export function getPathsAndImagesFromSimpleCst(parent: any): PathsAndImage[] {
//   const paths: string[] = [];
//   const pathsAndImageList: PathsAndImage[] = [];

//   getPathsAndImageListFromSimpleCst2(parent, paths, pathsAndImageList);

//   // return pathsAndImageList;

//   // !!! Has problem that plus inserted between 'getString' and '(' in following
//   // return new ModelAndView("redirect:https://" + ConfigUtil.getString("server.host") + "/p/cob/registMrMember.do", model);
//   const pathsAndImageListOrdered = reorderBinaryOperator(pathsAndImageList);
//   return pathsAndImageListOrdered;
// }
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

  throw new Error(`Cannot find pathsPrefix: ${pathsPrefix.join(',')}`);
}
export function reorderBinOpCommaColon(pathsAndImageList: PathsAndImage[]): PathsAndImage[] {
  const list = [...pathsAndImageList];
  const dests = ['BinaryOperator', 'Comma', 'Colon'];

  for (let i = 0; i < list.length; i++) {
    const { paths } = list[i];

    const rDigit = /^[0-9]+$/;
    const binOne = dests.includes(paths[paths.length - 1]);
    const binOneMore = dests.includes(paths[paths.length - 2]) && rDigit.test(paths[paths.length - 1]);
    if (!binOne && !binOneMore) continue;

    const indexBin = binOne ? 0 : parseInt(paths[paths.length - 1], 0);
    const posBinInList = i;
    const posBinInPath = paths.length - (binOne ? 1 : 2);
    moveBinOpComma(list, posBinInList, posBinInPath, indexBin);
  }
  return list;
}
export function getPathsAndImagesFromSimpleCst(parent: any): PathsAndImage[] {
  const paths: string[] = [];
  const pathsAndImageList: PathsAndImage[] = [];

  getPathsAndImageListFromSimpleCst2(parent, paths, pathsAndImageList);

  const pathsAndImageListOrdered = reorderBinOpCommaColon(pathsAndImageList);
  return pathsAndImageListOrdered;
}
