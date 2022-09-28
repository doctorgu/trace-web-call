import { getTablesFromDb, ObjectType } from './batisHelper';
import { runInsertToDbFirst } from './message';
import tCache from '../sqlTemplate/TCache';
import { configReader } from '../config/configReader';

let _tables = new Set<string>();
let _nameTypes = new Map<string, ObjectType>();

export const cacheReader = {
  tables: (): Set<string> => {
    if (_tables.size) {
      return _tables;
    }

    const tablesDb = getTablesFromDb();
    if (!tablesDb.size) {
      throw new Error(runInsertToDbFirst);
    }

    _tables = tablesDb;
    return _tables;
  },

  objectNameTypes: (): Map<string, ObjectType> => {
    if (_nameTypes.size) {
      return _nameTypes;
    }

    const typeAndPath = configReader.objectTypeAndPath();
    const rows = tCache.selectObjectsNameType(typeAndPath);
    _nameTypes = new Map<string, ObjectType>(rows.map(({ name, type }) => [name, type]));
    return _nameTypes;
  },
  objectType: (objectName: string): ObjectType => {
    const nameTypes = cacheReader.objectNameTypes();
    const type = nameTypes.get(objectName);
    if (!type) {
      throw new Error(`No objectName: ${objectName} in nameTypes`);
    }

    return type;
  },
};
