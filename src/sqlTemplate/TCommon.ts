import betterSqlite3 from 'better-sqlite3';
import { parse, basename } from 'path';
import { configReader } from '../config/configReader';
import { escapeDollar } from '../common/util';
import { DbRow, SqlTemplate } from '../common/sqliteHelper';
import { all, exec, run } from '../common/sqliteHelper';
import { RouteJsp, RouteTable, RouteTypeJsp, RouteTypeTable } from '../common/traceHelper';

class TCommon {
  initDb(sql: string): betterSqlite3.Database {
    return exec(configReader.db(), sql);
  }

  insertKeyInfo(keyNames: { keyName: string }[]): betterSqlite3.Database {
    const sqlTmp = `
delete from KeyInfo;

insert into KeyInfo
  (keyName)
values
  {values}`;
    const sqlTmpValues = `({keyName})`;
    const sqlValues = new SqlTemplate(sqlTmpValues).replaceAlls(keyNames, ',\n');
    const sql = sqlTmp.replace('{values}', escapeDollar(sqlValues));

    return exec(configReader.db(), sql);
  }

  insertRouteTableKeyName(keyName: string, routes: RouteTable<RouteTypeTable>[]): betterSqlite3.RunResult {
    const routesJson = routes.map(
      ({
        groupSeq,
        seq,
        depth,
        routeType,
        valueMapping,
        valueMethod,
        valueXml,
        valueView,
        valueFunction,
        valueProcedure,
        objects,
        tablesInsert,
        tablesUpdate,
        tablesDelete,
        tablesOther,
        selectExists,
      }: RouteTable<RouteTypeTable>) => {
        return {
          keyName,
          groupSeq,
          seq,
          depth,
          routeType,
          valueMapping: routeType === 'mapping' ? JSON.stringify(valueMapping) : '[]',
          valueMethod: routeType === 'method' ? valueMethod : '',
          valueXml: routeType === 'xml' ? valueXml : '',
          valueView: routeType === 'view' ? valueView : '',
          valueFunction: routeType === 'function' ? valueFunction : '',
          valueProcedure: routeType === 'procedure' ? valueProcedure : '',
          objects:
            routeType === 'xml' || routeType === 'view' || routeType === 'function' || routeType === 'procedure'
              ? JSON.stringify([...(objects as Set<string>)])
              : JSON.stringify([]),
          tablesInsert:
            routeType === 'xml' || routeType === 'view' || routeType === 'function' || routeType === 'procedure'
              ? JSON.stringify([...(tablesInsert as Set<string>)])
              : JSON.stringify([]),
          tablesUpdate:
            routeType === 'xml' || routeType === 'view' || routeType === 'function' || routeType === 'procedure'
              ? JSON.stringify([...(tablesUpdate as Set<string>)])
              : JSON.stringify([]),
          tablesDelete:
            routeType === 'xml' || routeType === 'view' || routeType === 'function' || routeType === 'procedure'
              ? JSON.stringify([...(tablesDelete as Set<string>)])
              : JSON.stringify([]),
          tablesOther:
            routeType === 'xml' || routeType === 'view' || routeType === 'function' || routeType === 'procedure'
              ? JSON.stringify([...(tablesOther as Set<string>)])
              : JSON.stringify([]),
          selectExists: selectExists ? 1 : 0,
        };
      }
    );

    const sqlTmp = `
insert into RouteTable
  (
    keyName, groupSeq, seq, depth, routeType,
    valueMapping, valueMethod, valueXml, valueView, valueFunction, valueProcedure,
    objects, tablesInsert, tablesUpdate, tablesDelete, tablesOther, selectExists
  )
values
  {values}`;
    const sqlTmpValues = `
  (
    {keyName}, {groupSeq}, {seq}, {depth}, {routeType},
    {valueMapping}, {valueMethod}, {valueXml}, {valueView}, {valueFunction}, {valueProcedure},
    {objects}, {tablesInsert}, {tablesUpdate}, {tablesDelete}, {tablesOther}, {selectExists}
  )`;
    const sqlValues = new SqlTemplate(sqlTmpValues).replaceAlls(routesJson, ',\n');
    const sql = sqlTmp.replace('{values}', escapeDollar(sqlValues));

    return run(configReader.db(), sql);
  }

  insertRouteJspKeyName(keyName: string, routes: RouteJsp<RouteTypeJsp>[]): betterSqlite3.RunResult {
    const routesJson = routes.map(
      ({ groupSeq, seq, depth, routeType, valueMapping, valueMethod, valueJsp }: RouteJsp<RouteTypeJsp>) => {
        return {
          keyName,
          groupSeq,
          seq,
          depth,
          routeType,
          valueMapping: routeType === 'mapping' ? JSON.stringify(valueMapping) : '[]',
          valueMethod: routeType === 'method' ? valueMethod : '',
          valueJsp: routeType === 'jsp' ? JSON.stringify([...(valueJsp as Set<string>)]) : JSON.stringify([]),
        };
      }
    );

    const sqlTmp = `
insert into RouteJsp
  (keyName, groupSeq, seq, depth, routeType, valueMapping, valueMethod, valueJsp)
values
  {values}`;
    const sqlTmpValues = `({keyName}, {groupSeq}, {seq}, {depth}, {routeType}, {valueMapping}, {valueMethod}, {valueJsp})`;
    const sqlValues = new SqlTemplate(sqlTmpValues).replaceAlls(routesJson, ',\n');
    const sql = sqlTmp.replace('{values}', escapeDollar(sqlValues));

    return run(configReader.db(), sql);
  }

  selectCompare(pathDest: string) {
    const dbNameDest = parse(basename(pathDest)).name;

    const names = [
      { name: 'table', view: 'vStartToTables', column: 'tables' },
      { name: 'jsp', view: 'vStartToJsps', column: 'jsps' },
    ];
    const sqlDiffMap = new Map<string, string>();
    const sqlInsertedMap = new Map<string, string>();
    const sqlDeletedMap = new Map<string, string>();

    for (const { name, view, column } of names) {
      const sqlDiff = `
select  s1.keyName, s1.groupSeq, s1.start, s1.${column}, s2.${column}2
from    ${view} s1
        inner join
        (
            select  keyName keyName2, groupSeq groupSeq2, start start2, ${column} ${column}2
            from    ${dbNameDest}.${view}
        ) s2        
        on s1.keyName = s2.keyName2
        and s1.groupSeq = s2.groupSeq2
        and s1.start = s2.start2
where   s1.${column} != s2.${column}2
  `;
      sqlDiffMap.set(name, sqlDiff);

      const sqlInserted = `
select  s1.keyName, s1.groupSeq, s1.start, s1.${column}
from    ${view} s1
        left join
        (
            select  keyName keyName2, groupSeq groupSeq2, start start2, ${column} ${column}2
            from    ${dbNameDest}.${view}
        ) s2        
        on s1.keyName = s2.keyName2
        and s1.groupSeq = s2.groupSeq2
        and s1.start = s2.start2
where   s2.start2 is null
  `;
      sqlInsertedMap.set(name, sqlInserted);

      const sqlDeleted = `
select  s2.keyName2 keyName, s2.groupSeq2 groupSeq, s2.start2 start, s2.${column}2 ${column}
from    ${view} s1
        right join
        (
            select  keyName keyName2, groupSeq groupSeq2, start start2, ${column} ${column}2
            from    ${dbNameDest}.${view}
        ) s2        
        on s1.keyName = s2.keyName2
        and s1.groupSeq = s2.groupSeq2
        and s1.start = s2.start2
where   s1.start is null;
  `;
      sqlDeletedMap.set(name, sqlDeleted);
    }

    const db = configReader.db();
    const sqlAttach = `
attach database '${pathDest}' as ${dbNameDest}`;
    exec(db, sqlAttach);

    const rowsDiffMap = new Map<string, DbRow[]>();
    const rowsInsertedMap = new Map<string, DbRow[]>();
    const rowsDeletedMap = new Map<string, DbRow[]>();

    for (const [name, sqlDiff] of sqlDiffMap) {
      rowsDiffMap.set(name, all(db, sqlDiff));
    }
    for (const [name, sqlInserted] of sqlInsertedMap) {
      rowsInsertedMap.set(name, all(db, sqlInserted));
    }
    for (const [name, sqlDeleted] of sqlDeletedMap) {
      rowsDeletedMap.set(name, all(db, sqlDeleted));
    }

    return {
      diffTable: rowsDiffMap.get('table') as DbRow[],
      insertedTable: rowsInsertedMap.get('table') as DbRow[],
      deletedTable: rowsDeletedMap.get('table') as DbRow[],
      diffJsp: rowsDiffMap.get('jsp') as DbRow[],
      insertedJsp: rowsInsertedMap.get('jsp') as DbRow[],
      deletedJsp: rowsDeletedMap.get('jsp') as DbRow[],

      diffTableSql: sqlDiffMap.get('table'),
      insertedTableSql: sqlInsertedMap.get('table'),
      deletedTableSql: sqlDeletedMap.get('table'),
      diffJspSql: sqlDiffMap.get('jsp'),
      insertedJspSql: sqlInsertedMap.get('jsp'),
      deletedJspSql: sqlDeletedMap.get('jsp'),
    };
  }
}
export default new TCommon();
