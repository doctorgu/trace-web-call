import { existsSync, statSync, unlinkSync } from 'fs';
import { resolve } from 'path';
import { findFiles, logTimeMsg } from '../common/util';
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
import { DirectoryAndFilePattern } from '../config/ConfigType';
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
    if (jspDirectory) {
      let jspFullPaths: string[] = [];
      const fullJspDirectory = resolve(rootDir, jspDirectory);
      if (existsSync(fullJspDirectory)) {
        jspFullPaths = [...findFiles(fullJspDirectory, '*.jsp')];
      }
      if (jspFullPaths.length) {
        jspInfos = insertJspInfo(fullJspDirectory, jspFullPaths);
      }
    }

    if (directory) {
      const initDir = resolve(rootDir, directory);

      for (const fullPath of [...findFiles(initDir, file)]) {
        const classInfo = insertClassInfo(rootDir, fullPath);
        if (classInfo) {
          classInfos.push(classInfo);
        }
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
    logTimeMsg(`Deleting ${path}`);
    unlinkSync(path);
  }

  logTimeMsg(`initDb`);
  tCommon.initDb(sqlInit);

  const { rootDir } = config.path.source;

  logTimeMsg(`insertTablesToDb`);
  const tablesAll = insertTablesToDb();

  logTimeMsg(`insertObjectAndTables`);
  const objectAndTablesAll = insertObjectAndTables(tablesAll);

  logTimeMsg(`insertKeyInfo`);
  tCommon.insertKeyInfo(config.path.source.main.map(({ keyName }) => ({ keyName })));

  logTimeMsg(`insertJspClassXml`);
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

    const classInfosStarting: ClassInfo[] = [];

    if (directory) {
      const initDir = resolve(rootDir, directory);

      logTimeMsg(`insertClassInfo ${directory}`);
      for (const fullPath of [...findFiles(initDir, file)]) {
        const classInfo = insertClassInfo(rootDir, fullPath);
        if (classInfo) {
          classInfosStarting.push(classInfo);
        }
      }
    }

    logTimeMsg(`insertJspClassXml ${directory}`);
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
    logTimeMsg(`insertMethodInfoFindKeyName ${directory}`);
    insertMethodInfoFindKeyName(keyName, jspPathsCur, classInfosMerged);

    const xmlInfosCur = [...xmlInfosDep, ...xmlInfosMain];
    logTimeMsg(`insertXmlInfoFindKeyName ${directory}`);
    insertXmlInfoFindKeyName(keyName, xmlInfosCur);
  }

  logTimeMsg(`insertRouteTableKeyName`);
  insertRouteTableKeyName();

  logTimeMsg(`insertRouteJspKeyName`);
  insertRouteJspKeyName();
}
