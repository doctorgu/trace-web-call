import { all, exec, get, pluck, run } from '../common/sqliteHelper';
import { escapeDollar } from '../common/util';
import { SqlTemplate } from '../common/sqliteHelper';
import { configReader } from '../config/configReader';
import { HeaderInfo, MethodInfo, MethodInfoFind } from '../common/classHelper';
import betterSqlite3 from 'better-sqlite3';

class TCache {
  selectCstSimpleBySha1(sha1: string): any {
    const sql = `
select  cstSimple
from    CstSimple
where   sha1 = @sha1`;
    return pluck(configReader.dbCache(), sql, { sha1 });
  }

  insertCstSimple(sha1: string, path: string, cstSimple: any): betterSqlite3.RunResult {
    const sql = `
insert into CstSimple
  (sha1, path, cstSimple)
values
  (@sha1, @path, @cstSimple)`;
    return run(configReader.dbCache(), sql, { sha1, path, cstSimple: JSON.stringify(cstSimple) });
  }
}
export default new TCache();
