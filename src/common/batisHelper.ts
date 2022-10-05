import { xml2js, Element } from 'xml-js';
import { removeCommentSql, removeCommentLiteralSql, readFileSyncUtf16le, findFiles, trim, trimEnd } from './util';
import { config } from '../config/config';
import { existsSync, statSync } from 'fs';
import { getDbPath } from './common';
import tCache from '../sqlTemplate/TCache';
import tXmlInfo from '../sqlTemplate/TXmlInfo';
import { configReader } from '../config/configReader';
import { appendFileSync } from 'fs';
import { resolve } from 'path';
import { format } from 'date-fns';

export type ObjectChild = {
  objects: Set<string>;

  tablesInsert: Set<string>;
  tablesUpdate: Set<string>;
  tablesDelete: Set<string>;
  tablesOther: Set<string>;

  selectExists: boolean;
};
export type ObjectInfo = { type: ObjectType; name: string } & ObjectChild;
export type IudExistsSchemaDotSql = {
  tablesInsert: Set<string>;
  tablesUpdate: Set<string>;
  tablesDelete: Set<string>;
  selectExists: boolean;
  schemaDotObjects: Set<string>;
  sql: string;
};

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

export function getUsersFromDb(): Set<string> {
  const path = config.path.data.users;
  const rows = tCache.selectUsers(path);
  const tables = new Set(rows.map(({ name }) => name));
  return tables;
}

export function getTablesFromDb(): Set<string> {
  const path = config.path.data.tables;
  const rows = tCache.selectTables(path);
  const tables = new Set(rows.map(({ name }) => name));
  return tables;
}

export function getNameObjectsAllFromDb(): Map<string, ObjectInfo> {
  let nameObjectsAll = new Map<string, ObjectInfo>();

  const rows = tCache.selectObjectsAll(configReader.objectTypeAndPath());
  for (const { type, name, objects, tablesInsert, tablesUpdate, tablesDelete, tablesOther, selectExists } of rows) {
    nameObjectsAll.set(name, {
      type,
      name,
      objects: new Set<string>(JSON.parse(objects)),
      tablesInsert: new Set<string>(JSON.parse(tablesInsert)),
      tablesUpdate: new Set<string>(JSON.parse(tablesUpdate)),
      tablesDelete: new Set<string>(JSON.parse(tablesDelete)),
      tablesOther: new Set<string>(JSON.parse(tablesOther)),
      selectExists: selectExists === 1,
    });
  }

  return nameObjectsAll;
}

export function getObjectNameTypeSqls(
  objectType: ObjectType | 'package'
): Map<string, { type: ObjectType; sql: string }> {
  function getFunctionProcedure(sqlNoComment: string): Map<string, { type: ObjectType; sql: string }> {
    const rePackage =
      /create(\s+or\s+replace)?\s+package\s+body\s+(?<schemaDot>"?[\w$#]+"?\.)?(?<object>"?[\w$#]+"?)\s+(is|as)(?<sql>.+?)end(\s+\k<object>)?\s*;/gis;
    let m: RegExpExecArray | null;

    const resFuncProc: [ObjectType, RegExp][] = [
      [
        'function',
        /\s+function\s+(?<schemaDot>"?[\w$#]+"?\.)?(?<object>"?[\w$#]+"?)\s+.+?return(?<sql>.+?)end(\s+\k<object>)?\s*;/gis,
      ],
      [
        'procedure',
        /\s+procedure\s+(?<schemaDot>"?[\w$#]+"?\.)?(?<object>"?[\w$#]+"?)\s+.+?(is|as)(?<sql>.+?)end(\s+\k<object>)?\s*;/gis,
      ],
    ];

    let nameTypeSqlsAll = new Map<string, { type: ObjectType; sql: string }>();
    while ((m = rePackage.exec(sqlNoComment)) !== null) {
      const sqlPackage = m.groups?.sql || '';

      for (const [typeFuncProc, reFuncProc] of resFuncProc) {
        let m: RegExpExecArray | null;
        const nameTypeSqls = new Map<string, { type: ObjectType; sql: string }>();
        while ((m = reFuncProc.exec(sqlPackage)) !== null) {
          // const schemaDot = m.groups?.schemaDot || '';
          const object = trim(m.groups?.object || '', '"').toUpperCase();
          const sqlFuncProc = m.groups?.sql || '';
          nameTypeSqls.set(object, { type: typeFuncProc, sql: sqlFuncProc });
          nameTypeSqlsAll = new Map<string, { type: ObjectType; sql: string }>([...nameTypeSqlsAll, ...nameTypeSqls]);
        }
      }
    }

    return nameTypeSqlsAll;
  }
  function getNameTypeSqls(type: ObjectType, sqlNoComment: string): Map<string, { type: ObjectType; sql: string }> {
    const res = new Map<ObjectType, RegExp>([
      [
        'view',
        /create(\s+or\s+replace)?((\s+no)?(\s+force))?\s+view\s+(?<schemaDot>"?[\w$#]+"?\.)?(?<object>"?[\w$#]+"?)\s+.+?as(?<sql>.+?);/gis,
      ],
      [
        'function',
        /create(\s+or\s+replace)?(\s+editionable|\s+noneditionable)?\s+function\s+(?<schemaDot>"?[\w$#]+"?\.)?(?<object>"?[\w$#]+"?)\s+.+?return(?<sql>.+?)end(\s+\k<object>)?\s*;/gis,
      ],
      [
        'procedure',
        /create(\s+or\s+replace)?\s+procedure\s+(?<schemaDot>"?[\w$#]+"?\.)?(?<object>"?[\w$#]+"?)\s+.+?(is|as)(?<sql>.+?)end(\s+\k<object>)?\s*;/gis,
      ],
    ]);
    let m: RegExpExecArray | null;
    const re = res.get(type);
    if (!re) throw new Error(`Wrong type: ${type}`);

    const nameTypeSqls = new Map<string, { type: ObjectType; sql: string }>();
    while ((m = re.exec(sqlNoComment)) !== null) {
      // const schemaDot = m.groups?.schemaDot || '';
      const object = trim(m.groups?.object || '', '"').toUpperCase();
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
    case 'package':
      path = config.path.data.packages;
      break;
    default:
      throw new Error(`Wrong objectType: ${objectType}`);
  }

  if (existsSync(path)) {
    const fullPaths = statSync(path).isDirectory() ? [...findFiles(path)] : [path];
    for (const fullPath of fullPaths) {
      const sql = readFileSyncUtf16le(fullPath);
      const sqlNoComment = removeCommentLiteralSql(sql);
      if (objectType === 'package') {
        const nameTypeSqlsFuncProc = getFunctionProcedure(sqlNoComment);
        nameTypeSqlsAll = new Map<string, { type: ObjectType; sql: string }>([
          ...nameTypeSqlsAll,
          ...nameTypeSqlsFuncProc,
        ]);
      } else {
        const nameTypeSqls = getNameTypeSqls(objectType, sqlNoComment);
        nameTypeSqlsAll = new Map<string, { type: ObjectType; sql: string }>([...nameTypeSqlsAll, ...nameTypeSqls]);
      }
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
function getTablesIudFromSql(usersAll: Set<string>, sql: string): IudExistsSchemaDotSql {
  const tablesInsert = new Set<string>();
  const tablesUpdate = new Set<string>();
  const tablesDelete = new Set<string>();
  let selectExists = false;
  const schemaDotObjects = new Set<string>();

  const re = /(?<userDot>"?[\w$#]+"?\.)?(?<schemaDot>"?[\w$#]+"?\.)?(?<object>"?[\w$#]+"?)/g;

  let prevType: IudType | 'MERGE' | 'SET' | 'NONE' = 'NONE';

  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    const userDot = m.groups?.userDot?.toUpperCase() || '';
    const schemaDot = m.groups?.schemaDot?.toUpperCase() || '';
    const object = m.groups?.object.toUpperCase() || '';

    let schemaDotObject = '';
    if (userDot && schemaDot && object) {
      const isUser = usersAll.has(trimEnd(userDot, '.'));
      if (!isUser) {
        throw new Error(`First part is not user in ${userDot}${schemaDot}${object}`);
      }

      schemaDotObject = `${schemaDot}${object}`;
    } else if (userDot && object) {
      schemaDotObject = `${userDot}${object}`;
    } else if (object) {
      schemaDotObject = `${object}`;
    }

    switch (object) {
      case 'INSERT':
      case 'UPDATE':
      case 'DELETE':
        prevType = object;
        continue;
      case 'MERGE':
        prevType = object;
        continue;
      case 'INTO':
        if (prevType === 'INSERT' || prevType === 'MERGE') {
          continue;
        }
        break;
      case 'ALL':
        if (prevType === 'INSERT') {
          continue;
        }
        break;
      case 'SET':
        // MERGE INTO...SET case
        if (prevType === 'UPDATE') {
          prevType = 'NONE';
          continue;
        }
        break;
      case 'FROM':
        if (prevType === 'DELETE') {
          continue;
        }
        break;
      case 'SELECT':
        selectExists = true;
        continue;
    }

    if (prevType !== 'NONE') {
      switch (prevType) {
        case 'INSERT':
          tablesInsert.add(schemaDotObject);
          break;
        case 'UPDATE':
          tablesUpdate.add(schemaDotObject);
          break;
        case 'DELETE':
          tablesDelete.add(schemaDotObject);
          break;
        case 'MERGE':
          tablesInsert.add(schemaDotObject);
          tablesUpdate.add(schemaDotObject);
          break;
      }
    } else {
      schemaDotObjects.add(schemaDotObject);
    }

    prevType = 'NONE';
  }

  return { tablesInsert, tablesUpdate, tablesDelete, selectExists, schemaDotObjects, sql };
}
function appendLog(
  prepend: string,
  schemaDotObject: string,
  name: string,
  type: ObjectType | 'xml',
  typeIudSub: { type: ObjectType; iud: IudExistsSchemaDotSql } | undefined,
  sql: string
) {
  const dateTime = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
  const body = `schemaDotObject: ${schemaDotObject}, name: ${name}, type: ${type}, typeSub: ${typeIudSub?.type},
sql: ${sql}`;
  const log = `==================================================
${dateTime} ${prepend} ${body}

`;
  appendFileSync(resolve(config.path.logDirectory, 'getObjectChild.log'), log);
  // console.log(log);
}
function getTablesIud(
  tables: Set<string>,
  usersAll: Set<string>,
  tablesAll: Set<string>,
  nameTypeIudsAll: Map<string, { type: ObjectType; iud: IudExistsSchemaDotSql }> | null,
  nameObjectsAll: Map<string, ObjectInfo> | null,
  typeForLog: ObjectType | 'xml',
  nameForLog: string,
  sqlForLog: string
): Set<string> {
  const tablesNew = new Set<string>();
  for (const schemaDotObject of tables) {
    const object = schemaDotObject.includes('.') ? schemaDotObject.split('.')[1] : schemaDotObject;

    const table = (tablesAll.has(schemaDotObject) && schemaDotObject) || (tablesAll.has(object) && object);
    if (table) {
      tablesNew.add(table);
      continue;
    }

    let tableFound: string | undefined = '';
    let typeIudSub = undefined;
    if (nameTypeIudsAll) {
      typeIudSub = nameTypeIudsAll.get(schemaDotObject) || nameTypeIudsAll.get(object);
      if (!typeIudSub) {
        appendLog('Table or objects not exists in IUD', schemaDotObject, nameForLog, typeForLog, typeIudSub, sqlForLog);
        continue;
      }
      if (typeIudSub.type !== 'view') {
        appendLog('Object is not table or view in IUD', schemaDotObject, nameForLog, typeForLog, typeIudSub, sqlForLog);
        continue;
      }

      const sqlView = typeIudSub.iud.sql;
      const { schemaDotObjects: schemaDotObjectsView, selectExists: selectExistsView } = getTablesIudFromSql(
        usersAll,
        sqlView
      );
      tableFound = [...schemaDotObjectsView].find((schemaDotObject) => {
        const object = schemaDotObject.includes('.') ? schemaDotObject.split('.')[1] : schemaDotObject;
        return (tablesAll.has(schemaDotObject) && schemaDotObject) || (tablesAll.has(object) && object);
      });
    } else if (nameObjectsAll) {
      const objectsFound = nameObjectsAll.get(schemaDotObject) || nameObjectsAll.get(object);
      if (!objectsFound) {
        appendLog('Table or objects not exists in IUD', schemaDotObject, nameForLog, typeForLog, undefined, sqlForLog);
        continue;
      }
      if (objectsFound.type !== 'view') {
        appendLog('Object is not table or view in IUD', schemaDotObject, nameForLog, typeForLog, undefined, sqlForLog);
        continue;
      }

      const { tablesOther } = objectsFound;
      tableFound = (tablesOther.has(schemaDotObject) && schemaDotObject) || (tablesOther.has(object) && object) || '';
    }

    if (!tableFound) {
      appendLog('Table not exists inside view', schemaDotObject, nameForLog, typeForLog, typeIudSub, sqlForLog);
      continue;
    }

    tablesNew.add(tableFound);
  }

  return tablesNew;
}
function getObjectChild(
  iud: IudExistsSchemaDotSql,
  usersAll: Set<string>,
  tablesAll: Set<string>,
  nameTypeIudsAll: Map<string, { type: ObjectType; iud: IudExistsSchemaDotSql }> | null,
  nameObjectsAll: Map<string, ObjectInfo> | null,
  typeForLog: ObjectType | 'xml',
  nameForLog: string,
  sqlForLog: string
): ObjectChild {
  const { tablesInsert, tablesUpdate, tablesDelete, selectExists, schemaDotObjects, sql } = iud;
  // If inserted to view, change to table inside of view
  const tablesInsertNew = getTablesIud(
    tablesInsert,
    usersAll,
    tablesAll,
    nameTypeIudsAll,
    nameObjectsAll,
    typeForLog,
    nameForLog,
    sqlForLog
  );
  const tablesUpdateNew = getTablesIud(
    tablesUpdate,
    usersAll,
    tablesAll,
    nameTypeIudsAll,
    nameObjectsAll,
    typeForLog,
    nameForLog,
    sqlForLog
  );
  const tablesDeleteNew = getTablesIud(
    tablesDelete,
    usersAll,
    tablesAll,
    nameTypeIudsAll,
    nameObjectsAll,
    typeForLog,
    nameForLog,
    sqlForLog
  );

  const tablesOtherNew = new Set<string>();
  const objectsNew = new Set<string>();
  for (const schemaDotObject of schemaDotObjects) {
    const object = schemaDotObject.includes('.') ? schemaDotObject.split('.')[1] : schemaDotObject;

    const tableNew = (tablesAll.has(schemaDotObject) && schemaDotObject) || (tablesAll.has(object) && object);
    if (tableNew) {
      tablesOtherNew.add(tableNew);
      continue;
    }

    if (nameTypeIudsAll) {
      const objectNew =
        (nameTypeIudsAll.get(schemaDotObject) && schemaDotObject) || (nameTypeIudsAll.get(object) && object);
      if (objectNew) {
        objectsNew.add(objectNew);
        continue;
      }
    } else if (nameObjectsAll) {
      const objectNew =
        (nameObjectsAll.get(schemaDotObject) && schemaDotObject) || (nameObjectsAll.get(object) && object);
      if (objectNew) {
        objectsNew.add(objectNew);
        continue;
      }
    }
  }

  return {
    objects: objectsNew,
    tablesInsert: tablesInsertNew,
    tablesUpdate: tablesUpdateNew,
    tablesDelete: tablesDeleteNew,
    tablesOther: tablesOtherNew,
    selectExists,
  };
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

export function insertUsersToDb(): Set<string> {
  let usersAll = new Set<string>();

  const path = config.path.data.users;

  const fullPaths = statSync(path).isDirectory() ? [...findFiles(path)] : [path];
  for (const fullPath of fullPaths) {
    let values: string[] = [];

    const value = readFileSyncUtf16le(fullPath);
    values = values.concat(value.split(/\r*\n/));

    const users = new Set(values.filter((v) => !!v).map((v) => v.toUpperCase()));
    usersAll = new Set([...usersAll, ...users]);
  }
  if (!usersAll.size) return usersAll;

  tCache.insertUsers(path, usersAll);

  return usersAll;
}

export function insertTablesToDb(): Set<string> {
  let tablesAll = new Set<string>();

  const path = config.path.data.tables;

  const fullPaths = statSync(path).isDirectory() ? [...findFiles(path)] : [path];
  for (const fullPath of fullPaths) {
    let values: string[] = [];

    const value = readFileSyncUtf16le(fullPath);
    values = values.concat(value.split(/\r*\n/));

    const tables = new Set(values.filter((v) => !!v).map((v) => v.toUpperCase()));
    tablesAll = new Set([...tablesAll, ...tables]);
  }
  if (!tablesAll.size) return tablesAll;

  tCache.insertTables(path, tablesAll);

  return tablesAll;
}

export function insertObjects(usersAll: Set<string>, tablesAll: Set<string>): Map<string, ObjectInfo> {
  let nameTypeSqlsAll = new Map<string, { type: ObjectType; sql: string }>();
  const objectTypes: (ObjectType | 'package')[] = ['view', 'function', 'procedure', 'package'];
  for (const objectType of objectTypes) {
    const nameTypeSqls = getObjectNameTypeSqls(objectType);
    nameTypeSqlsAll = new Map<string, { type: ObjectType; sql: string }>([...nameTypeSqlsAll, ...nameTypeSqls]);
  }

  const nameTypeIudsAll = new Map(
    [...nameTypeSqlsAll].map(([name, { type, sql }]) => {
      const iud = getTablesIudFromSql(usersAll, sql);
      return [name, { type, iud }];
    })
  );

  const objectsAll: ObjectInfo[] = [];
  const nameObjectsAll = new Map<string, ObjectInfo>();
  for (const [name, { type, iud }] of nameTypeIudsAll) {
    const { sql } = iud;
    const objectChild = getObjectChild(iud, usersAll, tablesAll, nameTypeIudsAll, null, type, name, sql);
    const object = { type, name, ...objectChild };
    objectsAll.push(object);
    nameObjectsAll.set(name, object);
  }
  if (objectsAll.length) {
    tCache.insertObjects(configReader.objectTypeAndPath(), objectsAll);
  }

  return nameObjectsAll;
}

export function insertXmlInfoXmlNodeInfo(
  rootDir: string,
  fullPath: string,
  usersAll: Set<string>,
  tablesAll: Set<string>,
  nameObjectsAll: Map<string, ObjectInfo>
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

    const iud = getTablesIudFromSql(usersAll, sql);
    const { objects, tablesInsert, tablesUpdate, tablesDelete, tablesOther, selectExists } = getObjectChild(
      iud,
      usersAll,
      tablesAll,
      null,
      nameObjectsAll,
      'xml',
      id,
      `${sqlInclude}\n${sql}`
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
