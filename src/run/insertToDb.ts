import { existsSync, statSync, unlinkSync } from 'fs';
import { resolve } from 'path';
import { findFiles } from '../common/util';
import {
  ClassInfo,
  getFindsByClassPathClassNameFromDb,
  insertClassInfo,
  insertMethodInfoFindKeyName,
  insertRouteInfoKeyName,
} from '../common/classHelper';
import {
  ObjectAndTables,
  insertTablesToDb,
  insertObjectAndTables,
  insertXmlInfoXmlNodeInfo,
  XmlInfo,
  insertXmlInfoFindKeyName,
} from '../common/sqlHelper';
import { config, configReader } from '../config/config';
import { DirectoryAndFilePattern } from '../config/configTypes';
import { mergeExtends } from '../common/traceHelper';
import { sqlInit } from '../config/sql';
import tCommon from '../sqlTemplate/TCommon';
import TXmlInfo from '../sqlTemplate/TXmlInfo';

function insertClassAndXml(
  rootDir: string,
  tablesAll: Set<string>,
  objectAndTablesAll: ObjectAndTables,
  serviceAndXmls: { service: DirectoryAndFilePattern; xml: string }[]
): { classInfos: ClassInfo[]; xmlInfos: XmlInfo[] } {
  const classInfos: ClassInfo[] = [];
  const xmlInfos: XmlInfo[] = [];

  serviceAndXmls.forEach(({ service: { directory, file } }) => {
    const initDir = resolve(rootDir, directory);

    for (const fullPath of [...findFiles(initDir, file)]) {
      const classInfo = insertClassInfo(rootDir, fullPath);
      if (classInfo) {
        classInfos.push(classInfo);
      }
    }
  });

  serviceAndXmls.forEach(({ xml }) => {
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

  return { classInfos, xmlInfos };
}

export function insertToDb() {
  if (existsSync(config.path.database)) {
    console.log(`Deleting ${config.path.database}`);
    unlinkSync(config.path.database);
  }

  console.log(`initDb`);
  tCommon.initDb(sqlInit);

  const { rootDir } = config.path.source;

  console.log(`insertTablesToDb`);
  const tablesAll = insertTablesToDb();

  console.log(`insertObjectAndTables`);
  const objectAndTablesAll = insertObjectAndTables(tablesAll);

  const { classInfos: classInfosDep, xmlInfos: xmlInfosDep } = insertClassAndXml(
    rootDir,
    tablesAll,
    objectAndTablesAll,
    config.path.source.dependency
  );

  for (let i = 0; i < config.path.source.main.length; i++) {
    const {
      startings: { directory, file },
      serviceAndXmls,
      keyName,
    } = config.path.source.main[i];

    const initDir = resolve(rootDir, directory);

    const classInfosStarting: ClassInfo[] = [];
    for (const fullPath of [...findFiles(initDir, file)]) {
      const classInfo = insertClassInfo(rootDir, fullPath);
      if (classInfo) {
        classInfosStarting.push(classInfo);
      }
    }

    console.log(`insertClassAndXml ${directory}`);
    const { classInfos: classInfosMain, xmlInfos: xmlInfosMain } = insertClassAndXml(
      rootDir,
      tablesAll,
      objectAndTablesAll,
      serviceAndXmls
    );

    const classInfosCur = [...classInfosDep, ...classInfosStarting, ...classInfosMain];
    const classInfosMerged = mergeExtends(classInfosCur);
    console.log(`insertMethodInfoFindKeyName ${directory}`);
    insertMethodInfoFindKeyName(keyName, classInfosMerged);

    const xmlInfosCur = [...xmlInfosDep, ...xmlInfosMain];
    console.log(`insertXmlInfoFindKeyName ${directory}`);
    insertXmlInfoFindKeyName(keyName, xmlInfosCur);
  }

  console.log(`insertRouteInfoKeyName`);
  insertRouteInfoKeyName();
}
