import { xml2js, Element } from 'xml-js';
import {
  trimStarts,
  removeCommentSql,
  removeCommentLiteralSql,
  trims,
  readFileSyncUtf16le,
  escapeDollar,
  removeCommentJsp,
  getLastPath,
  trimStart,
  getFirstPath,
  getAbsolutePathByDotDot,
} from './util';
import { SqlTemplate } from '../common/sqliteHelper';
import { config } from '../config/config';
import { configReader } from '../config/configReader';
import { readdirSync, existsSync, statSync } from 'fs';
import { resolve } from 'path';
import betterSqlite3 from 'better-sqlite3';
import { runInsertToDbFirst } from './message';
import { getDbPath } from './common';
import tCache from '../sqlTemplate/TCache';
import tXmlInfo from '../sqlTemplate/TXmlInfo';
import tJspInfo from '../sqlTemplate/TJspInfo';
import tCommon from '../sqlTemplate/TCommon';
import { getFindsByClassPathClassNameFromDb } from './classHelper';
import { getStartingToJsps } from './traceHelper';

/** not starts with 'jsp' */
export type JspView = {
  name: string;
  parsed: boolean;
};
export type JspViewFind = JspView & {
  exists: boolean;
};
/** starts with 'jsp' */
export type JspInfo = {
  jspPath: string;
  includes: string[];
};

export function getJspInfoFromDb(keyName: string): JspInfo[] {
  const rows = tJspInfo.selectJspInfo(keyName);
  return rows.map(({ jspPath, includes }) => ({
    jspPath,
    includes: JSON.parse(includes),
  }));
}

export function insertJspInfoToDb(keyName: string, jspInfos: JspInfo[]): void {
  tJspInfo.insertJspInfo(keyName, jspInfos);
}

export function getJspIncludes(fullJspDirectory: string, jspFullPath: string): string[] {
  const content = readFileSyncUtf16le(jspFullPath);
  const contentNoComment = removeCommentJsp(content);

  const includes: string[] = [];
  let m: RegExpExecArray | null;
  const re = /<jsp:include\s+page\s*=\s*"([^"]+)"\s*\/>|<%@\s+include\s+file\s*=\s*"([^"]+)"\s*%>/g;
  while ((m = re.exec(contentNoComment)) !== null) {
    let jspPath = trimStart(m[1] || m[2], '/');
    if (jspPath.startsWith('../') || jspPath.startsWith('./')) {
      jspPath = getAbsolutePathByDotDot(jspFullPath, jspPath);
      jspPath = getJspPath(fullJspDirectory, jspPath);
    }

    includes.push(jspPath);
  }

  return includes;
}
export function insertJspInfo(keyName: string, fullJspDirectory: string, jspFullPaths: string[]): JspInfo[] {
  const jspInfos: JspInfo[] = [];

  for (const jspFullPath of jspFullPaths) {
    const jspPath = getJspPath(fullJspDirectory, jspFullPath);

    const includes = getJspIncludes(fullJspDirectory, jspFullPath);
    jspInfos.push({ jspPath, includes });
  }

  insertJspInfoToDb(keyName, jspInfos);

  return jspInfos;
}

export function viewNameToJspPath(jspRoot: string, viewName: string) {
  return `${jspRoot}/${trimStart(`${viewName}`, '/')}.jsp`;
}
export function getJspPath(fullJspDirectory: string, jspFullPath: string) {
  const jspRoot = getLastPath(fullJspDirectory);
  const dbPath = getDbPath(`${fullJspDirectory}`, jspFullPath);
  const jspPath = `${jspRoot}/${dbPath}`;
  return jspPath;
}

function someJspFromJava(jspPaths: string[], viewName: string) {
  return jspPaths.some((jspPath) => {
    const jspRoot = getFirstPath(jspPath);
    return trimStart(jspPath, '/') === viewNameToJspPath(jspRoot, viewName);
  });
}
export function filterJspFromJsp(jspInfos: JspInfo[], jspPath: string): Set<string> {
  const includes = jspInfos
    .filter((jspInfo) => trimStart(jspInfo.jspPath, '/') === trimStart(jspPath, '/'))
    .map(({ includes }) => includes)
    .flat();
  return new Set<string>(includes);
}

export function getJspViewFinds(jspViews: JspView[], jspPaths: string[]): JspViewFind[] {
  return jspViews.map(({ name, parsed }) => {
    const exists = parsed && someJspFromJava(jspPaths, name);
    return { name, parsed, exists };
  });
}

export function insertRouteJspKeyName() {
  for (let i = 0; i < config.path.source.main.length; i++) {
    const {
      startings: { directory, file },
      keyName,
      jspDirectory,
    } = config.path.source.main[i];

    const findsStarting = getFindsByClassPathClassNameFromDb(keyName, directory, file);

    console.log(`getStartingToJsps`);
    const routesAll = getStartingToJsps(keyName, findsStarting, jspDirectory, config.startingPoint);

    const routesCur = routesAll
      .map((routes, i) => {
        return routes.map((route) => ({ groupSeq: i, ...route }));
      })
      .flat();
    if (!routesCur.length) {
      continue;
    }
    console.log(`insertRouteTableKeyName`);
    tCommon.insertRouteJspKeyName(keyName, routesCur);
  }
}
