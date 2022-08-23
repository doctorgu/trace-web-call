import { statSync, readdirSync, readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { ObjectType, ObjectAndTables, getObjectAndTablesByObjectType } from '../common/sqlHelper';

type OutputType = 'txt' | 'csv';

type Config = {
  path: {
    controllers: string[];
    service: {
      directory: string;
      file: string | RegExp;
    };
    xml: string;
    data: {
      tables: string;
      views: string;
      functions: string;
      procedures: string;
    };
    outputDirectory: string;
    test: string;
  };
  outputType: OutputType;
  tables: () => Set<string>;
  tablesInObject: () => Set<string>;
  objectAndTables: (objectType: ObjectType) => ObjectAndTables;
  objectType: (objectName: string) => ObjectType;
};

let tablesCache = new Set<string>();
let objectAndTablesCache = new Map<ObjectType, ObjectAndTables>();

export const config: Config = {
  path: {
    controllers: [
      'D:\\Temp\\kbbizmicro-sb\\bz-store-api-bizgroup\\src\\main\\java\\biz\\micro\\portal\\store\\api\\bizgroup\\controller',
      // 'D:\\Temp\\kbbizmicro-sb\\bz-manual-api-common\\src\\main\\java\\biz\\micro\\portal\\manual\\api\\common\\controller',
    ],
    service: {
      directory:
        'D:\\Temp\\kbbizmicro-sb\\bz-store-api-bizgroup\\src\\main\\java\\biz\\micro\\portal\\store\\api\\bizgroup\\spring\\service',
      file: /.+Impl\.java|.+DAO\.java/,
    },

    // 'D:\\Temp\\kbbizmicro-sb\\bz-manual-api-common\\src\\main\\java\\biz\\micro\\portal\\manual\\api\\common\\spring\\service',
    xml: 'D:\\Temp\\kbbizmicro-sb\\bz-store-api-bizgroup\\src\\main\\resources\\sql\\oracle',
    // 'D:\\Temp\\kbbizmicro-sb\\bz-manual-api-common\\src\\main\\resources\\sql\\oracle',
    data: {
      tables: './data/tables.txt',
      views: './data/views',
      functions: './data/functions',
      procedures: './data/procedures',
    },
    outputDirectory: './output',
    test: './test',
  },
  outputType: 'txt',
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
