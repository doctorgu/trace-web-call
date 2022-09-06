import { existsSync, statSync } from 'fs';
import { resolve } from 'path';
import { findFiles } from '../common/util';
import { ClassInfo, saveClassInfoToDb, saveMethodInfoFindToDb } from '../common/classHelper';
import { ObjectAndTables, saveTablesToDb, saveObjectAndTables, saveXmlInfoToDb, XmlInfo } from '../common/sqlHelper';
import { config, configReader } from '../config/config';
import { DirectoryAndFilePattern } from '../config/configTypes';
import { all, exec, execSql, get } from '../common/dbHelper';
import { mergeExtends } from '../common/traceHelper';
import { sqlInit } from '../config/sql';

function saveClassAndXmlToDb(
  rootDir: string,
  tablesAll: Set<string>,
  objectAndTablesAll: ObjectAndTables,
  serviceAndXmls: { service: DirectoryAndFilePattern; xml: string }[]
): { classInfos: ClassInfo[]; xmlInfos: XmlInfo[] } {
  console.log(
    `Inserting ClassInfo, HeaderInfo, MethodInfo ${serviceAndXmls.map((s) => s.service.directory).join(',')}`
  );
  const classInfos: ClassInfo[] = [];
  const xmlInfos: XmlInfo[] = [];

  serviceAndXmls.forEach(({ service: { directory, file } }) => {
    const initDir = resolve(rootDir, directory);

    for (const fullPath of [...findFiles(initDir, file)]) {
      const classInfo = saveClassInfoToDb(rootDir, fullPath);
      if (classInfo) {
        classInfos.push(classInfo);
      }
    }
  });

  console.log(`Inserting XmlInfo, XmlNodeInfo ${serviceAndXmls.map((s) => s.xml).join(',')}`);
  serviceAndXmls.forEach(({ xml }) => {
    const fullDir = resolve(rootDir, xml);
    if (existsSync(fullDir)) {
      const fullPaths = statSync(fullDir).isDirectory() ? [...findFiles(fullDir, '*.xml')] : [fullDir];
      for (const fullPath of fullPaths) {
        const xmlInfo = saveXmlInfoToDb(rootDir, fullPath, tablesAll, objectAndTablesAll);
        if (xmlInfo) {
          xmlInfos.push(xmlInfo);
        }
      }
    }
  });

  return { classInfos, xmlInfos };
}

export function saveToDb() {
  const db = configReader.db();

  // Delete foreign table first for speed.
  const tables = [
    'XmlNodeInfo',
    'XmlInfo',
    'MethodInfo',
    'MethodInfoFind',
    'HeaderInfo',
    'ClassInfo',
    'ObjectAndTables',
    'Tables',
  ];
  for (const tableName of tables) {
    const row = get(db, 'Common', 'selectTable', { tableName });
    if (!row) continue;

    console.log(`Truncating ${tableName}`);
    exec(db, 'Common', 'truncateTable', { tableName });
  }

  console.log(`Initializing all tables`);
  execSql(db, sqlInit);

  const { rootDir } = config.path.source;

  console.log(`Inserting Tables`);
  const tablesAll = saveTablesToDb();

  console.log(`Inserting ObjectAndTables`);
  const objectAndTablesAll = saveObjectAndTables(tablesAll);

  let classInfosAll: ClassInfo[] = [];
  let xmlInfosAll: XmlInfo[] = [];

  const { classInfos: classInfosDep, xmlInfos: xmlInfosDep } = saveClassAndXmlToDb(
    rootDir,
    tablesAll,
    objectAndTablesAll,
    config.path.source.dependency
  );
  classInfosAll = classInfosAll.concat(classInfosDep);
  xmlInfosAll = xmlInfosAll.concat(xmlInfosDep);

  for (let i = 0; i < config.path.source.main.length; i++) {
    const { startings, serviceAndXmls } = config.path.source.main[i];

    console.log(`Inserting startings ClassInfo, HeaderInfo, MethodInfo ${startings.map((c) => c.directory).join(',')}`);
    startings.forEach(({ directory, file }) => {
      const initDir = resolve(rootDir, directory);

      for (const fullPath of [...findFiles(initDir, file)]) {
        const classInfo = saveClassInfoToDb(rootDir, fullPath);
        if (classInfo) {
          classInfosAll.push(classInfo);
        }
      }
    });

    const { classInfos: classInfosMain, xmlInfos: xmlInfosMain } = saveClassAndXmlToDb(
      rootDir,
      tablesAll,
      objectAndTablesAll,
      serviceAndXmls
    );
    classInfosAll = classInfosAll.concat(classInfosMain);
    xmlInfosAll = xmlInfosAll.concat(xmlInfosMain);
  }

  const classInfosMerged = mergeExtends(classInfosAll);
  saveMethodInfoFindToDb(classInfosMerged);
}

saveToDb();
