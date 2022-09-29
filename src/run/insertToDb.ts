import { existsSync, statSync, unlinkSync } from 'fs';
import { resolve } from 'path';
import { findFiles, logTimeMsg } from '../common/util';
import {
  ClassInfo,
  insertClassInfo,
  insertMethodInfoFindKeyName,
  insertRouteTableKeyName,
} from '../common/classHelper';
import {
  insertTablesToDb,
  insertObjects,
  insertXmlInfoXmlNodeInfo,
  XmlInfo,
  insertXmlInfoFindKeyName,
  getTablesFromDb,
  getNameObjectsAllFromDb,
  ObjectType,
  ObjectInfo,
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
  nameObjectsAll: Map<string, ObjectInfo>,
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
        const xmlInfo = insertXmlInfoXmlNodeInfo(rootDir, fullPath, tablesAll, nameObjectsAll);
        if (xmlInfo) {
          xmlInfos.push(xmlInfo);
        }
      }
    }
  });

  return { jspInfos, classInfos, xmlInfos };
}

export function insertToDb() {
  let startTime = new Date(0).getTime();

  const path = configReader.pathDatabase();
  if (existsSync(path)) {
    unlinkSync(path);
    startTime = logTimeMsg(startTime, `Deleting ${path}`);
  }

  tCommon.initDb(sqlInit);
  startTime = logTimeMsg(startTime, `initDb`);

  const { rootDir } = config.path.source;

  let tablesAll = getTablesFromDb();
  if (tablesAll.size) {
    startTime = logTimeMsg(startTime, `insertTablesToDb skipped`);
  } else {
    tablesAll = insertTablesToDb();
    startTime = logTimeMsg(startTime, `insertTablesToDb`);
  }

  let nameObjectsAll = getNameObjectsAllFromDb();
  if (nameObjectsAll.size) {
    startTime = logTimeMsg(startTime, `insertObjects skipped`);
  } else {
    nameObjectsAll = insertObjects(tablesAll);
    startTime = logTimeMsg(startTime, `insertObjects`);
  }

  tCommon.insertKeyInfo(config.path.source.main.map(({ keyName }) => ({ keyName })));
  startTime = logTimeMsg(startTime, `insertKeyInfo`);

  const {
    jspInfos: jspInfosDep,
    classInfos: classInfosDep,
    xmlInfos: xmlInfosDep,
  } = insertJspClassXml(rootDir, tablesAll, nameObjectsAll, config.path.source.dependency);
  startTime = logTimeMsg(startTime, `insertJspClassXml Dependency`);

  for (let i = 0; i < config.path.source.main.length; i++) {
    const {
      startings: { directory, file },
      serviceXmlJspDirs,
      keyName,
    } = config.path.source.main[i];

    const classInfosStarting: ClassInfo[] = [];
    if (directory) {
      const initDir = resolve(rootDir, directory);

      for (const fullPath of [...findFiles(initDir, file)]) {
        const classInfo = insertClassInfo(rootDir, fullPath);
        if (classInfo) {
          classInfosStarting.push(classInfo);
        }
      }
      startTime = logTimeMsg(startTime, `insertClassInfo Starting ${directory}`);
    }

    const {
      jspInfos: jspInfosMain,
      classInfos: classInfosMain,
      xmlInfos: xmlInfosMain,
    } = insertJspClassXml(
      rootDir,
      tablesAll,
      nameObjectsAll,
      serviceXmlJspDirs.service.directory ? [serviceXmlJspDirs] : []
    );
    startTime = logTimeMsg(startTime, `insertJspClassXml Main ${directory}`);

    const jspPathsCur = [...jspInfosDep, ...jspInfosMain].map(({ jspPath }) => jspPath);
    const classInfosCur = [...classInfosDep, ...classInfosStarting, ...classInfosMain];
    const classInfosMerged = mergeExtends(classInfosCur);
    insertMethodInfoFindKeyName(keyName, jspPathsCur, classInfosMerged);
    startTime = logTimeMsg(startTime, `insertMethodInfoFindKeyName ${directory}`);

    const xmlInfosCur = [...xmlInfosDep, ...xmlInfosMain];
    insertXmlInfoFindKeyName(keyName, xmlInfosCur);
    startTime = logTimeMsg(startTime, `insertXmlInfoFindKeyName ${directory}`);
  }

  insertRouteTableKeyName();
  startTime = logTimeMsg(startTime, `insertRouteTableKeyName`);

  insertRouteJspKeyName();
  startTime = logTimeMsg(startTime, `insertRouteJspKeyName`);
}
