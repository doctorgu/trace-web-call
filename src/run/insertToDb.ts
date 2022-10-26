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
  getUsersFromDb,
  insertUsersToDb,
} from '../common/sqlMapperHelper';
import { ObjectInfo } from '../common/batisHelper';
import { config } from '../config/config';
import { configReader } from '../config/configReader';
import { DirectoryAndFilePattern } from '../config/ConfigType';
import { mergeExtends } from '../common/traceHelper';
import { sqlInit } from '../config/sql';
import tCommon from '../sqlTemplate/TCommon';
import { insertJspInfo, insertRouteJspKeyName, JspInfo } from '../common/jspHelper';
import { BatchJob, BeanSql, BeanTargetObject, insertBatchInfo, insertRouteBatchKeyName } from '../common/batchHelper';

function insertJspClassXml(
  rootDir: string,
  usersAll: Set<string>,
  tablesAll: Set<string>,
  tablesAllNoSchema: Set<string>,
  nameObjectsAll: Map<string, ObjectInfo>,
  nameObjectsAllNoSchema: Map<string, ObjectInfo>,
  keyName: string,
  service: DirectoryAndFilePattern,
  xml: string,
  jspDirectory: string
): { jspInfos: JspInfo[]; classInfos: ClassInfo[]; xmlInfos: XmlInfo[] } {
  const classInfos: ClassInfo[] = [];
  const xmlInfos: XmlInfo[] = [];
  let jspInfos: JspInfo[] = [];

  const { directory, file } = service;
  if (directory) {
    const initDir = resolve(rootDir, directory);
    for (const fullPath of [...findFiles(initDir, file)]) {
      const classInfo = insertClassInfo(rootDir, fullPath);
      if (classInfo) {
        classInfos.push(classInfo);
      }
    }
  }

  if (xml) {
    const fullDir = resolve(rootDir, xml);
    if (existsSync(fullDir)) {
      const fullPaths = statSync(fullDir).isDirectory() ? [...findFiles(fullDir, '*.xml')] : [fullDir];
      for (const fullPath of fullPaths) {
        const xmlInfo = insertXmlInfoXmlNodeInfo(
          rootDir,
          fullPath,
          usersAll,
          tablesAll,
          tablesAllNoSchema,
          nameObjectsAll,
          nameObjectsAllNoSchema
        );
        if (xmlInfo) {
          xmlInfos.push(xmlInfo);
        }
      }
    }
  }

  if (jspDirectory) {
    let jspFullPaths: string[] = [];
    const fullJspDirectory = resolve(rootDir, jspDirectory);
    if (existsSync(fullJspDirectory)) {
      jspFullPaths = [...findFiles(fullJspDirectory, '*.jsp')];
    }
    if (jspFullPaths.length) {
      jspInfos = insertJspInfo(keyName, fullJspDirectory, jspFullPaths);
    }
  }

  return { classInfos, xmlInfos, jspInfos };
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

  let usersAll = getUsersFromDb();
  if (usersAll.size) {
    startTime = logTimeMsg(startTime, `insertUsersToDb skipped`);
  } else {
    usersAll = insertUsersToDb();
    startTime = logTimeMsg(startTime, `insertUsersToDb`);
  }

  let { tables: tablesAll, tablesNoSchema: tablesAllNoSchema } = getTablesFromDb();
  if (tablesAll.size) {
    startTime = logTimeMsg(startTime, `insertTablesToDb skipped`);
  } else {
    const ret = insertTablesToDb();
    tablesAll = ret.tables;
    tablesAllNoSchema = ret.tablesNoSchema;
    startTime = logTimeMsg(startTime, `insertTablesToDb`);
  }

  let { nameObjects: nameObjectsAll, nameObjectsNoSchema: nameObjectsAllNoSchema } = getNameObjectsAllFromDb();
  if (nameObjectsAll.size) {
    startTime = logTimeMsg(startTime, `insertObjects skipped`);
  } else {
    const ret = insertObjects(usersAll, tablesAll, tablesAllNoSchema);
    nameObjectsAll = ret.nameObjects;
    nameObjectsAllNoSchema = ret.nameObjectsNoSchema;
    startTime = logTimeMsg(startTime, `insertObjects`);
  }

  tCommon.insertKeyInfo(config.path.source.main.map(({ keyName }) => ({ keyName })));
  startTime = logTimeMsg(startTime, `insertKeyInfo`);

  let classInfosDepAll: ClassInfo[] = [];
  let xmlInfosDepAll: XmlInfo[] = [];
  for (const { keyName, service, xml } of config.path.source.dependency) {
    const { classInfos: classInfosDep, xmlInfos: xmlInfosDep } = insertJspClassXml(
      rootDir,
      usersAll,
      tablesAll,
      tablesAllNoSchema,
      nameObjectsAll,
      nameObjectsAllNoSchema,
      keyName,
      service,
      xml,
      ''
    );
    startTime = logTimeMsg(startTime, `insertJspClassXml Dependency ${keyName}`);

    classInfosDepAll = classInfosDepAll.concat(classInfosDep);
    xmlInfosDepAll = xmlInfosDepAll.concat(xmlInfosDep);
  }

  for (let i = 0; i < config.path.source.main.length; i++) {
    const {
      startings: { directory, file },
      keyName,
      service,
      xmlDirectory: xml,
      jspDirectory,
    } = config.path.source.main[i];

    const classInfosStarting: ClassInfo[] = [];
    if (directory) {
      const initDir = resolve(rootDir, directory);

      for (const fullPath of [...findFiles(initDir, file)]) {
        if (config.startingPoint === 'springBatch') {
          insertBatchInfo(
            keyName,
            rootDir,
            fullPath,
            usersAll,
            tablesAll,
            tablesAllNoSchema,
            nameObjectsAll,
            nameObjectsAllNoSchema
          );
        } else {
          const classInfo = insertClassInfo(rootDir, fullPath);
          if (classInfo) {
            classInfosStarting.push(classInfo);
          }
        }
      }
      startTime = logTimeMsg(startTime, `insertClassInfo Starting ${directory}`);
    }

    const {
      classInfos: classInfosMain,
      xmlInfos: xmlInfosMain,
      jspInfos: jspInfosMain,
    } = insertJspClassXml(
      rootDir,
      usersAll,
      tablesAll,
      tablesAllNoSchema,
      nameObjectsAll,
      nameObjectsAllNoSchema,
      keyName,
      service,
      xml,
      jspDirectory
    );
    startTime = logTimeMsg(startTime, `insertJspClassXml Main ${directory}`);

    const jspPathsCur = jspInfosMain.map(({ jspPath }) => jspPath);
    const classInfosCur = [...classInfosDepAll, ...classInfosStarting, ...classInfosMain];
    const classInfosMerged = mergeExtends(classInfosCur);
    insertMethodInfoFindKeyName(keyName, jspPathsCur, classInfosMerged);
    startTime = logTimeMsg(startTime, `insertMethodInfoFindKeyName ${directory}`);

    const xmlInfosCur = [...xmlInfosDepAll, ...xmlInfosMain];
    insertXmlInfoFindKeyName(keyName, xmlInfosCur);
    startTime = logTimeMsg(startTime, `insertXmlInfoFindKeyName ${directory}`);
  }

  insertRouteTableKeyName();
  startTime = logTimeMsg(startTime, `insertRouteTableKeyName`);

  insertRouteJspKeyName();
  startTime = logTimeMsg(startTime, `insertRouteJspKeyName`);

  insertRouteBatchKeyName();
  startTime = logTimeMsg(startTime, `insertRouteBatchKeyName`);
}
