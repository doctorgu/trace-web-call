import { statSync, readdirSync } from 'fs';
import betterSqlite3 from 'better-sqlite3';
import { resolve } from 'path';
import { Config } from './configTypes';
import { readFileSyncUtf16le, regexpSqlite, testWildcardFileName, testWildcardFileNameSqlite } from '../common/util';
import { configOtherUserTable } from './configOtherUserTable';
import { configBzStoreApiBizgroup } from './configBzStoreApiBizgroup';
import { configBzManualApiCommon } from './configBzManualApiCommon';
import { configComposite } from './configComposite';
import { configBzPortalApiAccount } from './configBzPortalApiAccount';
import {
  insertTables,
  getTablesFromDb,
  ObjectType,
  ObjectAndTables,
  getObjectAndTablesByObjectType,
  getObjectAndTablesFromDb,
  insertObjectAndTables,
} from '../common/sqlHelper';
import { runSaveToDbFirst } from '../common/message';
import { execSql, get } from '../common/dbHelper';

let tablesCache = new Set<string>();
let objectTypeAndObjectAndTablesCache = new Map<ObjectType, ObjectAndTables>();

export const config: Config = configComposite;

let dbCache: betterSqlite3.Database | null = null;

export const configReader = {
  db: (): betterSqlite3.Database => {
    if (dbCache) return dbCache;

    const db = new betterSqlite3(config.path.database, { readonly: false });
    // enable on delete cascade on update cascade
    db.exec('PRAGMA foreign_keys=ON');
    db.function('testWildcardFileName', testWildcardFileNameSqlite);
    db.function('regexp', regexpSqlite);
    // const ret = db.prepare("select f from (select 'aaa' f union all select 'bbb') t where f = ?").pluck().get('aaa');
    // const ret2 = db
    //   .prepare("select f from (select 'aaa' f union all select 'bbb') t where f regexp ?")
    //   .pluck()
    //   .get('b.+');
    // const ret = db.prepare('select testWildcardFileName(?, ?, ?)').pluck().get('*a.txt', 'aaa.txt', 1);
    // const ret2 = db.prepare('select testWildcardFileName(?, ?, ?)').pluck().get('*a.txt', 'bbb.txt', 1);

    dbCache = db;

    return dbCache;
  },
  tables: (): Set<string> => {
    if (tablesCache.size) {
      return tablesCache;
    }

    const tablesDb = getTablesFromDb();
    if (!tablesDb.size) {
      throw new Error(runSaveToDbFirst);
    }

    tablesCache = tablesDb;
    return tablesCache;
  },
  objectAndTables: (objectType: ObjectType): ObjectAndTables => {
    if (!tablesCache.size) {
      throw new Error(`tablesCache.size: ${tablesCache.size} is 0.`);
    }

    let objectAndTablesCache = objectTypeAndObjectAndTablesCache.get(objectType);
    if (objectAndTablesCache) {
      return objectAndTablesCache;
    }

    const objectAndTablesDb = getObjectAndTablesFromDb(objectType);
    // if (!objectAndTablesDb.size) {
    //   throw new Error(runSaveToDbFirst);
    // }

    objectTypeAndObjectAndTablesCache.set(objectType, objectAndTablesDb);
    return objectTypeAndObjectAndTablesCache.get(objectType) as ObjectAndTables;
  },
  tablesInObject: () => {
    if (!tablesCache.size) {
      throw new Error(`tablesCache.size: ${tablesCache.size} is 0.`);
    }

    const tablesNew = new Set(tablesCache);

    [...configReader.objectAndTables('view')].forEach(([object, tablesCur]) => {
      tablesCur.forEach((t) => tablesNew.add(t));
    });
    [...configReader.objectAndTables('function')].forEach(([object, tablesCur]) => {
      tablesCur.forEach((t) => tablesNew.add(t));
    });
    [...configReader.objectAndTables('procedure')].forEach(([object, tablesCur]) => {
      tablesCur.forEach((t) => tablesNew.add(t));
    });

    return tablesNew;
  },
  objectType: (objectName: string) => {
    if (!tablesCache.size) {
      throw new Error(`tablesCache.size: ${tablesCache.size} is 0`);
    }
    if (!objectTypeAndObjectAndTablesCache.size) {
      throw new Error(`objectTypeAndObjectAndTablesCache.size: ${objectTypeAndObjectAndTablesCache.size} is 0`);
    }

    for (const [objectType, objectAndCache] of objectTypeAndObjectAndTablesCache) {
      if (objectAndCache.has(objectName)) return objectType;
    }

    throw new Error(`No objectName: ${objectName} in objectTypeAndObjectAndTablesCache`);
  },
};
