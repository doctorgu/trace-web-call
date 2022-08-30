// import { Element, parseXml } from 'libxmljs2';
import { xml2js, Element, Attributes } from 'xml-js';
import { removeCommentSql, trimSpecific, trimEndSpecific, removeStringLiteralSql } from './util';
import { config } from '../config/config';
import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { resolve } from 'path';

export type XmlNodeInfo = {
  id: string;
  tagName: string;
  params: Map<string, string>;
  tables: Set<string>;
  objectAndTables: ObjectAndTables;
};
export type XmlInfo = {
  namespace: string;
  nodes: XmlNodeInfo[];
};
export type XmlNodeInfoFind = XmlNodeInfo & {
  namespace: string;
};

export type ObjectAndTables = Map<string, Set<string>>;
export type ObjectType = 'view' | 'function' | 'procedure';

export function getObjectAndTablesByObjectType(
  tables: Set<string>,
  objectType: ObjectType,
  objectAndTablesCache: Map<ObjectType, ObjectAndTables>
): ObjectAndTables {
  const objectAndTablesNew = objectAndTablesCache.get(objectType);
  if (objectAndTablesNew) {
    return objectAndTablesNew;
  }

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
    objectAndTablesCache.set(objectType, objectAndTables);
  } else {
    if (statSync(path).isDirectory()) {
      const files = readdirSync(path);
      files.forEach((file) => {
        const value = readFileSync(resolve(path, file), 'utf-8');
        const objectAndTablesCur = getObjectAndTables(value, tables, objectType);
        [...objectAndTablesCur].forEach(([object, tables]) => {
          objectAndTables.set(object, tables);
        });
      });

      objectAndTablesCache.set(objectType, objectAndTables);
    } else {
      const value = readFileSync(path, 'utf-8');
      const objectAndTables = getObjectAndTables(value, tables, objectType);

      objectAndTablesCache.set(objectType, objectAndTables);
    }
  }

  const objectAndTablesNew2 = objectAndTablesCache.get(objectType);
  if (!objectAndTablesNew2) {
    throw new Error(`Wrong objectAndTablesNew2: ${objectAndTablesNew2}`);
  }

  return objectAndTablesNew2;
}

function getTablesAsUpper(sql: string): Map<string, string> {
  const tableAndSchemaDotTable = new Map<string, string>();

  let m: RegExpExecArray | null;
  const re = /(?<schemaDot>\w+\.)*(?<table>\w+)/g;
  while ((m = re.exec(sql)) !== null) {
    const schemaDot = m.groups?.schemaDot?.toUpperCase() || '';
    const table = m.groups?.table.toUpperCase() || '';

    tableAndSchemaDotTable.set(table, `${schemaDot}${table}`);
  }

  return tableAndSchemaDotTable;
}

/** Return tables, and objectAndTables also return if objectAndTablesAll has value  */
function getObjects(
  tableAndSchemaDotTable: Map<string, string>,
  tablesAll: Set<string>,
  objectAndTablesAll: ObjectAndTables
): { tables: Set<string>; objectAndTables: ObjectAndTables } {
  const tables = new Set<string>();
  const objectAndTables: ObjectAndTables = new Map<string, Set<string>>();

  for (const [table, schemaDotTable] of tableAndSchemaDotTable) {
    const tableToAdd = (tablesAll.has(schemaDotTable) && schemaDotTable) || (tablesAll.has(table) && table);
    if (tableToAdd) {
      tables.add(tableToAdd);
    }

    const tableToAdd2 =
      (objectAndTablesAll.has(schemaDotTable) && schemaDotTable) || (objectAndTablesAll.has(table) && table);
    if (tableToAdd2) {
      const tablesInObject = objectAndTablesAll.get(tableToAdd2) || new Set<string>();
      objectAndTables.set(tableToAdd2, tablesInObject);

      [...tablesInObject].forEach((t) => tables.add(t));
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
  const sqlNoComment = removeCommentSql(sql);

  const objectAndTables: ObjectAndTables = new Map<string, Set<string>>();
  let m: RegExpExecArray | null;
  let re =
    /create(\s+or\s+replace)*((\s+no)*(\s+force))*\s+view\s+(?<schemaDot>"?[\w$#]+"?\.)*(?<view>"?[\w$#]+"?)\s+.+?as(?<sql>.+?);/gis;
  while ((m = re.exec(sqlNoComment)) !== null) {
    // const schemaDot = m.groups?.schemaDot || '';
    const view = trimSpecific(m.groups?.view || '', '"');
    const sql = m.groups?.sql || '';

    const tableAndSchemaDotTable = getTablesAsUpper(sql);
    const { tables } = getObjects(tableAndSchemaDotTable, tablesAll, new Map<string, Set<string>>());
    objectAndTables.set(`${view}`, tables);
  }

  return objectAndTables;
}

export function getFunctionAndTables(sql: string, tablesAll: Set<string>): ObjectAndTables {
  const sqlNoComment = removeCommentSql(sql);

  const objectAndTables: ObjectAndTables = new Map<string, Set<string>>();
  let m: RegExpExecArray | null;
  let re =
    /create(\s+or\s+replace)*(\s+editionable|\s+noneditionable)*\s+function\s+(?<schemaDot>"?[\w$#]+"?\.)*(?<func>"?[\w$#]+"?)\s+.+?return(?<sql>.+?)end(\s+\k<func>)?\s*;/gis;
  while ((m = re.exec(sqlNoComment)) !== null) {
    // const schemaDot = m.groups?.schemaDot || '';
    const func = trimSpecific(m.groups?.func || '', '"');
    const sql = m.groups?.sql || '';

    const tableAndSchemaDotTable = getTablesAsUpper(sql);
    const { tables } = getObjects(tableAndSchemaDotTable, tablesAll, new Map<string, Set<string>>());
    objectAndTables.set(`${func}`, tables);
  }

  return objectAndTables;
}

export function getProcedureAndTables(sql: string, tablesAll: Set<string>): ObjectAndTables {
  const sqlNoComment = removeCommentSql(sql);

  const objectAndTables: ObjectAndTables = new Map<string, Set<string>>();
  let m: RegExpExecArray | null;
  let re =
    /create(\s+or\s+replace)*\s+procedure\s+(?<schemaDot>"?[\w$#]+"?\.)*(?<procedure>"?[\w$#]+"?)\s+.+?(is|as)(?<sql>.+?)end(\s+\k<procedure>)?\s*;/gis;
  while ((m = re.exec(sqlNoComment)) !== null) {
    // const schemaDot = m.groups?.schemaDot || '';
    const procedure = trimSpecific(m.groups?.procedure || '', '"');
    const sql = m.groups?.sql || '';

    const tableAndSchemaDotTable = getTablesAsUpper(sql);
    const { tables } = getObjects(tableAndSchemaDotTable, tablesAll, new Map<string, Set<string>>());
    objectAndTables.set(`${procedure}`, tables);
  }

  return objectAndTables;
}

// function getTextInclude(parent: Element, root: Element) {
//   const childNodes = parent.childNodes();
//   const texts: string[] = [];
//   for (const childNode of childNodes) {
//     const elem = childNode as Element;
//     if (!elem.attr) continue;

//     const tagName = elem.name();
//     if (tagName !== 'include') continue;

//     const refid = elem.attr('refid')?.value();
//     const nodeFound = root.get(`sql[@id='${refid}']`);
//     if (!nodeFound) continue;

//     const elemFound = nodeFound as Element;
//     texts.push(elemFound.text());
//   }
//   return texts.join('\n');
// }

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

// export function getXmlInfo(xml: string, tablesAll: Set<string>, objectAndTablesAll: ObjectAndTables): XmlInfo | null {
//   const doc = parseXml(xml);
//   const root = doc.root();
//   if (!root) return null;

//   const namespace = root.attr('namespace')?.value() || '';

//   const nodes: XmlNodeInfo[] = [];

//   const childNodes = root.childNodes();
//   for (const childNode of childNodes) {
//     const elem = childNode as Element;
//     // Skip text node
//     if (!elem.attr) continue;

//     const tagName = elem.name();
//     if (tagName === 'sql') continue;

//     let id = '';
//     const params = new Map<string, string>();
//     const attrs = elem.attrs();
//     for (const attr of attrs) {
//       const attrName = attr.name();
//       const attrValue = attr.value();
//       if (attrName === 'id') {
//         id = attrValue;
//       } else {
//         params.set(attrName, attrValue);
//       }
//     }
//     if (!id) continue;

//     const textInclude = getTextInclude(elem, root);
//     const sqlInclude = removeCommentSql(textInclude);

//     const text = elem.text();
//     const sql = removeCommentSql(text);

//     const tableAndSchemaDotTable = getTablesAsUpper(`${sqlInclude}\n${sql}`);
//     const { tables, objectAndTables } = getObjects(tableAndSchemaDotTable, tablesAll, objectAndTablesAll);

//     nodes.push({ id, tagName, params, tables, objectAndTables });
//   }

//   return { namespace, nodes };
// }
/*
declaration: { attributes: { version: "1.0", encoding: "UTF-8" }, },
elements: [
  { type: "doctype", doctype: "mapper PUBLIC \"-//mybatis.org//DTD Mapper 3.0//EN\" \"http://mybatis.org/dtd/mybatis-3-mapper.dtd\"", },
  {
    type: "element",
    name: "mapper",
    attributes: { namespace: "OtherUserTable" },
    elements: [
      {
        type: "element",
        name: "select",
        attributes: { id: "selectUser", parameterType: "map", resultType: "DBObject", },
        elements: [
          {
            type: "text",
            text: "\r\n\t\tSELECT\tC.CUST_NM\r\n\t\tFROM\t\tCU_CUST_MST C,\r\n\t\t\t\t\t\tHDHS_TMS.TMS_APP_DEVICE_LIST@INTRO J\r\n\t\tWHERE\t\tC.CUST_NO = J.CUST_ID\r\n\t\t\t\t\t\tAND J.APP_GRP_ID = '1'\r\n\t",
          },
        ],
      },
    ],
  },
]
*/
export function getXmlInfo(xml: string, tablesAll: Set<string>, objectAndTablesAll: ObjectAndTables): XmlInfo | null {
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

    const textInclude = getTextInclude(elemRow, elemRows);
    const sqlInclude = removeStringLiteralSql(removeCommentSql(textInclude));

    const text = getTextCdataFromElement(elemRow);
    const sql = removeStringLiteralSql(removeCommentSql(text));

    const tableAndSchemaDotTable = getTablesAsUpper(`${sqlInclude}\n${sql}`);
    const { tables, objectAndTables } = getObjects(tableAndSchemaDotTable, tablesAll, objectAndTablesAll);

    nodes.push({ id, tagName, params, tables, objectAndTables });
  }

  return { namespace, nodes };
}
