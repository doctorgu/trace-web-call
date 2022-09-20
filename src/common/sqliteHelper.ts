import betterSqlite3, { SqliteError } from 'better-sqlite3';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { config } from '../config/config';
import { configReader } from '../config/configReader';
import { escapeDollar, escapeRegexp } from './util';

function writeAndError(ex: any, sql: string, params: { [key: string]: any } = {}): any {
  const msg = `${sql}\n${JSON.stringify(params)}\n${ex?.code} ${ex?.message}\n${ex?.stack}`;
  writeFileSync(resolve(config.path.logDirectory, 'exception.log'), msg);
  throw new Error(msg);
}

export function get(
  db: betterSqlite3.Database,
  sql: string,
  params: { [key: string]: any } = {}
): { [key: string]: any } {
  try {
    return db.prepare(sql).get(params);
  } catch (ex) {
    return writeAndError(ex, sql, params);
  }
}

export function pluck(db: betterSqlite3.Database, sql: string, params: { [key: string]: any } = {}): any[] {
  try {
    return db.prepare(sql).pluck().get(params);
  } catch (ex) {
    return writeAndError(ex, sql, params);
  }
}

export function all(
  db: betterSqlite3.Database,
  sql: string,
  params: { [key: string]: any } = {}
): { [key: string]: any }[] {
  try {
    return db.prepare(sql).all(params);
  } catch (ex) {
    return writeAndError(ex, sql, params);
  }
}

export function raw(db: betterSqlite3.Database, sql: string, params: { [key: string]: any } = {}): [][] {
  try {
    return db.prepare(sql).raw().all(params);
  } catch (ex) {
    return writeAndError(ex, sql, params);
  }
}

export function run(
  db: betterSqlite3.Database,
  sql: string,
  params: { [key: string]: any } = {}
): betterSqlite3.RunResult {
  try {
    return db.prepare(sql).run(params);
  } catch (ex) {
    return writeAndError(ex, sql, params);
  }
}

export function exec(db: betterSqlite3.Database, sql: string): betterSqlite3.Database {
  try {
    return db.exec(sql);
  } catch (ex) {
    return writeAndError(ex, sql);
  }
}

export class SqlTemplate {
  private _template: string = '';

  constructor(template: string) {
    this._template = template;
  }

  private convertToSqliteParam(value: any): string {
    if (typeof value === 'string') {
      return `'${value.replace(/'/g, "''")}'`;
    } else if (typeof value === 'number' || typeof value === 'bigint') {
      return `${value}`;
    } else if (typeof value === 'boolean') {
      return value ? '1' : '0';
    } else {
      throw new Error(`Wrong typeof value: ${typeof value}`);
    }
  }

  replace(varName: string, value: any): SqlTemplate {
    const tmpReplaced = this._template.replace(
      new RegExp(escapeRegexp(varName), 'g'),
      escapeDollar(this.convertToSqliteParam(value))
    );
    return new SqlTemplate(tmpReplaced);
  }

  replaceAll(params: any, parentName = ''): string {
    return Object.entries(params).reduce((template, [name, value]) => {
      if (typeof value === 'object') {
        return new SqlTemplate(template).replaceAll(value, `${parentName ? `${parentName}.` : ''}${name}`);
      }

      const varName = `${parentName ? `${parentName}.` : ''}${name}`;
      return new SqlTemplate(template).replace(`{${varName}}`, value as string).toString();
    }, this._template);
  }

  replaceAlls(params: any[], separator: string): string {
    return params.map((param) => new SqlTemplate(this._template).replaceAll(param)).join(separator);
  }

  toString() {
    return this._template;
  }
}
