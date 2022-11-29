import { XmlInfo, XmlNodeInfo, XmlNodeInfoFind } from '../common/sqlMapperHelper';
import { all, DbRow, exec, get, run } from '../common/sqliteHelper';
import { escapeDollar } from '../common/util';
import { SqlTemplate } from '../common/sqliteHelper';
import { configReader } from '../config/configReader';
import betterSqlite3 from 'better-sqlite3';

class TXmlInfo {
  selectXmlInfo(xmlPath: string): DbRow {
    const sql = `
select  xmlPath, namespace
from    XmlInfo
where   xmlPath = @xmlPath
`;
    return get(configReader.db(), sql, { xmlPath });
  }

  selectXmlNodeInfo(xmlPath: string): DbRow[] {
    const sql = `
select  id, tagName, params,
        objects, tablesInsert, tablesUpdate, tablesDelete, tablesOther, selectExists
from    XmlNodeInfo
where   xmlPath = @xmlPath
`;
    return all(configReader.db(), sql, { xmlPath });
  }

  selectXmlNodeInfoFindByNamespaceId(keyName: string, xmlPathsLike: string[], id: string): any {
    const sql = `
select  xmlPath,
        objects, tablesInsert, tablesUpdate, tablesDelete, tablesOther, selectExists
from    XmlNodeInfoFind
where   keyName = @keyName
        and id = @id
        and
        (${xmlPathsLike.map((xmlPathLike) => `xmlPath like '${xmlPathLike}' || '%'`).join(' or ')})
union all
select  xmlPath,
        objects, tablesInsert, tablesUpdate, tablesDelete, tablesOther, selectExists
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
    const nodesJson = nodes.map(
      ({ id, tagName, params, objects, tablesInsert, tablesUpdate, tablesDelete, tablesOther, selectExists }) => ({
        xmlPath,
        id,
        tagName,
        params: JSON.stringify([...params]),
        objects: JSON.stringify([...objects]),
        tablesInsert: JSON.stringify([...tablesInsert]),
        tablesUpdate: JSON.stringify([...tablesUpdate]),
        tablesDelete: JSON.stringify([...tablesDelete]),
        tablesOther: JSON.stringify([...tablesOther]),
        selectExists: selectExists ? 1 : 0,
      })
    );

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
  (
    xmlPath, id, tagName, params,
    objects, tablesInsert, tablesUpdate, tablesDelete, tablesOther, selectExists
  )
values      
  {values}
`;
      const sqlTmpValues = `({xmlPath}, {id}, {tagName}, {params}, {objects}, {tablesInsert}, {tablesUpdate}, {tablesDelete}, {tablesOther}, {selectExists})`;
      const sqlValues = new SqlTemplate(sqlTmpValues).replaceAlls(nodesJson, ',\n');
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
      .map(
        ({
          xmlPath,
          namespaceId,
          id,
          tagName,
          params,
          objects,
          tablesInsert,
          tablesUpdate,
          tablesDelete,
          tablesOther,
          selectExists,
        }) => ({
          keyName,
          xmlPath,
          namespaceId,
          id,
          tagName,
          params: JSON.stringify([...params]),
          objects: JSON.stringify([...objects]),
          tablesInsert: JSON.stringify([...tablesInsert]),
          tablesUpdate: JSON.stringify([...tablesUpdate]),
          tablesDelete: JSON.stringify([...tablesDelete]),
          tablesOther: JSON.stringify([...tablesOther]),
          selectExists: selectExists ? 1 : 0,
        })
      )
      .flat();

    const sqlTmp = `
insert into XmlNodeInfoFind
  (
    keyName, xmlPath, namespaceId, id, tagName, params,
    objects, tablesInsert, tablesUpdate, tablesDelete, tablesOther, selectExists
  )
values
  {values}`;
    const sqlTmpValues = `
  (
    {keyName}, {xmlPath}, {namespaceId}, {id}, {tagName}, {params},
    {objects}, {tablesInsert}, {tablesUpdate}, {tablesDelete}, {tablesOther}, {selectExists}
  )`;
    const sqlValues = new SqlTemplate(sqlTmpValues).replaceAlls(findsJson, ',\n');
    const sql = sqlTmp.replace('{values}', escapeDollar(sqlValues));

    return run(configReader.db(), sql);
  }
}
export default new TXmlInfo();
