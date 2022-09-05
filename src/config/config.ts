import { statSync, readdirSync } from 'fs';
import betterSqlite3 from 'better-sqlite3';
import { resolve } from 'path';
import { Config } from './configTypes';
import { readFileSyncUtf16le } from '../common/util';
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

let tablesCache = new Set<string>();
let objectTypeAndObjectAndTablesCache = new Map<ObjectType, ObjectAndTables>();

export const config: Config = configComposite;

let dbCache: betterSqlite3.Database | null = null;

export const configReader = {
  db: (): betterSqlite3.Database => {
    if (dbCache) return dbCache;

    const db = new betterSqlite3(config.path.database);
    // enable on delete cascade on update cascade
    db.exec('PRAGMA foreign_keys=ON');
    dbCache = db;

    return dbCache;
  },
  tables: (): Set<string> => {
    if (tablesCache.size) {
      return tablesCache;
    }

    let tablesNew = new Set<string>();
    const tablesDb = getTablesFromDb();
    if (tablesDb.size) {
      tablesCache = tablesDb;
      return tablesCache;
    }

    const path = config.path.data.tables;

    if (statSync(path).isDirectory()) {
      let values: string[] = [];

      const files = readdirSync(path);
      files.forEach((file) => {
        const value = readFileSyncUtf16le(resolve(path, file));
        values = values.concat(value.split(/\r*\n/));
      });

      tablesNew = new Set(values.filter((v) => !!v).map((v) => v.toUpperCase()));
    } else {
      const value = readFileSyncUtf16le(path);
      tablesNew = new Set(
        value
          .split(/\r*\n/)
          .filter((v) => !!v)
          .map((v) => v.toUpperCase())
      );
    }

    insertTables(tablesNew);
    tablesCache = tablesNew;
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
    if (objectAndTablesDb.size) {
      objectTypeAndObjectAndTablesCache.set(objectType, objectAndTablesDb);
      return objectTypeAndObjectAndTablesCache.get(objectType) as ObjectAndTables;
    }

    const objectAndTablesRet = getObjectAndTablesByObjectType(objectType, tablesCache);

    insertObjectAndTables(objectType, objectAndTablesRet);
    objectTypeAndObjectAndTablesCache.set(objectType, objectAndTablesRet);
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
