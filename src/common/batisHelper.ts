import { xml2js, Element } from 'xml-js';
import { removeCommentSql, removeCommentLiteralSql, readFileSyncUtf16le, findFiles, trim } from './util';
import { config } from '../config/config';
import { existsSync, statSync } from 'fs';
import { getDbPath } from './common';
import tCache from '../sqlTemplate/TCache';
import tXmlInfo from '../sqlTemplate/TXmlInfo';
import { configReader } from '../config/configReader';

export type ObjectChild = {
  objects: Set<string>;

  tablesInsert: Set<string>;
  tablesUpdate: Set<string>;
  tablesDelete: Set<string>;
  tablesOther: Set<string>;

  selectExists: boolean;
};
export type ObjectInfo = { type: ObjectType; name: string } & ObjectChild;

export type XmlNodeInfo = {
  id: string;
  tagName: string;
  params: Map<string, string>;
} & ObjectChild;
export type XmlNodeInfoFind = {
  xmlPath: string;
  namespaceId: string;
} & XmlNodeInfo;
export type XmlInfo = {
  xmlPath: string;
  namespace: string;
  nodes: XmlNodeInfo[];
};

export type ObjectType = 'table' | 'view' | 'function' | 'procedure';
export type IudType = 'INSERT' | 'UPDATE' | 'DELETE';

export function getTablesFromDb(): Set<string> {
  const path = config.path.data.tables;
  const rows = tCache.selectTables(path);
  const tables = new Set(rows.map(({ name }) => name));
  return tables;
}

export function getObjectNameTypesFromDb(): Map<string, ObjectType> {
  let nameTypes = new Map<string, ObjectType>();

  const rows = tCache.selectObjectsNameType(configReader.objectTypeAndPath());
  for (const { name, type } of rows) {
    nameTypes.set(name, type);
  }

  return nameTypes;
}

export function getObjectNameTypeSqls(objectType: ObjectType): Map<string, { type: ObjectType; sql: string }> {
  function getNameTypeSqls(type: ObjectType, sql: string): Map<string, { type: ObjectType; sql: string }> {
    const sqlNoComment = removeCommentLiteralSql(sql);

    const res = new Map<ObjectType, RegExp>([
      [
        'view',
        /create(\s+or\s+replace)*((\s+no)*(\s+force))*\s+view\s+(?<schemaDot>"?[\w$#]+"?\.)?(?<object>"?[\w$#]+"?)\s+.+?as(?<sql>.+?);/gis,
      ],
      [
        'function',
        /create(\s+or\s+replace)*(\s+editionable|\s+noneditionable)*\s+function\s+(?<schemaDot>"?[\w$#]+"?\.)?(?<object>"?[\w$#]+"?)\s+.+?return(?<sql>.+?)end(\s+\k<object>)?\s*;/gis,
      ],
      [
        'procedure',
        /create(\s+or\s+replace)*\s+procedure\s+(?<schemaDot>"?[\w$#]+"?\.)?(?<object>"?[\w$#]+"?)\s+.+?(is|as)(?<sql>.+?)end(\s+\k<object>)?\s*;/gis,
      ],
    ]);
    let m: RegExpExecArray | null;
    const re = res.get(type);
    if (!re) throw new Error(`Wrong type: ${type}`);

    const nameTypeSqls = new Map<string, { type: ObjectType; sql: string }>();
    while ((m = re.exec(sqlNoComment)) !== null) {
      // const schemaDot = m.groups?.schemaDot || '';
      const object = trim(m.groups?.object || '', '"');
      const sql = m.groups?.sql || '';

      nameTypeSqls.set(object, { type, sql });
    }

    return nameTypeSqls;
  }

  let nameTypeSqlsAll = new Map<string, { type: ObjectType; sql: string }>();

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

  if (existsSync(path)) {
    const fullPaths = statSync(path).isDirectory() ? [...findFiles(path)] : [path];
    for (const fullPath of fullPaths) {
      const sql = readFileSyncUtf16le(fullPath);
      const nameTypeSqls = getNameTypeSqls(objectType, sql);
      nameTypeSqlsAll = new Map<string, { type: ObjectType; sql: string }>([...nameTypeSqlsAll, ...nameTypeSqls]);
    }
  }

  return nameTypeSqlsAll;
}

function getObjectTypeAndName(
  schemaDotObject: string,
  object: string,
  tablesAll: Set<string>,
  objectNameTypesAll: Map<string, ObjectType>
): { type: ObjectType; name: string } | null {
  const table = (tablesAll.has(schemaDotObject) && schemaDotObject) || (tablesAll.has(object) && object);
  if (table) {
    return { type: 'table', name: table };
  }

  let name = schemaDotObject;
  let type = objectNameTypesAll.get(name);
  if (!type) {
    name = object;
    type = objectNameTypesAll.get(name);
  }
  if (!type) return null;

  return { type, name };
}
function getObjectChild(sql: string, tablesAll: Set<string>, objectNameTypesAll: Map<string, ObjectType>): ObjectChild {
  const tablesInsert = new Set<string>();
  const tablesUpdate = new Set<string>();
  const tablesDelete = new Set<string>();
  const tablesOther = new Set<string>();
  const objects = new Set<string>();
  let selectExists = false;

  const re = /(?<schemaDot>"?[\w$#]+"?\.)?(?<object>"?[\w$#]+"?)/g;

  let prevType: IudType | 'NONE' = 'NONE';

  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    const schemaDot = m.groups?.schemaDot?.toUpperCase() || '';
    const object = m.groups?.object.toUpperCase() || '';
    const schemaDotObject = `${schemaDot}${object}`;

    switch (object) {
      case 'INSERT':
      case 'UPDATE':
      case 'DELETE':
        prevType = object;
        continue;
      case 'FROM':
        if (prevType === 'DELETE') {
          continue;
        }
        break;
      case 'SELECT':
        selectExists = true;
        continue;
    }

    const ret = getObjectTypeAndName(schemaDotObject, object, tablesAll, objectNameTypesAll);
    if (!ret) continue;

    const { type, name } = ret;

    if (prevType !== 'NONE') {
      if (type === 'table') {
        switch (prevType) {
          case 'INSERT':
            tablesInsert.add(name);
            break;
          case 'UPDATE':
            tablesUpdate.add(name);
            break;
          case 'DELETE':
            tablesDelete.add(name);
            break;
        }
      } else {
        throw new Error(`No table name after ${prevType}`);
      }
    } else {
      if (type === 'table') {
        tablesOther.add(name);
      } else {
        objects.add(name);
      }
    }

    prevType = 'NONE';
  }

  return { objects, tablesInsert, tablesUpdate, tablesDelete, tablesOther, selectExists };
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

export function getXmlInfoFromDb(xmlPath: string): XmlInfo | null {
  const rowXml = tXmlInfo.selectXmlInfo(xmlPath);
  if (!rowXml) {
    return null;
  }

  const rowsXmlNode = tXmlInfo.selectXmlNodeInfo(xmlPath);

  const { namespace } = rowXml;

  const nodes: XmlNodeInfo[] = rowsXmlNode.map(
    ({ id, tagName, params, objects, tablesInsert, tablesUpdate, tablesDelete, tablesOther, selectExists }) => ({
      id,
      tagName,
      params: new Map<string, string>(JSON.parse(params)),
      objects: new Set<string>(JSON.parse(objects)),
      tablesInsert: new Set<string>(JSON.parse(tablesInsert)),
      tablesUpdate: new Set<string>(JSON.parse(tablesUpdate)),
      tablesDelete: new Set<string>(JSON.parse(tablesDelete)),
      tablesOther: new Set<string>(JSON.parse(tablesOther)),
      selectExists,
    })
  );

  return { xmlPath, namespace, nodes };
}

export function insertTablesToDb(): Set<string> {
  let tablesNew = new Set<string>();

  const path = config.path.data.tables;

  const fullPaths = statSync(path).isDirectory() ? [...findFiles(path)] : [path];
  for (const fullPath of fullPaths) {
    let values: string[] = [];

    const value = readFileSyncUtf16le(fullPath);
    values = values.concat(value.split(/\r*\n/));

    tablesNew = new Set(values.filter((v) => !!v).map((v) => v.toUpperCase()));
  }
  if (!tablesNew.size) return tablesNew;

  tCache.insertTables(path, tablesNew);

  return tablesNew;
}

export function insertObjects(tablesAll: Set<string>): Map<string, ObjectType> {
  let nameTypeSqlsAll = new Map<string, { type: ObjectType; sql: string }>();
  const objectTypes: ObjectType[] = ['view', 'function', 'procedure'];
  for (const objectType of objectTypes) {
    const nameTypeSqls = getObjectNameTypeSqls(objectType);
    nameTypeSqlsAll = new Map<string, { type: ObjectType; sql: string }>([...nameTypeSqlsAll, ...nameTypeSqls]);
  }
  const nameTypesAll = new Map<string, ObjectType>([...nameTypeSqlsAll].map(([name, { type }]) => [name, type]));

  let objectInfos: ObjectInfo[] = [];
  for (const [name, { type, sql }] of nameTypeSqlsAll) {
    const objectChild = getObjectChild(sql, tablesAll, nameTypesAll);
    objectInfos.push({ type, name, ...objectChild });
  }

  if (objectInfos.length) {
    tCache.insertObjects(configReader.objectTypeAndPath(), objectInfos);
  }

  return nameTypesAll;
}

export function insertXmlInfoXmlNodeInfo(
  rootDir: string,
  fullPath: string,
  tablesAll: Set<string>,
  objectNameTypesAll: Map<string, ObjectType>
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
      console.error(`${id} has ${ex}`);
    }

    const text = getTextCdataFromElement(elemRow);
    let sql = '';
    try {
      sql = removeCommentLiteralSql(text);
    } catch (ex) {
      sql = removeCommentSql(text);
      console.error(`${id} has ${ex}`);
    }

    const { objects, tablesInsert, tablesUpdate, tablesDelete, tablesOther, selectExists } = getObjectChild(
      `${sqlInclude}\n${sql}`,
      tablesAll,
      objectNameTypesAll
    );

    nodes.push({ id, tagName, params, objects, tablesInsert, tablesUpdate, tablesDelete, tablesOther, selectExists });
  }

  tXmlInfo.insertXmlInfoXmlNodeInfo(xmlPath, namespace, nodes);

  return { xmlPath, namespace, nodes };
}

export function insertXmlInfoFindKeyName(keyName: string, xmlInfosCur: XmlInfo[]) {
  const finds: XmlNodeInfoFind[] = xmlInfosCur
    .map(({ xmlPath, namespace, nodes }) => {
      return nodes.map(
        ({ id, tagName, params, objects, tablesInsert, tablesUpdate, tablesDelete, tablesOther, selectExists }) => ({
          xmlPath,
          namespaceId: namespace ? `${namespace}.${id}` : `${id}`,
          id,
          tagName,
          params,
          objects,
          tablesInsert,
          tablesUpdate,
          tablesDelete,
          tablesOther,
          selectExists,
        })
      );
    })
    .flat();
  tXmlInfo.insertXmlInfoFindKeyName(keyName, finds);
}
