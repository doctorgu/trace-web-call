import { XmlInfo, XmlNodeInfo, XmlNodeInfoFind } from '../common/sqlHelper';
import { all, exec, get, run } from '../common/sqliteHelper';
import { escapeDollar } from '../common/util';
import { SqlTemplate } from '../common/sqliteHelper';
import { configReader } from '../config/configReader';
import betterSqlite3 from 'better-sqlite3';

class TXmlInfo {
  selectXmlInfo(xmlPath: string): any {
    const sql = `
select  xmlPath, namespace
from    XmlInfo
where   xmlPath = @xmlPath
`;
    return get(configReader.db(), sql, { xmlPath });
  }

  selectXmlNodeInfo(xmlPath: string): any[] {
    const sql = `
select  id, tagName, params, tables, objectAndTables
from    XmlNodeInfo
where   xmlPath = @xmlPath
`;
    return all(configReader.db(), sql, { xmlPath });
  }

  selectXmlNodeInfoFindByNamespaceId(keyName: string, xmlPathsLike: string[], id: string): any {
    const sql = `
select  xmlPath, id, tagName, params, tables, objectAndTables
from    XmlNodeInfoFind
where   keyName = @keyName
        and id = @id
        and
        (${xmlPathsLike.map((xmlPathLike) => `xmlPath like '${xmlPathLike}' || '%'`).join(' or ')})
union all
select  xmlPath, id, tagName, params, tables, objectAndTables
from    XmlNodeInfoFind
where   keyName = @keyName
        and namespaceId = @id
        and
        (${xmlPathsLike.map((xmlPathLike) => `xmlPath like '${xmlPathLike}' || '%'`).join(' or ')})
limit 1
`;
    return get(configReader.db(), sql, { keyName, id });
  }

  insertXmlInfoXmlNodeInfo(xmlPath: string, namespace: string, nodes: XmlNodeInfo[]): betterSqlite3.Database {
    const nodesJson = nodes.map((node) => ({
      xmlPath,
      id: node.id,
      tagName: node.tagName,
      params: JSON.stringify([...node.params]),
      tables: JSON.stringify([...node.tables]),
      objectAndTables: JSON.stringify([...node.objectAndTables].map(([object, tables]) => [object, [...tables]])),
    }));

    const sqlTmpXml = `
insert into XmlInfo
  (xmlPath, namespace)
values
  ({xmlPath}, {namespace});
  `;
    const sqlXml = new SqlTemplate(sqlTmpXml).replaceAll({ xmlPath, namespace });

    let sqlXmlNode = '';
    if (nodesJson.length) {
      const sqlTmpXmlNode = `
insert into XmlNodeInfo
  (xmlPath, id, tagName, params, tables, objectAndTables)
values      
  {values}
`;
      const sqlTmpValues = `({xmlPath}, {id}, {tagName}, {params}, {tables}, {objectAndTables})`;
      const sqlValues = new SqlTemplate(sqlTmpValues).replaceAlls(
        nodesJson.map((node) => node),
        ','
      );
      sqlXmlNode = sqlTmpXmlNode.replace('{values}', escapeDollar(sqlValues));
    }

    const sql = `
${sqlXml};
${sqlXmlNode};
  `;
    return exec(configReader.db(), sql);
  }

  insertXmlInfoFindKeyName(keyName: string, finds: XmlNodeInfoFind[]): betterSqlite3.RunResult {
    if (!finds.length) return { changes: 0, lastInsertRowid: 0 };

    const findsJson = finds
      .map(({ xmlPath, namespaceId, id, tagName, params, tables, objectAndTables }) => {
        return {
          keyName,
          xmlPath,
          namespaceId,
          id,
          tagName,
          params: JSON.stringify([...params]),
          tables: JSON.stringify([...tables]),
          objectAndTables: JSON.stringify([...objectAndTables].map(([object, tables]) => [object, [...tables]])),
        };
      })
      .flat();

    const sqlTmp = `
insert into XmlNodeInfoFind
  (keyName, xmlPath, namespaceId, id, tagName, params, tables, objectAndTables)
values
  {values}`;
    const sqlTmpValues = `({keyName}, {xmlPath}, {namespaceId}, {id}, {tagName}, {params}, {tables}, {objectAndTables})`;
    const sqlValues = new SqlTemplate(sqlTmpValues).replaceAlls(findsJson, ',\n');
    const sql = sqlTmp.replace('{values}', escapeDollar(sqlValues));

    return run(configReader.db(), sql);
  }
}
export default new TXmlInfo();
