import { existsSync, statSync, readdirSync } from 'fs';
import betterSqlite3 from 'better-sqlite3';
import { readFileSyncUtf16le, regexpSqlite, testWildcardFileName, testWildcardFileNameSqlite } from '../common/util';
import { getTablesFromDb, ObjectType, ObjectAndTables, getObjectAndTablesFromDb } from '../common/sqlHelper';
import { runinsertToDbFirst } from '../common/message';
import { config } from './config';
import { sqlCacheInit } from './sqlCache';

let _tables = new Set<string>();
let _objectTypeAndObjectAndTables = new Map<ObjectType, ObjectAndTables>();

let _db: betterSqlite3.Database | null = null;
let _dbCache: betterSqlite3.Database | null = null;

export const configReader = {
  pathDatabase: (): string => `${config.path.databaseDirectory}/${config.name}.db`,
  pathDatabaseCache: (): string => `${config.path.databaseDirectory}/Cache.db`,

  db: (): betterSqlite3.Database => {
    if (_db) return _db;

    const db = new betterSqlite3(configReader.pathDatabase(), { readonly: false });
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

    _db = db;

    return _db;
  },
  dbCache: (): betterSqlite3.Database => {
    if (_dbCache) return _dbCache;

    const path = configReader.pathDatabaseCache();
    const exists = existsSync(path);
    const db = new betterSqlite3(path);
    if (!exists) {
      db.exec(sqlCacheInit);
    }

    db.exec(`
    PRAGMA cache_size = -200000; -- 200MB
    `);
    _dbCache = db;

    return _dbCache;
  },
  tables: (): Set<string> => {
    if (_tables.size) {
      return _tables;
    }

    const tablesDb = getTablesFromDb();
    if (!tablesDb.size) {
      throw new Error(runinsertToDbFirst);
    }

    _tables = tablesDb;
    return _tables;
  },
  objectTypeAndObjectAndTables: (): Map<ObjectType, ObjectAndTables> => {
    if (_objectTypeAndObjectAndTables.size) {
      return _objectTypeAndObjectAndTables;
    }

    const objectTypes: ObjectType[] = ['view', 'function', 'procedure'];
    for (const objectType of objectTypes) {
      const objectAndTablesDb = getObjectAndTablesFromDb(objectType);
      _objectTypeAndObjectAndTables.set(objectType, objectAndTablesDb);
    }

    return _objectTypeAndObjectAndTables;
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
