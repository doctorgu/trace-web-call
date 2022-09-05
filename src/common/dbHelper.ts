import betterSqlite3 from 'better-sqlite3';
import mybatisMapper from 'mybatis-mapper';
import { config } from '../config/config';

/*
format argument of getStatement not used because of error of following sql.
insert into XmlNodeInfo (params)
values ('[[\\"parameterType\\",\\"map\\"],[\\"useGeneratedKeys\\",\\"false\\"]]')
*/

function getPrepare(db: betterSqlite3.Database, namespace: string, sql: string, params = {}) {
  mybatisMapper.createMapper([`./mybatis/${namespace}.xml`]);
  const query = mybatisMapper.getStatement(namespace, sql, params);
  return query;
}

export function all(db: betterSqlite3.Database, namespace: string, sql: string, params = {}): any[] {
  const query = getPrepare(db, namespace, sql, params);
  return db.prepare(query).all();
}

export function get(db: betterSqlite3.Database, namespace: string, sql: string, params = {}): any {
  const query = getPrepare(db, namespace, sql, params);
  return db.prepare(query).get();
}

export function run(db: betterSqlite3.Database, namespace: string, sql: string, params = {}): betterSqlite3.RunResult {
  const query = getPrepare(db, namespace, sql, params);
  return db.prepare(query).run();
}

export function exec(db: betterSqlite3.Database, namespace: string, sql: string, params = {}): betterSqlite3.Database {
  const query = getPrepare(db, namespace, sql, params);
  return db.exec(query);
}

export function execSql(db: betterSqlite3.Database, sql: string): betterSqlite3.Database {
  try {
    return db.exec(sql);
  } catch (ex) {
    throw new Error(ex);
  }
}
