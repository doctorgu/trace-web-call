import { xml2js, Element } from 'xml-js';
import {
  removeCommentSql,
  removeCommentLiteralSql,
  readFileSyncUtf16le,
  findFiles,
  trim,
  trimEnd,
  isSqlKeyword,
} from './util';
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
  names: Set<string>;
  sql: string;
};
export type IudExistsSchemaDotSql2 = { type: ObjectType; name: string } & IudExistsSchemaDotSql;

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

function appendLog(
  prepend: string,
  schemaDotObject: string,
  name: string,
  type: ObjectType | 'xml',
  typeIudSub: IudExistsSchemaDotSql2 | undefined,
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
function appendLogOwner(userDot: string, schemaDot: string, object: string, name: string, sql: string) {
  const dateTime = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
  const body = `userDot: ${userDot}, schemaDot: ${schemaDot}, object: ${object},
sql: ${sql}`;
  const log = `==================================================
${dateTime} ${name} ${body}

`;
  appendFileSync(resolve(config.path.logDirectory, 'owner.log'), log);
  // console.log(log);
}

function getNameNoSchema(name: string): string {
  const names = name.split('.');
  if (names.length > 1) {
    return names.filter((v, i) => i > 0).join('.');
  }
  return name;
}

export function getUsersFromDb(): Set<string> {
  const path = config.path.data.users;
  const rows = tCache.selectUsers(path);
  const users = new Set(rows.map(({ name }) => name));
  return users;
}

export function getTablesFromDb(): { tables: Set<string>; tablesNoSchema: Set<string> } {
  const path = config.path.data.tables;
  const rows = tCache.selectTables(path);
  const tables = new Set(rows.map(({ name }) => name));
  const tablesNoSchema = new Set(rows.map(({ name }) => getNameNoSchema(name)));
  return { tables, tablesNoSchema };
}

export function getNameObjectsAllFromDb(): {
  nameObjects: Map<string, ObjectInfo>;
  nameObjectsNoSchema: Map<string, ObjectInfo>;
} {
  let nameObjects = new Map<string, ObjectInfo>();
  let nameObjectsNoSchema = new Map<string, ObjectInfo>();

  const rows = tCache.selectObjectsAll(configReader.objectTypeAndPath());
  for (const { type, name, objects, tablesInsert, tablesUpdate, tablesDelete, tablesOther, selectExists } of rows) {
    const nameNoSchema = getNameNoSchema(name);

    nameObjects.set(name, {
      type,
      name,
      objects: new Set<string>(JSON.parse(objects)),
      tablesInsert: new Set<string>(JSON.parse(tablesInsert)),
      tablesUpdate: new Set<string>(JSON.parse(tablesUpdate)),
      tablesDelete: new Set<string>(JSON.parse(tablesDelete)),
      tablesOther: new Set<string>(JSON.parse(tablesOther)),
      selectExists: selectExists === 1,
    });
    nameObjectsNoSchema.set(nameNoSchema, {
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

  return { nameObjects, nameObjectsNoSchema };
}
function matchAllCreate(
  type: 'function' | 'procedure' | 'package\\s+body',
  sql: string,
  usersAll: Set<string>
): { schemaDot: string; object: string; sql: string }[] {
  let before = '';
  if (type === 'function') {
    before = '(\\s+editionable|\\s+noneditionable)?';
  }

  let after = '';
  if (type === 'function') {
    after = '.+?return';
  } else if (type === 'procedure') {
    after = '.+?(is|as)';
  } else if (type === 'package\\s+body') {
    after = '\\s+(is|as)';
  }

  const prefix = `create(\\s+or\\s+replace)?${before}\\s+${type}\\s+(?<schemaDot{index}>"?[\\w$#]+"?\\.)?(?<object{index}>"?[\\w$#]+"?)${after}(?<sql{index}>.+?)end`;
  const re1 = `${prefix}\\s+\\k<object{index}>\\s*;`.replace(/{index}/g, '0');
  const re2 = `${prefix}\\s*;`.replace(/{index}/g, '1');
  const re = `${re1}|${re2}`;
  const ms = sql.matchAll(new RegExp(re, 'gis'));

  const rets: { schemaDot: string; object: string; sql: string }[] = [];
  for (const m of ms) {
    const schemaDot = trim(m.groups?.schemaDot0 || m.groups?.schemaDot1 || '', '"').toUpperCase();
    if (schemaDot && !usersAll.has(trimEnd(schemaDot, '.'))) {
      continue;
    }

    const object = trim(m.groups?.object0 || m.groups?.object1 || '', '"').toUpperCase();
    const sql = m.groups?.sql0 || m.groups?.sql1 || '';
    rets.push({ schemaDot, object, sql });
  }
  return rets;
}
function matchAllFuncProcInPkg(type: 'function' | 'procedure', sql: string): { object: string; sql: string }[] {
  let after = '';
  if (type === 'function') {
    after = '.+?return';
  } else if (type === 'procedure') {
    after = '.+?(is|as)';
  }
  const prefix = `\\s+${type}\\s+(?<object{index}>"?[\\w$#]+"?)${after}(?<sql{index}>.+?)end`;
  const re1 = `${prefix}\\s+\\k<object{index}>\\s*;`.replace(/{index}/g, '0');
  const re2 = `${prefix}\\s*;`.replace(/{index}/g, '1');
  const re = `${re1}|${re2}`;
  const ms = sql.matchAll(new RegExp(re, 'gis'));

  const rets: { object: string; sql: string }[] = [];
  for (const m of ms) {
    const object = trim(m.groups?.object0 || m.groups?.object1 || '', '"').toUpperCase();
    const sql = m.groups?.sql0 || m.groups?.sql1 || '';
    rets.push({ object, sql });
  }
  return rets;
}
export function getObjectNameTypeSqls(
  objectType: 'function' | 'procedure' | 'package',
  usersAll: Set<string>
): Map<string, { type: 'function' | 'procedure'; sql: string }> {
  function getFuncProcInPkg(
    sqlNoComment: string,
    usersAll: Set<string>
  ): Map<string, { type: 'function' | 'procedure'; sql: string }> {
    const typeFuncProcs: ('function' | 'procedure')[] = ['function', 'procedure'];

    let nameTypeSqlsAll = new Map<string, { type: 'function' | 'procedure'; sql: string }>();
    const schemaDotObjectSqls = matchAllCreate('package\\s+body', sqlNoComment, usersAll);
    for (const { schemaDot, object, sql } of schemaDotObjectSqls) {
      for (const typeFuncProc of typeFuncProcs) {
        for (const { object: objectFuncProc, sql: sqlFuncProc } of matchAllFuncProcInPkg(typeFuncProc, sql)) {
          nameTypeSqlsAll.set(`${schemaDot}${object}.${objectFuncProc}`, { type: typeFuncProc, sql: sqlFuncProc });
        }
      }
    }

    return nameTypeSqlsAll;
  }
  function getNameTypeSqls(
    type: 'function' | 'procedure',
    sqlNoComment: string,
    usersAll: Set<string>
  ): Map<string, { type: 'function' | 'procedure'; sql: string }> {
    const typeFuncProcs: ('function' | 'procedure')[] = ['function', 'procedure'];
    const nameTypeSqls = new Map<string, { type: 'function' | 'procedure'; sql: string }>();
    for (const typeFuncProc of typeFuncProcs) {
      for (const { schemaDot, object, sql } of matchAllCreate(typeFuncProc, sqlNoComment, usersAll)) {
        nameTypeSqls.set(`${schemaDot}${object}`, { type, sql });
      }
    }

    return nameTypeSqls;
  }

  let nameTypeSqlsAll = new Map<string, { type: 'function' | 'procedure'; sql: string }>();

  let path = '';
  switch (objectType) {
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
        const nameTypeSqlsFuncProc = getFuncProcInPkg(sqlNoComment, usersAll);
        nameTypeSqlsAll = new Map<string, { type: 'function' | 'procedure'; sql: string }>([
          ...nameTypeSqlsAll,
          ...nameTypeSqlsFuncProc,
        ]);
      } else {
        const nameTypeSqls = getNameTypeSqls(objectType, sqlNoComment, usersAll);
        nameTypeSqlsAll = new Map<string, { type: 'function' | 'procedure'; sql: string }>([
          ...nameTypeSqlsAll,
          ...nameTypeSqls,
        ]);
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
function getViewObjectsFromDependencies(): ObjectInfo[] {
  const _0_name = 0;
  const _1_objects = 1;
  const _2_tables_other = 2;

  const path = config.path.data.views;
  const fullPaths = statSync(path).isDirectory() ? [...findFiles(path)] : [path];
  let values: string[] = [];
  for (const fullPath of fullPaths) {
    const value = removeCommentLiteralSql(readFileSyncUtf16le(fullPath));
    values = values.concat(value.split(/\r*\n/).filter((v) => !!v));
  }

  const objects: ObjectInfo[] = [];
  for (const row of values) {
    const cols = row.split(/\t/);
    const object = {
      type: 'view' as ObjectType,
      name: cols[_0_name],
      objects: new Set<string>(JSON.parse(cols[_1_objects])),
      tablesInsert: new Set<string>(),
      tablesUpdate: new Set<string>(),
      tablesDelete: new Set<string>(),
      tablesOther: new Set<string>(JSON.parse(cols[_2_tables_other])),
      selectExists: true,
    };
    objects.push(object);
  }

  return objects;
}

function getTablesIudFromSql(usersAll: Set<string>, sql: string, nameForLog: string): IudExistsSchemaDotSql {
  const tablesInsert = new Set<string>();
  const tablesUpdate = new Set<string>();
  const tablesDelete = new Set<string>();
  let selectExists = false;
  const names = new Set<string>();

  const re = /(?<userDot>"?[\w$#]+"?\.)?(?<schemaDot>"?[\w$#]+"?\.)?(?<object>"?[\w$#]+"?)/g;

  let prevType: IudType | 'MERGE' | 'SET' | 'NONE' = 'NONE';

  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    const userDot = m.groups?.userDot?.toUpperCase() || '';
    const schemaDot = m.groups?.schemaDot?.toUpperCase() || '';
    const object = m.groups?.object.toUpperCase() || '';

    let name = '';
    if (userDot && schemaDot && object) {
      const isUser = usersAll.has(trimEnd(userDot, '.'));
      if (!isUser) {
        appendLogOwner(userDot, schemaDot, object, nameForLog, sql);
        // throw new Error(`First part is not user in ${userDot}${schemaDot}${object}, name: ${nameForLog}`);
      }

      name = `${userDot}${schemaDot}${object}`;
    } else if (userDot && object) {
      name = `${userDot}${object}`;
    } else if (object) {
      name = `${object}`;
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
          tablesInsert.add(name);
          break;
        case 'UPDATE':
          tablesUpdate.add(name);
          break;
        case 'DELETE':
          tablesDelete.add(name);
          break;
        case 'MERGE':
          tablesInsert.add(name);
          tablesUpdate.add(name);
          break;
      }
    } else {
      if (!isSqlKeyword(name)) {
        names.add(name);
      }
    }

    prevType = 'NONE';
  }

  return { tablesInsert, tablesUpdate, tablesDelete, selectExists, names, sql };
}

function findTable(tablesAll: Set<string>, tablesAllNoSchema: Set<string>, name: string, nameNoSchema: string): string {
  if (tablesAll.has(name)) return name;

  if (tablesAllNoSchema.has(nameNoSchema)) {
    const tablesFound = [...tablesAll].filter((t) => t.endsWith(`.${nameNoSchema}`));
    if (tablesFound.length === 0) {
      return '';
    } else if (tablesFound.length === 1) {
      return tablesFound[0];
    } else {
      return `${config.defaultOwner}.${nameNoSchema}`;
    }
  }

  return '';
}
function findNameTypeIuds(
  nameTypeIudsAll: Map<string, IudExistsSchemaDotSql2>,
  nameTypeIudsAllNoSchema: Map<string, IudExistsSchemaDotSql2>,
  name: string,
  nameNoSchema: string
): string {
  let typeIud = nameTypeIudsAll.get(name);
  if (typeIud) {
    return name;
  }

  typeIud = nameTypeIudsAllNoSchema.get(nameNoSchema);
  if (typeIud) {
    return typeIud.name;
  }

  return '';
}
function findNameObjects(
  nameObjectsAll: Map<string, ObjectInfo>,
  nameObjectsAllNoSchema: Map<string, ObjectInfo>,
  name: string,
  nameNoSchema: string
): string {
  if (nameObjectsAll.has(name)) return name;

  const objectFound = nameObjectsAllNoSchema.get(nameNoSchema);
  if (objectFound) {
    return objectFound.name;
  }

  return '';
}
function getNameTypeIuds(
  nameTypeIudsAll: Map<string, IudExistsSchemaDotSql2>,
  nameTypeIudsAllNoSchema: Map<string, IudExistsSchemaDotSql2>,
  name: string,
  nameNoSchema: string
): IudExistsSchemaDotSql2 | undefined {
  const nameFound = findNameTypeIuds(nameTypeIudsAll, nameTypeIudsAllNoSchema, name, nameNoSchema);
  if (nameFound) return nameTypeIudsAll.get(nameFound);
  return undefined;
}
function getNameObjects(
  nameObjectsAll: Map<string, ObjectInfo>,
  nameObjectsAllNoSchema: Map<string, ObjectInfo>,
  name: string,
  nameNoSchema: string
): ObjectInfo | undefined {
  const nameFound = findNameObjects(nameObjectsAll, nameObjectsAllNoSchema, name, nameNoSchema);
  if (nameFound) return nameObjectsAll.get(nameFound);
  return undefined;
}
function getTablesIud(
  tables: Set<string>,
  usersAll: Set<string>,
  tablesAll: Set<string>,
  tablesAllNoSchema: Set<string>,
  nameTypeIudsAll: Map<string, IudExistsSchemaDotSql2> | null,
  nameTypeIudsAllNoSchema: Map<string, IudExistsSchemaDotSql2> | null,
  nameObjectsAll: Map<string, ObjectInfo> | null,
  nameObjectsAllNoSchema: Map<string, ObjectInfo> | null,
  typeForLog: ObjectType | 'xml',
  nameForLog: string,
  sqlForLog: string
): Set<string> {
  const tablesNew = new Set<string>();
  for (const name of tables) {
    const nameNoSchema = getNameNoSchema(name);

    const table = findTable(tablesAll, tablesAllNoSchema, name, nameNoSchema);
    if (table) {
      tablesNew.add(table);
      continue;
    }

    let tableFound: string | undefined = '';
    let typeIudSub = undefined;
    if (nameTypeIudsAll && nameTypeIudsAllNoSchema) {
      typeIudSub = getNameTypeIuds(nameTypeIudsAll, nameTypeIudsAllNoSchema, name, nameNoSchema);
      if (!typeIudSub) {
        appendLog('Table or objects not exists in IUD', name, nameForLog, typeForLog, typeIudSub, sqlForLog);
        continue;
      }
      if (typeIudSub.type !== 'view') {
        appendLog('Object is not table or view in IUD', name, nameForLog, typeForLog, typeIudSub, sqlForLog);
        continue;
      }

      const sqlView = typeIudSub.sql;
      const { names, selectExists: selectExistsView } = getTablesIudFromSql(usersAll, sqlView, nameForLog);
      tableFound = [...names].find((nameCur) => {
        const nameNoSchemaCur = getNameNoSchema(nameCur);
        const nameFound = findTable(tablesAll, tablesAllNoSchema, nameCur, nameNoSchemaCur);
        return nameFound;
      });
    } else if (nameObjectsAll && nameObjectsAllNoSchema) {
      const objectsFound = getNameObjects(nameObjectsAll, nameObjectsAllNoSchema, name, nameNoSchema);
      if (!objectsFound) {
        appendLog('Table or objects not exists in IUD', name, nameForLog, typeForLog, undefined, sqlForLog);
        continue;
      }
      if (objectsFound.type !== 'view') {
        appendLog('Object is not table or view in IUD', name, nameForLog, typeForLog, undefined, sqlForLog);
        continue;
      }

      const { tablesOther } = objectsFound;
      tableFound = [...tablesOther].find((nameCur) => {
        const nameNoSchemaCur = getNameNoSchema(nameCur);
        const nameFound = findTable(tablesAll, tablesAllNoSchema, nameCur, nameNoSchemaCur);
        return nameFound;
      });
    }

    if (!tableFound) {
      appendLog('Table not exists inside view', name, nameForLog, typeForLog, typeIudSub, sqlForLog);
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
  tablesAllNoSchema: Set<string>,
  nameTypeIudsAll: Map<string, IudExistsSchemaDotSql2> | null,
  nameTypeIudsAllNoSchema: Map<string, IudExistsSchemaDotSql2> | null,
  nameObjectsAll: Map<string, ObjectInfo> | null,
  nameObjectsAllNoSchema: Map<string, ObjectInfo> | null,
  typeForLog: ObjectType | 'xml',
  nameForLog: string,
  sqlForLog: string
): ObjectChild {
  const { tablesInsert, tablesUpdate, tablesDelete, selectExists, names, sql } = iud;
  // If inserted to view, change to table inside of view
  const tablesInsertNew = getTablesIud(
    tablesInsert,
    usersAll,
    tablesAll,
    tablesAllNoSchema,
    nameTypeIudsAll,
    nameTypeIudsAllNoSchema,
    nameObjectsAll,
    nameObjectsAllNoSchema,
    typeForLog,
    nameForLog,
    sqlForLog
  );
  const tablesUpdateNew = getTablesIud(
    tablesUpdate,
    usersAll,
    tablesAll,
    tablesAllNoSchema,
    nameTypeIudsAll,
    nameTypeIudsAllNoSchema,
    nameObjectsAll,
    nameObjectsAllNoSchema,
    typeForLog,
    nameForLog,
    sqlForLog
  );
  const tablesDeleteNew = getTablesIud(
    tablesDelete,
    usersAll,
    tablesAll,
    tablesAllNoSchema,
    nameTypeIudsAll,
    nameTypeIudsAllNoSchema,
    nameObjectsAll,
    nameObjectsAllNoSchema,
    typeForLog,
    nameForLog,
    sqlForLog
  );

  const tablesOtherNew = new Set<string>();
  const objectsNew = new Set<string>();
  for (const name of names) {
    const nameNoSchema = getNameNoSchema(name);

    const tableNew = findTable(tablesAll, tablesAllNoSchema, name, nameNoSchema);
    if (tableNew) {
      tablesOtherNew.add(tableNew);
      continue;
    }

    if (nameTypeIudsAll && nameTypeIudsAllNoSchema) {
      const objectNew = findNameTypeIuds(nameTypeIudsAll, nameTypeIudsAllNoSchema, name, nameNoSchema);
      if (objectNew) {
        objectsNew.add(objectNew);
        continue;
      }
    } else if (nameObjectsAll && nameObjectsAllNoSchema) {
      const objectNew = findNameObjects(nameObjectsAll, nameObjectsAllNoSchema, name, nameNoSchema);
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

    const value = removeCommentLiteralSql(readFileSyncUtf16le(fullPath));
    values = values.concat(value.split(/\r*\n/));

    const users = new Set(values.filter((v) => !!v).map((v) => v.toUpperCase()));
    usersAll = new Set([...usersAll, ...users]);
  }
  if (!usersAll.size) return usersAll;

  tCache.insertUsers(path, usersAll);

  return usersAll;
}

export function insertTablesToDb(): { tables: Set<string>; tablesNoSchema: Set<string> } {
  let tablesAll = new Set<string>();
  let tablesAllNoSchema = new Set<string>();

  const path = config.path.data.tables;

  const fullPaths = statSync(path).isDirectory() ? [...findFiles(path)] : [path];
  for (const fullPath of fullPaths) {
    let values: string[] = [];

    const value = removeCommentLiteralSql(readFileSyncUtf16le(fullPath));
    values = values.concat(value.split(/\r*\n/));

    const tables = new Set(values.filter((v) => !!v).map((v) => v.toUpperCase()));
    const tablesNoSchema = new Set(values.filter((v) => !!v).map((v) => getNameNoSchema(v.toUpperCase())));
    tablesAll = new Set([...tablesAll, ...tables]);
    tablesAllNoSchema = new Set([...tablesAllNoSchema, ...tablesNoSchema]);
  }
  if (!tablesAll.size) return { tables: new Set<string>(), tablesNoSchema: new Set<string>() };

  tCache.insertTables(path, tablesAll);

  return { tables: tablesAll, tablesNoSchema: tablesAllNoSchema };
}

export function insertObjects(
  usersAll: Set<string>,
  tablesAll: Set<string>,
  tablesAllNoSchema: Set<string>
): { nameObjects: Map<string, ObjectInfo>; nameObjectsNoSchema: Map<string, ObjectInfo> } {
  let nameTypeSqlsAll = new Map<string, { type: ObjectType; sql: string }>();
  const objectTypes: ('function' | 'procedure' | 'package')[] = ['function', 'procedure', 'package'];
  for (const objectType of objectTypes) {
    const nameTypeSqls = getObjectNameTypeSqls(objectType, usersAll);
    nameTypeSqlsAll = new Map<string, { type: ObjectType; sql: string }>([...nameTypeSqlsAll, ...nameTypeSqls]);
  }

  const nameTypeIudsAll = new Map<string, IudExistsSchemaDotSql2>();
  const nameTypeIudsAllNoSchema = new Map<string, IudExistsSchemaDotSql2>();
  for (const [name, { type, sql }] of nameTypeSqlsAll) {
    const iud = getTablesIudFromSql(usersAll, sql, name);
    nameTypeIudsAll.set(name, { type, name, ...iud });
    const nameNoSchema = getNameNoSchema(name);
    nameTypeIudsAllNoSchema.set(nameNoSchema, { type, name, ...iud });
  }

  let objects: ObjectInfo[] = [];

  const objectsView = getViewObjectsFromDependencies();
  objects = objects.concat(objectsView);

  for (const [name, iud] of nameTypeIudsAll) {
    const { type, sql } = iud;

    const objectChild = getObjectChild(
      iud,
      usersAll,
      tablesAll,
      tablesAllNoSchema,
      nameTypeIudsAll,
      nameTypeIudsAllNoSchema,
      null,
      null,
      type,
      name,
      sql
    );
    const object = { type, name, ...objectChild };
    objects.push(object);
  }

  const nameObjects = new Map<string, ObjectInfo>();
  const nameObjectsNoSchema = new Map<string, ObjectInfo>();
  for (const object of objects) {
    const { name } = object;
    const nameNoSchema = getNameNoSchema(name);

    nameObjects.set(name, object);
    nameObjectsNoSchema.set(nameNoSchema, object);
  }

  if (objects.length) {
    tCache.insertObjects(configReader.objectTypeAndPath(), objects);
  }

  return { nameObjects, nameObjectsNoSchema };
}

export function insertXmlInfoXmlNodeInfo(
  rootDir: string,
  fullPath: string,
  usersAll: Set<string>,
  tablesAll: Set<string>,
  tablesAllNoSchema: Set<string>,
  nameObjectsAll: Map<string, ObjectInfo>,
  nameObjectsAllNoSchema: Map<string, ObjectInfo>
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

    const iud = getTablesIudFromSql(usersAll, sql, id);
    const { objects, tablesInsert, tablesUpdate, tablesDelete, tablesOther, selectExists } = getObjectChild(
      iud,
      usersAll,
      tablesAll,
      tablesAllNoSchema,
      null,
      null,
      nameObjectsAll,
      nameObjectsAllNoSchema,
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
