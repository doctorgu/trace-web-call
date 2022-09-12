import { configReader } from '../config/config';
import betterSqlite3 from 'better-sqlite3';
import { ObjectAndTables, ObjectType } from '../common/sqlHelper';
import { escapeDollar } from '../common/util';
import { SqlTemplate } from '../common/sqliteHelper';
import { all, exec, get, run } from '../common/sqliteHelper';
import { RouteInfo, RouteType } from '../common/traceHelper';

class TCommon {
  initDb(sql: string): betterSqlite3.Database {
    return exec(sql);
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

    return run(sql);
  }
}
export default new TCommon();
