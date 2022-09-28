import { all, DbRow, exec, get, pluck, run } from '../common/sqliteHelper';
import { escapeDollar } from '../common/util';
import { SqlTemplate } from '../common/sqliteHelper';
import { configReader } from '../config/configReader';
import { HeaderInfo, MethodInfo, MethodInfoFind } from '../common/classHelper';
import betterSqlite3 from 'better-sqlite3';
import { ObjectInfo, ObjectType } from '../common/batisHelper';

class TCache {
  selectTables(path: string): DbRow[] {
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

  selectObjects(path: string, type: ObjectType): DbRow[] {
    const sql = `
select  type, name,
        objects,
        tablesInsert, tablesUpdate, tablesDelete, tablesOther,
        selectExists
from    Objects
where   path = @path
        and type = @type
order by object
`;
    return all(configReader.dbCache(), sql, { path, type });
  }

  selectObjectsNameType(typeAndPath: Map<ObjectType, string>): DbRow[] {
    const sql = `
select  name, type
from    Objects
where   (path = @pathView or path = @pathFunction or path = @pathProcedure)
`;
    return all(configReader.dbCache(), sql, {
      pathView: typeAndPath.get('view'),
      pathFunction: typeAndPath.get('function'),
      pathProcedure: typeAndPath.get('procedure'),
    });
  }

  selectObjectsDeep(typeAndPath: Map<ObjectType, string>, names: Set<string>): DbRow[] {
    const sql = `
with recursive Objs as
(
    select  path, type, name,
            objects, tablesInsert, tablesUpdate, tablesDelete, tablesOther, selectExists, 0 depth
    from    Objects
    where   (path = @pathView or path = @pathFunction or path = @pathProcedure)
            and name in (
                select  value
                from    json_each(@names)
            )

    union all

    select  c.path, c.type, c.name,
            c.objects, c.tablesInsert, c.tablesUpdate, c.tablesDelete, c.tablesOther, c.selectExists, p.depth + 1 depth
    from    Objects c
            inner join Objs p
            on p.path = c.path
            and p.objects like '%"' || c.name || '"%'
)
select  type, name,
        objects, tablesInsert, tablesUpdate, tablesDelete, tablesOther, selectExists, depth
from    Objs
`;
    return all(configReader.dbCache(), sql, {
      pathView: typeAndPath.get('view'),
      pathFunction: typeAndPath.get('function'),
      pathProcedure: typeAndPath.get('procedure'),
      names: JSON.stringify([...names]),
    });
  }

  insertObjects(typeAndPath: Map<ObjectType, string>, objectInfos: ObjectInfo[]): betterSqlite3.Database {
    const sqlTmp = `
insert into Objects
  (
    path,
    type, name,
    objects,
    tablesInsert, tablesUpdate, tablesDelete, tablesOther,
    selectExists
  )
values
  {values}
`;
    const sqlTmpValues = `
  (
    {path},
    {type}, {name},
    {objects},
    {tablesInsert}, {tablesUpdate}, {tablesDelete}, {tablesOther},
    {selectExists}
  )
`;

    const params = objectInfos.map(
      ({ type, name, objects, tablesInsert, tablesUpdate, tablesDelete, tablesOther, selectExists }) => ({
        path: typeAndPath.get(type),
        type,
        name,
        objects: JSON.stringify([...objects]),
        tablesInsert: JSON.stringify([...tablesInsert]),
        tablesUpdate: JSON.stringify([...tablesUpdate]),
        tablesDelete: JSON.stringify([...tablesDelete]),
        tablesOther: JSON.stringify([...tablesOther]),
        selectExists: selectExists ? 1 : 0,
      })
    );
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
`;
    return exec(configReader.dbCache(), sql);
  }

  truncateObjects() {
    const sql = `
delete
from    Objects;
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
