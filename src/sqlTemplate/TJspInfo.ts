import { configReader } from '../config/configReader';
import betterSqlite3 from 'better-sqlite3';
import { all, pluck, exec, SqlTemplate, DbRow } from '../common/sqliteHelper';
import { JspInfo } from '../common/jspHelper';
import { escapeDollar } from '../common/util';

class TJspInfo {
  selectJspInfo(keyName: string): DbRow[] {
    const sql = `
select  jspPath, includes
from    JspInfo
where   keyName = @keyName
  `;
    return all(configReader.db(), sql, { keyName });
  }

  insertJspInfo(keyName: string, jspInfos: JspInfo[]): betterSqlite3.Database {
    const jspInfosJson = jspInfos.map(({ jspPath, includes }) => ({
      keyName,
      jspPath,
      includes: JSON.stringify(includes),
    }));
    const sqlTmp = `
insert into JspInfo
  (keyName, jspPath, includes)
values
  {values};`;
    const sqlTmpValues = `({keyName}, {jspPath}, {includes})`;
    const sqlValues = new SqlTemplate(sqlTmpValues).replaceAlls(jspInfosJson, ',\n');
    const sql = sqlTmp.replace('{values}', escapeDollar(sqlValues));
    return exec(configReader.db(), sql);
  }
}
export default new TJspInfo();
