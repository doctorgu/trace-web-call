import betterSqlite3 from 'better-sqlite3';
import mybatisMapper from 'mybatis-mapper';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { config } from '../config/config';

/*
format argument of getStatement not used because of error of following sql.
insert into XmlNodeInfo (params)
values ('[[\\"parameterType\\",\\"map\\"],[\\"useGeneratedKeys\\",\\"false\\"]]')
*/

function getPrepare(db: betterSqlite3.Database, namespace: string, id: string, params = {}) {
  mybatisMapper.createMapper([`./mybatis/${namespace}.xml`]);
  const sql = mybatisMapper.getStatement(namespace, id, params);

  return sql;
}

export function all(db: betterSqlite3.Database, namespace: string, id: string, params = {}): any[] {
  const sql = getPrepare(db, namespace, id, params);

  try {
    return db.prepare(sql).all();
  } catch (ex) {
    const msg = `${sql} ${ex?.code} ${ex?.message}\n${ex?.stack}`;
    writeFileSync(resolve(config.path.logDirectory, 'exception.log'), msg);
    throw new Error(msg);
  }
}

export function get(db: betterSqlite3.Database, namespace: string, id: string, params = {}): any {
  const sql = getPrepare(db, namespace, id, params);

  try {
    return db.prepare(sql).get();
  } catch (ex) {
    const msg = `${sql} ${ex?.code} ${ex?.message}\n${ex?.stack}`;
    writeFileSync(resolve(config.path.logDirectory, 'exception.log'), msg);
    throw new Error(msg);
  }
}

export function run(db: betterSqlite3.Database, namespace: string, id: string, params = {}): betterSqlite3.RunResult {
  const sql = getPrepare(db, namespace, id, params);

  try {
    return db.prepare(sql).run();
  } catch (ex) {
    const msg = `${sql} ${ex?.code} ${ex?.message}\n${ex?.stack}`;
    writeFileSync(resolve(config.path.logDirectory, 'exception.log'), msg);
    throw new Error(msg);
  }
}

export function exec(db: betterSqlite3.Database, namespace: string, id: string, params = {}): betterSqlite3.Database {
  const sql = getPrepare(db, namespace, id, params);

  try {
    return db.transaction(() => db.exec(sql))();
  } catch (ex) {
    const msg = `${sql} ${ex?.code} ${ex?.message}\n${ex?.stack}`;
    writeFileSync(resolve(config.path.logDirectory, 'exception.log'), msg);
    throw new Error(msg);
  }
}

export function execSql(db: betterSqlite3.Database, sql: string): betterSqlite3.Database {
  try {
    return db.transaction(() => db.exec(sql))();
  } catch (ex) {
    const msg = `${sql} ${ex?.code} ${ex?.message}\n${ex?.stack}`;
    writeFileSync(resolve(config.path.logDirectory, 'exception.log'), msg);
    throw new Error(msg);
  }
}
