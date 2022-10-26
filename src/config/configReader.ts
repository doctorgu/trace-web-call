import { existsSync } from 'fs';
import betterSqlite3 from 'better-sqlite3';
import { regexpSqlite, testWildcardFileNameSqlite } from '../common/util';
import { ObjectType } from '../common/batisHelper';
import { config } from './config';
import { sqlCacheInit } from './sqlCache';

let _tables = new Set<string>();

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

  objectTypeAndPath: () => {
    const objectTypeAndPath = new Map<ObjectType, string>([
      ['view', config.path.data.views],
      ['function', config.path.data.functions],
      ['procedure', config.path.data.procedures],
    ]);
    return objectTypeAndPath;
  },
};
