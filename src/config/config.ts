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
import { getTablesFromDb, ObjectType, ObjectAndTables, getObjectAndTablesFromDb } from '../common/sqlHelper';
import { runinsertToDbFirst } from '../common/message';

let tablesCache = new Set<string>();
let objectTypeAndObjectAndTablesCache = new Map<ObjectType, ObjectAndTables>();

export const config: Config = configComposite;

let dbCache: betterSqlite3.Database | null = null;

export const configReader = {
  db: (): betterSqlite3.Database => {
    if (dbCache) return dbCache;

    const db = new betterSqlite3(config.path.database, { readonly: false });
    // enable on delete cascade on update cascade
    db.exec(`
    PRAGMA foreign_keys=ON;
    PRAGMA cache_size = -200000; -- 200MB
    `);
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
      throw new Error(runinsertToDbFirst);
    }

    tablesCache = tablesDb;
    return tablesCache;
  },
  objectTypeAndObjectAndTables: (): Map<ObjectType, ObjectAndTables> => {
    if (objectTypeAndObjectAndTablesCache.size) {
      return objectTypeAndObjectAndTablesCache;
    }

    const objectTypes: ObjectType[] = ['view', 'function', 'procedure'];
    for (const objectType of objectTypes) {
      const objectAndTablesDb = getObjectAndTablesFromDb(objectType);
      objectTypeAndObjectAndTablesCache.set(objectType, objectAndTablesDb);
    }

    return objectTypeAndObjectAndTablesCache;
  },
  objectAndTables: (objectType: ObjectType): ObjectAndTables => {
    const objectTypeAndObjectAndTables = configReader.objectTypeAndObjectAndTables();

    const objectAndTables = objectTypeAndObjectAndTables.get(objectType);
    if (!objectAndTables) return new Map<string, Set<string>>();

    return objectAndTables;
  },
  tablesInObject: () => {
    const tablesNew = configReader.tables();

    configReader.objectAndTables('view').forEach((tablesCur) => {
      tablesCur.forEach((t) => tablesNew.add(t));
    });
    configReader.objectAndTables('function').forEach((tablesCur) => {
      tablesCur.forEach((t) => tablesNew.add(t));
    });
    configReader.objectAndTables('procedure').forEach((tablesCur) => {
      tablesCur.forEach((t) => tablesNew.add(t));
    });

    return tablesNew;
  },
  objectType: (objectName: string) => {
    for (const [objectType, objectAndCache] of configReader.objectTypeAndObjectAndTables()) {
      if (objectAndCache.has(objectName)) return objectType;
    }

    throw new Error(`No objectName: ${objectName} in objectTypeAndObjectAndTablesCache`);
  },
};
