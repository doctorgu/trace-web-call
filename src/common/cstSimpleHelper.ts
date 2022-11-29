import { parse } from 'java-parser';
import { readFileSyncUtf16le, trims, trimEnd, findLastIndex } from './util';

export type PathsAndImage = {
  paths: string[];
  image: string;
};
export type PathsImageLocation = PathsAndImage & {
  location: {
    startLine: number;
    endLine: number;
    startColumn: number;
    endColumn: number;
    startOffset: number;
    endOffset: number;
  };
};

function getPathsImageLocationFromCst2(parent: any, paths: string[], pathsImageLocations: PathsImageLocation[]): void {
  const children = parent.children;
  // All leaf property name which has value is always 'image', so do not add 'image' to paths
  if ('image' in parent) {
    const { image, startLine, endLine, startColumn, endColumn, startOffset, endOffset } = parent;
    // NaN -> 0
    const location = {
      startLine: startLine || 0,
      endLine: endLine || 0,
      startColumn: startColumn || 0,
      endColumn: endColumn || 0,
      startOffset: startOffset || 0,
      endOffset: endOffset || 0,
    };
    pathsImageLocations.push({ paths, image, location });
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
        getPathsImageLocationFromCst2(prop[i], pathsNew, pathsImageLocations);
      }
    }
  }
}

function getPathsImageLocationFromCst(parent: any): PathsImageLocation[] {
  const paths: string[] = [];
  const pathsImageLocations: PathsImageLocation[] = [];
  getPathsImageLocationFromCst2(parent, paths, pathsImageLocations);
  return pathsImageLocations;
}

export function convertCstWithLocationToCstSimple(cstWithLocation: any): any {
  function convert(cstWithLocation: any, cstSimple: any) {
    for (const key of Object.keys(cstWithLocation)) {
      const value = cstWithLocation[key];
      const image = value?.image;
      if (image !== undefined) {
        cstSimple[key] = image;
      } else {
        cstSimple[key] = Array.isArray(value) ? [] : {};
        convert(cstWithLocation[key], cstSimple[key]);
      }
    }
  }
  let cstSimple = {};
  convert(cstWithLocation, cstSimple);
  return cstSimple;
}

export function getCstWithLocationFromContent(content: string): any {
  function get(pathsImageLocations: PathsImageLocation[]) {
    const cstWithLocation: any = {};
    for (let i = 0; i < pathsImageLocations.length; i++) {
      const { paths, image, location } = pathsImageLocations[i];

      let childLoc = cstWithLocation;
      for (let i = 0; i < paths.length - 1; i++) {
        const path = paths[i];

        if (!(path in childLoc)) {
          const nextPathIsIndex = !isNaN(parseInt(paths[i + 1]));
          if (nextPathIsIndex) {
            childLoc[path] = [];
          } else {
            childLoc[path] = {};
          }
        }
        childLoc = childLoc[path];
      }
      childLoc[paths[paths.length - 1]] = { image, location };
    }
    return cstWithLocation;
  }

  const cst = parse(content);

  const pathsImageLocations = getPathsImageLocationFromCst(cst);
  const cstWithLocation = get(pathsImageLocations);

  return cstWithLocation;
}
export function getCstWithLocation(fullPath: string): any {
  const content = readFileSyncUtf16le(fullPath);
  return getCstWithLocationFromContent(content);
}
