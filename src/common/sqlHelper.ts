import { xml2js, Element } from 'xml-js';
import {
  trimStartList,
  removeCommentSql,
  removeCommentLiteralSql,
  trimList,
  readFileSyncUtf16le,
  SqlTemplate,
  escapeDollar,
} from './util';
import { config, configReader } from '../config/config';
import { readdirSync, existsSync, statSync } from 'fs';
import { resolve } from 'path';
import { all, get, run, exec, execSql } from './dbHelper';
import betterSqlite3 from 'better-sqlite3';
import { runSaveToDbFirst } from './message';
import { getDbPath } from './common';

export type XmlNodeInfo = {
  id: string;
  tagName: string;
  params: Map<string, string>;
  tables: Set<string>;
  objectAndTables: ObjectAndTables;
};
export type XmlInfo = {
  xmlPath: string;
  namespace: string;
  nodes: XmlNodeInfo[];
};
export type XmlNodeInfoFind = XmlNodeInfo & {
  namespace: string;
};

export type ObjectAndTables = Map<string, Set<string>>;
export type ObjectType = 'view' | 'function' | 'procedure';

export function getTablesFromDb(): Set<string> {
  const db = configReader.db();

  const rows = all(db, 'Tables', 'selectTables');
  const tables = new Set(rows.map(({ name }) => name));
  return tables;
}

export function insertTables(tables: Set<string>) {
  if (!tables.size) return;

  const db = configReader.db();
  exec(db, 'Tables', 'insertTables', { tables: [...tables] });
}

export function getObjectAndTablesFromDb(objectType: ObjectType): ObjectAndTables {
  const db = configReader.db();

  const rows = all(db, 'Tables', 'selectObjectAndTables', { objectType });
  const objectAndTables = new Map(rows.map(({ object, tables }) => [object, new Set<string>(JSON.parse(tables))]));
  return objectAndTables;
}

export function insertObjectAndTables(objectType: ObjectType, objectAndTables: ObjectAndTables) {
  if (!objectAndTables.size) return;

  const sqlTmp = `
  insert into objectAndTables
    (object, objectType, tables)
  values
    {values}
  `;
  const sqlTmpValues = `
  ({object}, {objectType}, {tables})
  `;

  const db = configReader.db();
  const params = [...objectAndTables].map(([object, tables]) => ({
    object,
    objectType,
    tables: JSON.stringify([...tables]),
  }));
  const sqlValues = new SqlTemplate(sqlTmpValues).replaceAlls(params, ',\n');
  const sql = sqlTmp.replace('{values}', escapeDollar(sqlValues));
  execSql(db, sql);
}

export function getObjectAndTablesByObjectType(objectType: ObjectType, tables: Set<string>): ObjectAndTables {
  const objectTypeAndObjectAndTables = new Map<ObjectType, ObjectAndTables>();
  const objectAndTables: ObjectAndTables = new Map<string, Set<string>>();

  let path = '';
  switch (objectType) {
    case 'view':
      path = config.path.data.views;
      break;
    case 'function':
      path = config.path.data.functions;
      break;
    case 'procedure':
      path = config.path.data.procedures;
      break;
    default:
      throw new Error(`Wrong objectType: ${objectType}`);
  }

  if (!existsSync(path)) {
    objectTypeAndObjectAndTables.set(objectType, objectAndTables);
  } else {
    if (statSync(path).isDirectory()) {
      const files = readdirSync(path);
      files.forEach((file) => {
        const value = readFileSyncUtf16le(resolve(path, file));
        const objectAndTablesCur = getObjectAndTables(value, tables, objectType);
        [...objectAndTablesCur].forEach(([object, tables]) => {
          objectAndTables.set(object, tables);
        });
      });

      objectTypeAndObjectAndTables.set(objectType, objectAndTables);
    } else {
      const value = readFileSyncUtf16le(path);
      const objectAndTables = getObjectAndTables(value, tables, objectType);

      objectTypeAndObjectAndTables.set(objectType, objectAndTables);
    }
  }

  return objectTypeAndObjectAndTables.get(objectType) as ObjectAndTables;
}

function getObjectAsUpper(sql: string): Map<string, string> {
  const objectAndSchemaDotObject = new Map<string, string>();

  let m: RegExpExecArray | null;
  const re = /(?<schemaDot>\w+\.)*(?<table>\w+)/g;
  while ((m = re.exec(sql)) !== null) {
    const schemaDot = m.groups?.schemaDot?.toUpperCase() || '';
    const table = m.groups?.table.toUpperCase() || '';

    objectAndSchemaDotObject.set(table, `${schemaDot}${table}`);
  }

  return objectAndSchemaDotObject;
}

/** Return tables, and objectAndTables also if objectAndTablesAll has value  */
function getObjects(
  objectAndSchemaDotObject: Map<string, string>,
  tablesAll: Set<string>,
  objectAndTablesAll: ObjectAndTables
): { tables: Set<string>; objectAndTables: ObjectAndTables } {
  const tables = new Set<string>();
  const objectAndTables: ObjectAndTables = new Map<string, Set<string>>();

  for (const [object, schemaDotObject] of objectAndSchemaDotObject) {
    const tableToAdd = (tablesAll.has(schemaDotObject) && schemaDotObject) || (tablesAll.has(object) && object);
    if (tableToAdd) {
      tables.add(tableToAdd);
    }

    const objectToAdd =
      (objectAndTablesAll.has(schemaDotObject) && schemaDotObject) || (objectAndTablesAll.has(object) && object);
    if (objectToAdd) {
      const tablesInObject = objectAndTablesAll.get(objectToAdd) || new Set<string>();
      objectAndTables.set(objectToAdd, tablesInObject);
    }
  }

  return { tables, objectAndTables };
}

export function getObjectAndTables(sql: string, tablesAll: Set<string>, objectType: ObjectType): ObjectAndTables {
  switch (objectType) {
    case 'view':
      return getViewAndTables(sql, tablesAll);
    case 'function':
      return getFunctionAndTables(sql, tablesAll);
    case 'procedure':
      return getProcedureAndTables(sql, tablesAll);
    default:
      throw new Error(`Wrong objectType: ${objectType}`);
  }
}

export function getViewAndTables(sql: string, tablesAll: Set<string>): ObjectAndTables {
  const sqlNoComment = removeCommentLiteralSql(sql);

  const objectAndTables: ObjectAndTables = new Map<string, Set<string>>();
  let m: RegExpExecArray | null;
  let re =
    /create(\s+or\s+replace)*((\s+no)*(\s+force))*\s+view\s+(?<schemaDot>"?[\w$#]+"?\.)*(?<view>"?[\w$#]+"?)\s+.+?as(?<sql>.+?);/gis;
  while ((m = re.exec(sqlNoComment)) !== null) {
    // const schemaDot = m.groups?.schemaDot || '';
    const view = trimList(m.groups?.view || '', '"');
    const sql = m.groups?.sql || '';

    const objectAndSchemaDotObject = getObjectAsUpper(sql);
    const { tables } = getObjects(objectAndSchemaDotObject, tablesAll, new Map<string, Set<string>>());
    objectAndTables.set(`${view}`, tables);
  }

  return objectAndTables;
}

export function getFunctionAndTables(sql: string, tablesAll: Set<string>): ObjectAndTables {
  const sqlNoComment = removeCommentLiteralSql(sql);

  const objectAndTables: ObjectAndTables = new Map<string, Set<string>>();
  let m: RegExpExecArray | null;
  let re =
    /create(\s+or\s+replace)*(\s+editionable|\s+noneditionable)*\s+function\s+(?<schemaDot>"?[\w$#]+"?\.)*(?<func>"?[\w$#]+"?)\s+.+?return(?<sql>.+?)end(\s+\k<func>)?\s*;/gis;
  while ((m = re.exec(sqlNoComment)) !== null) {
    // const schemaDot = m.groups?.schemaDot || '';
    const func = trimList(m.groups?.func || '', '"');
    const sql = m.groups?.sql || '';

    const objectAndSchemaDotObject = getObjectAsUpper(sql);
    const { tables } = getObjects(objectAndSchemaDotObject, tablesAll, new Map<string, Set<string>>());
    objectAndTables.set(`${func}`, tables);
  }

  return objectAndTables;
}

export function getProcedureAndTables(sql: string, tablesAll: Set<string>): ObjectAndTables {
  const sqlNoComment = removeCommentLiteralSql(sql);

  const objectAndTables: ObjectAndTables = new Map<string, Set<string>>();
  let m: RegExpExecArray | null;
  let re =
    /create(\s+or\s+replace)*\s+procedure\s+(?<schemaDot>"?[\w$#]+"?\.)*(?<procedure>"?[\w$#]+"?)\s+.+?(is|as)(?<sql>.+?)end(\s+\k<procedure>)?\s*;/gis;
  while ((m = re.exec(sqlNoComment)) !== null) {
    // const schemaDot = m.groups?.schemaDot || '';
    const procedure = trimList(m.groups?.procedure || '', '"');
    const sql = m.groups?.sql || '';

    const objectAndSchemaDotObject = getObjectAsUpper(sql);
    const { tables } = getObjects(objectAndSchemaDotObject, tablesAll, new Map<string, Set<string>>());
    objectAndTables.set(`${procedure}`, tables);
  }

  return objectAndTables;
}

function getTextCdataFromElement(elem: Element): string {
  const texts: string[] = [];
  for (const elemChild of elem.elements || []) {
    if (elemChild.type === 'text') {
      texts.push((elemChild.text as string) || '');
    } else if (elemChild.type === 'cdata') {
      texts.push((elemChild.cdata as string) || '');
    } else if (elemChild.type === 'element') {
      const textChild = getTextCdataFromElement(elemChild);
      texts.push(textChild);
    }
  }

  return texts.join('\n');
}

function getTextInclude(parent: Element, elemRows: Element[]): string {
  const children = parent.elements;
  if (!children) return '';

  const texts: string[] = [];
  const elemsInclude = children.filter((child) => child.name === 'include');
  for (const item of elemsInclude) {
    const refid = item.attributes?.refid;
    const elemSql = elemRows.find((row) => row.name === 'sql' && row.attributes?.id === refid);
    if (!elemSql) continue;

    const text = getTextCdataFromElement(elemSql);
    texts.push(text);
  }
  return texts.join('\n');
}

function getXmlInfoFromDb(xmlPath: string): XmlInfo | null {
  const db = configReader.db();

  const nodes: XmlNodeInfo[] = [];

  const rowXml = get(db, 'XmlInfo', 'selectXmlInfo', { xmlPath });
  if (!rowXml) {
    return null;
  }

  const rowsXmlNode = all(db, 'XmlInfo', 'selectXmlNodeInfo', { xmlPath });

  const { namespace } = rowXml;

  for (const row of rowsXmlNode) {
    const { id, tagName, params, tables, objectAndTables } = row;
    const params2 = new Map<string, string>(JSON.parse(params));
    const tables2 = new Set<string>(JSON.parse(tables));

    const objectAndTables2 = JSON.parse(objectAndTables) as [string, string[]][];
    const objectAndTables3 = new Map<string, Set<string>>(
      objectAndTables2.map(([object, tables]) => [object, new Set<string>(tables)])
    );

    nodes.push({ id, tagName, params: params2, tables: tables2, objectAndTables: objectAndTables3 });
  }

  return { xmlPath, namespace, nodes };
}
function insertXmlNodeInfo(
  xmlPath: string,
  namespace: string,
  nodes: {
    id: string;
    tagName: string;
    params: string;
    tables: string;
    objectAndTables: string;
  }[]
) {
  const sqlTmpXml = `
    insert into XmlInfo
      (xmlPath, namespace)
    values
      ({xmlPath}, {namespace});
  `;
  const sqlXml = new SqlTemplate(sqlTmpXml).replaceAll({ xmlPath, namespace });

  let sqlXmlNode = '';
  if (nodes.length) {
    const sqlTmpXmlNode = `
    insert into XmlNodeInfo
      (xmlPath, id, tagName, params, tables, objectAndTables)
    values      
      {values}
`;
    const sqlTmpValues = `({xmlPath}, {node.id}, {node.tagName}, {node.params}, {node.tables}, {node.objectAndTables})`;
    const sqlValues = new SqlTemplate(sqlTmpValues).replaceAlls(
      nodes.map((node) => ({ xmlPath, node })),
      ','
    );
    sqlXmlNode = sqlTmpXmlNode.replace('{values}', escapeDollar(sqlValues));
  }

  const sqlAll = `
  ${sqlXml};
  ${sqlXmlNode};`;
  execSql(configReader.db(), sqlAll);
}

export function getXmlInfo(
  rootDir: string,
  fullPath: string,
  tablesAll: Set<string>,
  objectAndTablesAll: ObjectAndTables
): XmlInfo | null {
  const xmlPath = getDbPath(rootDir, fullPath);

  const xmlDb = getXmlInfoFromDb(xmlPath);
  // if (!xmlDb) {
  //   throw new Error(runSaveToDbFirst);
  // }

  return xmlDb;
}

export function saveTablesToDb(): Set<string> {
  let tablesNew = new Set<string>();

  const path = config.path.data.tables;

  if (statSync(path).isDirectory()) {
    let values: string[] = [];

    const files = readdirSync(path);
    files.forEach((file) => {
      const value = readFileSyncUtf16le(resolve(path, file));
      values = values.concat(value.split(/\r*\n/));
    });

    tablesNew = new Set(values.filter((v) => !!v).map((v) => v.toUpperCase()));
  } else {
    const value = readFileSyncUtf16le(path);
    tablesNew = new Set(
      value
        .split(/\r*\n/)
        .filter((v) => !!v)
        .map((v) => v.toUpperCase())
    );
  }

  insertTables(tablesNew);
  return tablesNew;
}

export function saveObjectAndTables(tables: Set<string>): ObjectAndTables {
  const objectAndTablesAll = new Map<string, Set<string>>();

  const objectTypes: ObjectType[] = ['view', 'function', 'procedure'];
  for (const objectType of objectTypes) {
    const objectAndTables = getObjectAndTablesByObjectType(objectType, tables);
    [...objectAndTables].forEach(([object, tables]) => objectAndTablesAll.set(object, tables));
    insertObjectAndTables(objectType, objectAndTables);
  }

  return objectAndTablesAll;
}

export function saveXmlInfoToDb(
  rootDir: string,
  fullPath: string,
  tablesAll: Set<string>,
  objectAndTablesAll: ObjectAndTables
): XmlInfo | null {
  const xmlPath = getDbPath(rootDir, fullPath);

  const xml = readFileSyncUtf16le(fullPath);

  const nodes: XmlNodeInfo[] = [];

  const obj = xml2js(xml) as Element;
  if (!obj) return null;

  const elements = obj.elements;
  if (!elements) return null;

  // sqlMap: iBatis, mapper: myBatis
  const elemBody = elements.find((elem) => elem.name === 'sqlMap' || elem.name === 'mapper');
  if (!elemBody) return null;

  const attributes = elemBody.attributes;
  const namespace = (attributes?.namespace as string) || '';

  const elemRows = (elemBody.elements?.filter((elem) => elem.name !== 'sql') as Element[]) || [];

  for (const elemRow of elemRows) {
    const attrRow = elemRow.attributes;
    if (!attrRow) continue;

    const tagName = elemRow.name || '';

    let id = '';
    const params = new Map<string, string>();
    for (const [attrName, attrValue] of Object.entries(attrRow)) {
      if (attrName === 'id') {
        id = attrValue as string;
      } else {
        params.set(attrName, attrValue as string);
      }
    }
    if (!id) continue;
    // procedure tag only exists in iBatis
    if (
      tagName !== 'select' &&
      tagName !== 'insert' &&
      tagName !== 'update' &&
      tagName !== 'delete' &&
      tagName !== 'procedure'
    )
      continue;

    const textInclude = getTextInclude(elemRow, elemRows);
    let sqlInclude = '';
    try {
      sqlInclude = removeCommentLiteralSql(textInclude);
    } catch (ex) {
      sqlInclude = removeCommentSql(textInclude);
      console.log(`${id} has ${ex}`);
    }

    const text = getTextCdataFromElement(elemRow);
    let sql = '';
    try {
      sql = removeCommentLiteralSql(text);
    } catch (ex) {
      sql = removeCommentSql(text);
      console.log(`${id} has ${ex}`);
    }

    const objectAndSchemaDotObject = getObjectAsUpper(`${sqlInclude}\n${sql}`);
    const { tables, objectAndTables } = getObjects(objectAndSchemaDotObject, tablesAll, objectAndTablesAll);

    nodes.push({ id, tagName, params, tables, objectAndTables });
  }

  const nodesJson = nodes.map((node) => ({
    id: node.id,
    tagName: node.tagName,
    params: JSON.stringify([...node.params]),
    tables: JSON.stringify([...node.tables]),
    objectAndTables: JSON.stringify([...node.objectAndTables].map(([object, tables]) => [object, [...tables]])),
  }));
  insertXmlNodeInfo(xmlPath, namespace, nodesJson);

  return { xmlPath, namespace, nodes };
}
