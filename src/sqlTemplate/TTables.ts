import { configReader } from '../config/configReader';
import betterSqlite3 from 'better-sqlite3';
import { ObjectAndTables, ObjectType } from '../common/sqlHelper';
import { escapeDollar } from '../common/util';
import { all, exec, get, run, SqlTemplate } from '../common/sqliteHelper';

class TTables {
  selectTables(): any[] {
    const sql = `
select  name
from    Tables
order by name
  `;
    return all(configReader.db(), sql);
  }

  insertTables(tables: Set<string>): betterSqlite3.Database {
    const sql = `
delete from Tables;

insert into Tables
  (name)
values
  ${[...tables].map((table) => `('${table}')`).join(',')}
  `;
    return exec(configReader.db(), sql);
  }

  selectObjectAndTables(objectType: ObjectType): any[] {
    const sql = `
select  object, tables
from    ObjectAndTables
where   objectType = @objectType
order by object
`;
    return all(configReader.db(), sql, { objectType });
  }

  insertObjectAndTables(objectType: ObjectType, objectAndTables: ObjectAndTables): betterSqlite3.Database {
    const sqlTmp = `
delete from objectAndTables;

insert into objectAndTables
  (object, objectType, tables)
values
  {values}
`;
    const sqlTmpValues = `
({object}, {objectType}, {tables})
`;

    const params = [...objectAndTables].map(([object, tables]) => ({
      object,
      objectType,
      tables: JSON.stringify([...tables]),
    }));
    const sqlValues = new SqlTemplate(sqlTmpValues).replaceAlls(params, ',\n');
    const sql = sqlTmp.replace('{values}', escapeDollar(sqlValues));

    return exec(configReader.db(), sql);
  }
}
export default new TTables();
