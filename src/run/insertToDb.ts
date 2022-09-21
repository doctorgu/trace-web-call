import { existsSync, statSync, unlinkSync } from 'fs';
import { resolve } from 'path';
import { findFiles } from '../common/util';
import {
  ClassInfo,
  getFindsByClassPathClassNameFromDb,
  insertClassInfo,
  insertMethodInfoFindKeyName,
  insertRouteTableKeyName,
} from '../common/classHelper';
import {
  ObjectAndTables,
  insertTablesToDb,
  insertObjectAndTables,
  insertXmlInfoXmlNodeInfo,
  XmlInfo,
  insertXmlInfoFindKeyName,
} from '../common/batisHelper';
import { config } from '../config/config';
import { configReader } from '../config/configReader';
import { DirectoryAndFilePattern } from '../config/configTypes';
import { mergeExtends } from '../common/traceHelper';
import { sqlInit } from '../config/sql';
import tCommon from '../sqlTemplate/TCommon';
import { getDbPath } from '../common/common';
import { insertJspInfo, insertJspInfoToDb, insertRouteJspKeyName, JspInfo } from '../common/jspHelper';

function insertJspClassXml(
  rootDir: string,
  tablesAll: Set<string>,
  objectAndTablesAll: ObjectAndTables,
  serviceXmlJspDirs: { service: DirectoryAndFilePattern; xml: string; jspDirectory: string }[]
): { jspInfos: JspInfo[]; classInfos: ClassInfo[]; xmlInfos: XmlInfo[] } {
  const classInfos: ClassInfo[] = [];
  const xmlInfos: XmlInfo[] = [];
  let jspInfos: JspInfo[] = [];

  serviceXmlJspDirs.forEach(({ service: { directory, file }, jspDirectory }) => {
    const initDir = resolve(rootDir, directory);

    if (jspDirectory) {
      let jspFullPaths: string[] = [];
      const fullDirJsp = resolve(rootDir, jspDirectory);
      if (existsSync(fullDirJsp)) {
        jspFullPaths = [...findFiles(fullDirJsp, '*.jsp')];
      }
      if (jspFullPaths.length) {
        jspInfos = insertJspInfo(fullDirJsp, jspFullPaths);
      }
    }

    for (const fullPath of [...findFiles(initDir, file)]) {
      const classInfo = insertClassInfo(rootDir, fullPath);
      if (classInfo) {
        classInfos.push(classInfo);
      }
    }
  });

  serviceXmlJspDirs.forEach(({ xml }) => {
    const fullDir = resolve(rootDir, xml);
    if (existsSync(fullDir)) {
      const fullPaths = statSync(fullDir).isDirectory() ? [...findFiles(fullDir, '*.xml')] : [fullDir];
      for (const fullPath of fullPaths) {
        const xmlInfo = insertXmlInfoXmlNodeInfo(rootDir, fullPath, tablesAll, objectAndTablesAll);
        if (xmlInfo) {
          xmlInfos.push(xmlInfo);
        }
      }
    }
  });

  return { jspInfos, classInfos, xmlInfos };
}

export function insertToDb() {
  const path = configReader.pathDatabase();
  if (existsSync(path)) {
    console.log(`Deleting ${path}`);
    unlinkSync(path);
  }

  console.log(`initDb`);
  tCommon.initDb(sqlInit);

  const { rootDir } = config.path.source;

  console.log(`insertTablesToDb`);
  const tablesAll = insertTablesToDb();

  console.log(`insertObjectAndTables`);
  const objectAndTablesAll = insertObjectAndTables(tablesAll);

  console.log(`insertKeyInfo`);
  tCommon.insertKeyInfo(config.path.source.main.map(({ keyName }) => ({ keyName })));

  console.log(`insertJspClassXml`);
  const {
    jspInfos: jspInfosDep,
    classInfos: classInfosDep,
    xmlInfos: xmlInfosDep,
  } = insertJspClassXml(rootDir, tablesAll, objectAndTablesAll, config.path.source.dependency);

  for (let i = 0; i < config.path.source.main.length; i++) {
    const {
      startings: { directory, file },
      serviceXmlJspDirs,
      keyName,
    } = config.path.source.main[i];

    const initDir = resolve(rootDir, directory);

    console.log(`insertClassInfo ${directory}`);
    const classInfosStarting: ClassInfo[] = [];
    for (const fullPath of [...findFiles(initDir, file)]) {
      const classInfo = insertClassInfo(rootDir, fullPath);
      if (classInfo) {
        classInfosStarting.push(classInfo);
      }
    }

    console.log(`insertJspClassXml ${directory}`);
    const {
      jspInfos: jspInfosMain,
      classInfos: classInfosMain,
      xmlInfos: xmlInfosMain,
    } = insertJspClassXml(
      rootDir,
      tablesAll,
      objectAndTablesAll,
      serviceXmlJspDirs.service.directory ? [serviceXmlJspDirs] : []
    );

    const jspPathsCur = [...jspInfosDep, ...jspInfosMain].map(({ jspPath }) => jspPath);
    const classInfosCur = [...classInfosDep, ...classInfosStarting, ...classInfosMain];
    const classInfosMerged = mergeExtends(classInfosCur);
    console.log(`insertMethodInfoFindKeyName ${directory}`);
    insertMethodInfoFindKeyName(keyName, jspPathsCur, classInfosMerged);

    const xmlInfosCur = [...xmlInfosDep, ...xmlInfosMain];
    console.log(`insertXmlInfoFindKeyName ${directory}`);
    insertXmlInfoFindKeyName(keyName, xmlInfosCur);
  }

  console.log(`insertRouteTableKeyName`);
  insertRouteTableKeyName();

  console.log(`insertRouteJspKeyName`);
  insertRouteJspKeyName();
}
