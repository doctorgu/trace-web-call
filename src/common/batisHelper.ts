import { format } from 'date-fns';
import { Element } from 'xml-js';
import { isSqlKeyword, trimEnd } from './util';
import { appendFileSync } from 'fs';
import { resolve } from 'path';
import { config } from '../config/config';

export type ObjectType = 'table' | 'view' | 'function' | 'procedure';
export type IudType = 'INSERT' | 'UPDATE' | 'DELETE';

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

// function appendLog(
//   prepend: string,
//   schemaDotObject: string,
//   name: string,
//   type: ObjectType | 'xml',
//   typeIudSub: IudExistsSchemaDotSql2 | undefined,
//   sql: string
// ) {
//   const dateTime = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
//   const body = `schemaDotObject: ${schemaDotObject}, name: ${name}, type: ${type}, typeSub: ${typeIudSub?.type},
// sql: ${sql}`;
//   const log = `==================================================
// ${dateTime} ${prepend} ${body}

// `;
//   appendFileSync(resolve(config.path.logDirectory, 'getObjectChild.log'), log);
//   // console.log(log);
// }

function appendLogOwner(userDot: string, schemaDot: string, object: string, name: string, sql: string) {
  const dateTime = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
  const yyyyMMdd = format(new Date(), 'yyyyMMdd');
  const body = `userDot: ${userDot}, schemaDot: ${schemaDot}, object: ${object},
sql: ${sql}`;
  const log = `==================================================
${dateTime} ${name} ${body}

`;
  appendFileSync(resolve(config.path.logDirectory, `${yyyyMMdd}owner.log`), log);
  // console.log(log);
}

export function getNameNoSchema(name: string): string {
  const names = name.split('.');
  if (names.length > 1) {
    return names.filter((v, i) => i > 0).join('.');
  }
  return name;
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

export function findNameObjects(
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

export function getTextCdataFromElement(elem: Element): string {
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

export function getTextInclude(parent: Element, elemRows: Element[]): string {
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

export function getTablesIudFromSql(usersAll: Set<string>, sql: string, nameForLog: string): IudExistsSchemaDotSql {
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
        // appendLog('Table or objects not exists in IUD', name, nameForLog, typeForLog, typeIudSub, sqlForLog);
        continue;
      }
      if (typeIudSub.type !== 'view') {
        // appendLog('Object is not table or view in IUD', name, nameForLog, typeForLog, typeIudSub, sqlForLog);
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
        // appendLog('Table or objects not exists in IUD', name, nameForLog, typeForLog, undefined, sqlForLog);
        continue;
      }
      if (objectsFound.type !== 'view') {
        // appendLog('Object is not table or view in IUD', name, nameForLog, typeForLog, undefined, sqlForLog);
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
      // appendLog('Table not exists inside view', name, nameForLog, typeForLog, typeIudSub, sqlForLog);
      continue;
    }

    tablesNew.add(tableFound);
  }

  return tablesNew;
}

export function getObjectChild(
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
