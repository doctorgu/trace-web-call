import { parse } from 'java-parser';
import { readFileSyncUtf16le, trims, trimEnd, findLastIndex } from './util';

export type PathsAndImage = {
  paths: string[];
  image: string;
};

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

/** Run yarn truncateCstSimple if any source code of this function and referenced function by this is changed */
export function getCstSimple(fullPath: string): any {
  const content = readFileSyncUtf16le(fullPath);
  const cst = parse(content);

  const pathsAndImages = getPathsAndImageListFromCst(cst);
  const cstSimple = getSimplifiedCst(pathsAndImages);
  return cstSimple;
}
