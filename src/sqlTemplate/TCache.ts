import { all, exec, get, pluck, run } from '../common/sqliteHelper';
import { escapeDollar } from '../common/util';
import { SqlTemplate } from '../common/sqliteHelper';
import { configReader } from '../config/configReader';
import { HeaderInfo, MethodInfo, MethodInfoFind } from '../common/classHelper';
import betterSqlite3 from 'better-sqlite3';
import { ObjectAndTables, ObjectType } from '../common/batisHelper';

class TCache {
  selectTables(path: string): any[] {
    const sql = `
select  name
from    Tables
where   path = @path
order by name
  `;
    return all(configReader.dbCache(), sql, { path });
  }

  insertTables(path: string, tables: Set<string>): betterSqlite3.Database {
    const sql = `
insert into Tables
  (path, name)
values
  ${[...tables].map((table) => `('${path}', '${table}')`).join(',')}
  `;
    return exec(configReader.dbCache(), sql);
  }

  selectObjectAndTables(path: string, objectType: ObjectType): any[] {
    const sql = `
select  object, tables
from    ObjectAndTables
where   path = @path
        and objectType = @objectType
order by object
`;
    return all(configReader.dbCache(), sql, { path, objectType });
  }

  insertObjectAndTables(
    objectTypeAndPath: Map<ObjectType, string>,
    objectTypeAndObjectAndTables: Map<ObjectType, ObjectAndTables>
  ): betterSqlite3.Database {
    const sqlTmp = `
insert into objectAndTables
  (
    path, objectType,
    object, objectParent, 
    objects,
    tables, tablesInsert, tablesUpdate, tablesDelete, tablesSelect
  )
values
  {values}
`;
    const sqlTmpValues = `
  (
    {path}, {objectType},
    {object}, {objectParent},
    {objects},
    {tables}, {tablesInsert}, {tablesUpdate}, {tablesDelete}, {tablesSelect}
  )
`;

    const params = [...objectTypeAndObjectAndTables]
      .map(([objectType, objectAndTables]) => {
        return [...objectAndTables].map(([object, tables]) => ({
          path: objectTypeAndPath.get(objectType),
          objectType,
          object,
          tables: JSON.stringify([...tables]),
        }));
      })
      .flat();
    const sqlValues = new SqlTemplate(sqlTmpValues).replaceAlls(params, ',\n');
    const sql = sqlTmp.replace('{values}', escapeDollar(sqlValues));

    return exec(configReader.dbCache(), sql);
  }

  selectCstSimpleByMtime(path: string, mtime: Date): any {
    const sql = `
select  cstSimple
from    CstSimple
where   path = @path
        and mtime = datetime(@mtime)`;
    return pluck(configReader.dbCache(), sql, { path, mtime: mtime.toISOString() });
  }

  insertCstSimple(path: string, mtime: Date, cstSimple: any): betterSqlite3.RunResult {
    const sql = `
insert into CstSimple
  (path, mtime, cstSimple)
values
  (@path, datetime(@mtime), @cstSimple)`;
    return run(configReader.dbCache(), sql, { path, mtime: mtime.toISOString(), cstSimple: JSON.stringify(cstSimple) });
  }

  truncateTables() {
    const sql = `
delete
from    Tables;

delete
from    ObjectAndTables;
`;
    return exec(configReader.dbCache(), sql);
  }

  truncateCstSimple() {
    const sql = `
delete
from    CstSimple`;
    return run(configReader.dbCache(), sql);
  }
}
export default new TCache();
