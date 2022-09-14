import betterSqlite3 from 'better-sqlite3';
import { parse, basename } from 'path';
import { configReader } from '../config/configReader';
import { ObjectAndTables, ObjectType } from '../common/sqlHelper';
import { escapeDollar } from '../common/util';
import { SqlTemplate } from '../common/sqliteHelper';
import { all, exec, get, run } from '../common/sqliteHelper';
import { RouteInfo, RouteType } from '../common/traceHelper';

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

  insertRouteInfoKeyName(keyName: string, routes: RouteInfo<RouteType>[]): betterSqlite3.RunResult {
    const routesJson = routes.map(
      ({
        groupSeq,
        seq,
        depth,
        routeType,
        valueMapping,
        valueMethod,
        valueXml,
        valueTable,
        valueView,
        valueFunction,
        valueProcedure,
      }: RouteInfo<RouteType>) => {
        const valueView2 = valueView as { object: string; tables: Set<string> };
        const valueFunction2 = valueFunction as { object: string; tables: Set<string> };
        const valueProcedure2 = valueProcedure as { object: string; tables: Set<string> };

        return {
          keyName,
          groupSeq,
          seq,
          depth,
          routeType,
          valueMapping: routeType === 'mapping' ? JSON.stringify(valueMapping) : '[]',
          valueMethod: routeType === 'method' ? valueMethod : '',
          valueXml: routeType === 'xml' ? valueXml : '',
          valueTable: routeType === 'table' ? JSON.stringify([...(valueTable as Set<string>)]) : JSON.stringify([]),
          valueView:
            routeType === 'view'
              ? JSON.stringify({ object: valueView2.object, tables: [...valueView2.tables] })
              : JSON.stringify({}),
          valueFunction:
            routeType === 'function'
              ? JSON.stringify({ object: valueFunction2.object, tables: [...valueFunction2.tables] })
              : JSON.stringify({}),
          valueProcedure:
            routeType === 'procedure'
              ? JSON.stringify({ object: valueProcedure2.object, tables: [...valueProcedure2.tables] })
              : JSON.stringify({}),
        };
      }
    );

    const sqlTmp = `
insert into RouteInfo
  (keyName, groupSeq, seq, depth, routeType, valueMapping, valueMethod, valueXml, valueTable, valueView, valueFunction, valueProcedure)
values
  {values}`;
    const sqlTmpValues = `({keyName}, {groupSeq}, {seq}, {depth}, {routeType}, {valueMapping}, {valueMethod}, {valueXml}, {valueTable}, {valueView}, {valueFunction}, {valueProcedure})`;
    const sqlValues = new SqlTemplate(sqlTmpValues).replaceAlls(routesJson, ',\n');
    const sql = sqlTmp.replace('{values}', escapeDollar(sqlValues));

    return run(configReader.db(), sql);
  }

  selectCompare(pathDest: string) {
    const nameDest = parse(basename(pathDest)).name;

    const sqlDiff = `
select  s1.tables, s2.tables2
from    vStartToTables s1
        inner join
        (
            select  keyName keyName2, groupSeq groupSeq2, start start2, tables tables2
            from    ${nameDest}.vStartToTables
        ) s2        
        on s1.keyName = s2.keyName2
        and s1.groupSeq = s2.groupSeq2
        and s1.start = s2.start2
where   s1.tables != s2.tables2
  `;
    const sqlInserted = `
select  s1.keyName, s1.groupSeq, s1.start, s1.tables
from    vStartToTables s1
        left join
        (
            select  keyName keyName2, groupSeq groupSeq2, start start2, tables tables2
            from    ${nameDest}.vStartToTables
        ) s2        
        on s1.keyName = s2.keyName2
        and s1.groupSeq = s2.groupSeq2
        and s1.start = s2.start2
where   s2.start2 is null
  `;
    const sqlDeleted = `
select  s2.keyName2 keyName, s2.groupSeq2 groupSeq, s2.start2 start, s2.tables2 tables
from    vStartToTables s1
        right join
        (
            select  keyName keyName2, groupSeq groupSeq2, start start2, tables tables2
            from    ${nameDest}.vStartToTables
        ) s2        
        on s1.keyName = s2.keyName2
        and s1.groupSeq = s2.groupSeq2
        and s1.start = s2.start2
where   s1.start is null;
  `;
    const db = configReader.db();
    const sqlAttach = `
attach database '${pathDest}' as ${nameDest}`;
    exec(db, sqlAttach);

    const diff = all(db, sqlDiff);
    const inserted = all(db, sqlInserted);
    const deleted = all(db, sqlDeleted);
    return { diff, inserted, deleted };
  }
}
export default new TCommon();
