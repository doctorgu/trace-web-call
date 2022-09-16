import { all, exec, get, pluck, run } from '../common/sqliteHelper';
import { escapeDollar } from '../common/util';
import { SqlTemplate } from '../common/sqliteHelper';
import { configReader } from '../config/configReader';
import { HeaderInfo, MethodInfo, MethodInfoFind } from '../common/classHelper';
import betterSqlite3 from 'better-sqlite3';

class TCache {
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
}
export default new TCache();
