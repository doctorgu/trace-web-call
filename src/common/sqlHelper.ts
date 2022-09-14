import { xml2js, Element } from 'xml-js';
import {
  trimStartList,
  removeCommentSql,
  removeCommentLiteralSql,
  trimList,
  readFileSyncUtf16le,
  escapeDollar,
} from './util';
import { SqlTemplate } from '../common/sqliteHelper';
import { config } from '../config/config';
import { configReader } from '../config/configReader';
import { readdirSync, existsSync, statSync } from 'fs';
import { resolve } from 'path';
import betterSqlite3 from 'better-sqlite3';
import { runinsertToDbFirst } from './message';
import { getDbPath } from './common';
import tTables from '../sqlTemplate/TTables';
import tXmlInfo from '../sqlTemplate/TXmlInfo';

export type XmlNodeInfo = {
  id: string;
  tagName: string;
  params: Map<string, string>;
  tables: Set<string>;
  objectAndTables: ObjectAndTables;
};
export type XmlNodeInfoFind = XmlNodeInfo & {
  xmlPath: string;
  namespaceId: string;
};
export type XmlInfo = {
  xmlPath: string;
  namespace: string;
  nodes: XmlNodeInfo[];
};

export type ObjectAndTables = Map<string, Set<string>>;
export type ObjectType = 'view' | 'function' | 'procedure';

export function getTablesFromDb(): Set<string> {
  const rows = tTables.selectTables();
  const tables = new Set(rows.map(({ name }) => name));
  return tables;
}

export function getObjectAndTablesFromDb(objectType: ObjectType): ObjectAndTables {
  const rows = tTables.selectObjectAndTables(objectType);
  const objectAndTables = new Map(rows.map(({ object, tables }) => [object, new Set<string>(JSON.parse(tables))]));
  return objectAndTables;
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
        objectAndTablesCur.forEach((tables, object) => {
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
  const nodes: XmlNodeInfo[] = [];

  const rowXml = tXmlInfo.selectXmlInfo(xmlPath);
  if (!rowXml) {
    return null;
  }

  const rowsXmlNode = tXmlInfo.selectXmlNodeInfo(xmlPath);

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

export function getXmlInfo(
  rootDir: string,
  fullPath: string,
  tablesAll: Set<string>,
  objectAndTablesAll: ObjectAndTables
): XmlInfo | null {
  const xmlPath = getDbPath(rootDir, fullPath);

  const xmlDb = getXmlInfoFromDb(xmlPath);
  // if (!xmlDb) {
  //   throw new Error(runinsertToDbFirst);
  // }

  return xmlDb;
}

export function insertTablesToDb(): Set<string> {
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

  if (!tablesNew.size) return tablesNew;

  tTables.insertTables(tablesNew);

  return tablesNew;
}

export function insertObjectAndTables(tables: Set<string>): ObjectAndTables {
  const objectAndTablesAll = new Map<string, Set<string>>();

  const objectTypes: ObjectType[] = ['view', 'function', 'procedure'];
  for (const objectType of objectTypes) {
    const objectAndTables = getObjectAndTablesByObjectType(objectType, tables);
    objectAndTables.forEach((tables, object) => objectAndTablesAll.set(object, tables));
    if (objectAndTables.size) {
      tTables.insertObjectAndTables(objectType, objectAndTables);
    }
  }

  return objectAndTablesAll;
}

export function insertXmlInfoXmlNodeInfo(
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

  tXmlInfo.insertXmlInfoXmlNodeInfo(xmlPath, namespace, nodes);

  return { xmlPath, namespace, nodes };
}

export function insertXmlInfoFindKeyName(keyName: string, xmlInfosCur: XmlInfo[]) {
  const finds: XmlNodeInfoFind[] = xmlInfosCur
    .map(({ xmlPath, namespace, nodes }) => {
      return nodes.map((node) => ({
        xmlPath,
        namespaceId: namespace ? `${namespace}.${node.id}` : `${node.id}`,
        id: node.id,
        tagName: node.tagName,
        params: node.params,
        tables: node.tables,
        objectAndTables: node.objectAndTables,
      }));
    })
    .flat();
  tXmlInfo.insertXmlInfoFindKeyName(keyName, finds);
}
