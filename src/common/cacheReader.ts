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
};
