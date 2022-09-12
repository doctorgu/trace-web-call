import { configReader } from '../config/config';
import betterSqlite3 from 'better-sqlite3';
import { ObjectAndTables, ObjectType } from '../common/sqlHelper';
import { escapeDollar } from '../common/util';
import { all, exec, get, run, SqlTemplate } from '../common/sqliteHelper';

class TTables {
  selectTables(): any[] {
    const db = configReader.db();

    const sql = `
select  name
from    Tables
order by name
  `;
    return all(sql);
  }

  insertTables(tables: Set<string>): betterSqlite3.RunResult {
    const db = configReader.db();

    const sql = `
insert into Tables
  (name)
values
  ${[...tables].map((table) => `('${table}')`).join(',')}
  `;
    return run(sql);
  }

  selectObjectAndTables(objectType: ObjectType): any[] {
    const db = configReader.db();

    const sql = `
select  object, tables
from    ObjectAndTables
where   objectType = @objectType
order by object
`;
    return all(sql, { objectType });
  }

  insertObjectAndTables(objectType: ObjectType, objectAndTables: ObjectAndTables): betterSqlite3.RunResult {
    const db = configReader.db();

    const sqlTmp = `
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

    return run(sql);
  }
}
export default new TTables();
