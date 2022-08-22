import { statSync, readdirSync, readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { ObjectAndTables, getObjectAndTables } from '../common/sqlHelper';

type ObjectType = 'view' | 'function' | 'procedure';

type Config = {
  path: {
    controller: string;
    service: string;
    xml: string;
    data: {
      tables: string;
      views: string;
      functions: string;
      procedures: string;
    };
    output: {
      mapToTables: string;
      routes: string;
    };
    test: string;
  };
  tables: () => Set<string>;
  tablesInObject: () => Set<string>;
  objectAndTables: (objectType: ObjectType) => ObjectAndTables;
  objectType: (objectName: string) => ObjectType;
};

let tablesCache = new Set<string>();
let objectAndTablesCache = new Map<ObjectType, ObjectAndTables>();

function getObjectAndTablesByObjectType(tables: Set<string>, objectType: ObjectType): ObjectAndTables {
  const objectAndTablesNew = objectAndTablesCache.get(objectType);
  if (objectAndTablesNew) {
    return objectAndTablesNew;
  }

  const objectAndTables: ObjectAndTables = new Map<string, Set<string>>();

  let path = '';
  switch (objectType) {
    case 'view':
      path = config.path.data.views;
      break;
    case 'function':
      path = config.path.data.functions;
      break;
    case 'procedure':
      path = config.path.data.procedures;
      break;
    default:
      throw new Error(`Wrong objectType: ${objectType}`);
  }

  if (!existsSync(path)) {
    objectAndTablesCache.set(objectType, objectAndTables);
  } else {
    if (statSync(path).isDirectory()) {
      const files = readdirSync(path);
      files.forEach((file) => {
        const value = readFileSync(resolve(path, file), 'utf-8');
        const objectAndTablesCur = getObjectAndTables(value, tables);
        [...objectAndTablesCur].forEach(([view, tables]) => {
          objectAndTables.set(view, tables);
        });
      });

      objectAndTablesCache.set(objectType, objectAndTables);
    } else {
      const value = readFileSync(path, 'utf-8');
      const objectAndTables = getObjectAndTables(value, tables);

      objectAndTablesCache.set(objectType, objectAndTables);
    }
  }

  const objectAndTablesNew2 = objectAndTablesCache.get(objectType);
  if (!objectAndTablesNew2) {
    throw new Error(`Wrong objectAndTablesNew2: ${objectAndTablesNew2}`);
  }

  return objectAndTablesNew2;
}

export const config: Config = {
  path: {
    controller:
      'D:\\Temp\\kbbizmicro-sb\\bz-store-api-bizgroup\\src\\main\\java\\biz\\micro\\portal\\store\\api\\bizgroup\\controller',
    //'D:\\Temp\\kbbizmicro-sb\\bz-manual-api-common\\src\\main\\java\\biz\\micro\\portal\\manual\\api\\common\\controller',
    service:
      'D:\\Temp\\kbbizmicro-sb\\bz-store-api-bizgroup\\src\\main\\java\\biz\\micro\\portal\\store\\api\\bizgroup\\spring\\service',
    //'D:\\Temp\\kbbizmicro-sb\\bz-manual-api-common\\src\\main\\java\\biz\\micro\\portal\\manual\\api\\common\\spring\\service',
    xml: 'D:\\Temp\\kbbizmicro-sb\\bz-store-api-bizgroup\\src\\main\\resources\\sql\\oracle',
    //'D:\\Temp\\kbbizmicro-sb\\bz-manual-api-common\\src\\main\\resources\\sql\\oracle',
    data: {
      tables: './data/tables.txt',
      views: './data/views.sql',
      functions: './data/functions.sql',
      procedures: './data/procedures.sql',
    },
    output: {
      mapToTables: './output/mapToTables.txt',
      routes: './output/routes.txt',
    },
    test: './test',
  },
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

      tablesCache = new Set(values.filter((v) => !!v));
    } else {
      const value = readFileSync(path, 'utf-8');
      tablesCache = new Set(value.split(/\r*\n/).filter((v) => !!v));
    }

    return tablesCache;
  },
  objectAndTables: (objectType: ObjectType) => {
    if (!tablesCache.size) {
      throw new Error(`tablesCache.size: ${tablesCache.size} is 0.`);
    }

    return getObjectAndTablesByObjectType(tablesCache, objectType);
  },
  tablesInObject: () => {
    if (!tablesCache.size) {
      throw new Error(`tablesCache.size: ${tablesCache.size} is 0.`);
    }

    const tablesNew = new Set(tablesCache);

    [...getObjectAndTablesByObjectType(tablesCache, 'view')].forEach(([object, tablesCur]) => {
      tablesCur.forEach((t) => tablesNew.add(t));
    });
    [...getObjectAndTablesByObjectType(tablesCache, 'function')].forEach(([object, tablesCur]) => {
      tablesCur.forEach((t) => tablesNew.add(t));
    });
    [...getObjectAndTablesByObjectType(tablesCache, 'procedure')].forEach(([object, tablesCur]) => {
      tablesCur.forEach((t) => tablesNew.add(t));
    });

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
