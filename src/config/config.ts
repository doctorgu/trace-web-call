import { statSync, readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { Config } from './configTypes';
import { configOtherUserTable } from './configOtherUserTable';
import { configBzStoreApiBizgroup } from './configBzStoreApiBizgroup';
import { configBzManualApiCommon } from './configBzManualApiCommon';
import { configComposite } from './configComposite';
import { ObjectType, ObjectAndTables, getObjectAndTablesByObjectType } from '../common/sqlHelper';

let tablesCache = new Set<string>();
let objectAndTablesCache = new Map<ObjectType, ObjectAndTables>();

export const config: Config = configComposite;

export const configReader = {
  tables: () => {
    if (tablesCache.size) {
      return tablesCache;
    }

    const path = config.path.data.tables;

    if (statSync(path).isDirectory()) {
      let values: string[] = [];

      const files = readdirSync(path);
      files.forEach((file) => {
        const value = readFileSync(resolve(path, file), 'utf-8');
        values = values.concat(value.split(/\r*\n/));
      });

      tablesCache = new Set(values.filter((v) => !!v).map((v) => v.toUpperCase()));
    } else {
      const value = readFileSync(path, 'utf-8');
      tablesCache = new Set(
        value
          .split(/\r*\n/)
          .filter((v) => !!v)
          .map((v) => v.toUpperCase())
      );
    }

    return tablesCache;
  },
  objectAndTables: (objectType: ObjectType) => {
    if (!tablesCache.size) {
      throw new Error(`tablesCache.size: ${tablesCache.size} is 0.`);
    }

    return getObjectAndTablesByObjectType(tablesCache, objectType, objectAndTablesCache);
  },
  tablesInObject: () => {
    if (!tablesCache.size) {
      throw new Error(`tablesCache.size: ${tablesCache.size} is 0.`);
    }

    const tablesNew = new Set(tablesCache);

    [...getObjectAndTablesByObjectType(tablesCache, 'view', objectAndTablesCache)].forEach(([object, tablesCur]) => {
      tablesCur.forEach((t) => tablesNew.add(t));
    });
    [...getObjectAndTablesByObjectType(tablesCache, 'function', objectAndTablesCache)].forEach(
      ([object, tablesCur]) => {
        tablesCur.forEach((t) => tablesNew.add(t));
      }
    );
    [...getObjectAndTablesByObjectType(tablesCache, 'procedure', objectAndTablesCache)].forEach(
      ([object, tablesCur]) => {
        tablesCur.forEach((t) => tablesNew.add(t));
      }
    );

    return tablesNew;
  },
  objectType: (objectName: string) => {
    if (!tablesCache.size) {
      throw new Error(`tablesCache.size: ${tablesCache.size} is 0`);
    }
    if (!objectAndTablesCache.size) {
      throw new Error(`objectAndTablesCache.size: ${objectAndTablesCache.size} is 0`);
    }

    for (const [objectType, objectAndCache] of objectAndTablesCache) {
      if (objectAndCache.has(objectName)) return objectType;
    }

    throw new Error(`No objectName: ${objectName} in objectAndTablesCache`);
  },
};
