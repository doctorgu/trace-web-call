import { existsSync, statSync } from 'fs';
import { resolve } from 'path';
import { findFiles, getLastPath, trimEnd, trimStart, trimStarts } from './util';
import {
  MethodInfo,
  MethodInfoFind,
  getFindsByClassPathClassNameFromDb,
  ClassInfo,
  CallerInfo,
  rowsToFinds,
} from './classHelper';
import { XmlNodeInfoFind, getXmlInfoFromDb, ObjectInfo, ObjectChild, ObjectType } from './batisHelper';
import { config } from '../config/config';
import { configReader } from '../config/configReader';
import { StartingPoint } from '../config/ConfigType';
import tClassInfo from '../sqlTemplate/TClassInfo';
import tCache from '../sqlTemplate/TCache';
import tXmlInfo from '../sqlTemplate/TXmlInfo';
import { filterJspFromJsp, getJspInfoFromDb, JspInfo, viewNameToJspPath } from './jspHelper';
import { getDbPath } from './common';

export type RouteTypeTable = 'mapping' | 'method' | 'xml' | 'view' | 'function' | 'procedure';
export type RouteTable<RouteType> = {
  groupSeq?: number; // Only used for inserting to table
  seq: number;
  depth: number;
  routeType: RouteType;
  valueMapping?: RouteType extends 'mapping' ? string[] : [];
  valueMethod?: RouteType extends 'method' ? string : '';
  valueXml?: RouteType extends 'xml' ? string : '';
  valueView?: RouteType extends 'view' ? string : '';
  valueFunction?: RouteType extends 'function' ? string : '';
  valueProcedure?: RouteType extends 'procedure' ? string : '';

  objects?: RouteType extends 'xml' | 'view' | 'function' | 'procedure' ? Set<string> : null;
  tablesInsert?: RouteType extends 'xml' | 'view' | 'function' | 'procedure' ? Set<string> : null;
  tablesUpdate?: RouteType extends 'xml' | 'view' | 'function' | 'procedure' ? Set<string> : null;
  tablesDelete?: RouteType extends 'xml' | 'view' | 'function' | 'procedure' ? Set<string> : null;
  tablesOther?: RouteType extends 'xml' | 'view' | 'function' | 'procedure' ? Set<string> : null;
  selectExists?: RouteType extends 'xml' | 'view' | 'function' | 'procedure' ? boolean : null;
};

export type RouteTypeJsp = 'mapping' | 'method' | 'jsp';
export type RouteJsp<RouteType> = {
  groupSeq?: number; // Only used for inserting to table
  seq: number;
  depth: number;
  routeType: RouteType;
  valueMapping?: RouteType extends 'mapping' ? string[] : [];
  valueMethod?: RouteType extends 'method' ? string : '';
  valueJsp?: RouteType extends 'jsp' ? Set<string> : '';
};

function getBaseMethods(classInfos: ClassInfo[], extendsNameSub: string): MethodInfo[] {
  let methodsBaseAll: MethodInfo[] = [];

  const classBases = classInfos.filter(({ header: { name: className } }) => className === extendsNameSub);
  if (!classBases.length) {
    // console.warn(`Base class: ${extendsNameSub} not exists.`);
    return [];
  }

  for (const classBase of classBases) {
    const { extendsName } = classBase.header;

    if (extendsName) {
      const methodsBaseCur = getBaseMethods(classInfos, extendsName);
      methodsBaseAll = methodsBaseAll.concat(methodsBaseCur);
    }

    methodsBaseAll = methodsBaseAll.concat(classBase.methods);
  }

  return methodsBaseAll;
}
export function mergeExtends(classInfos: ClassInfo[]): ClassInfo[] {
  let classInfosNew = [...classInfos];

  const classInfosExtends = classInfosNew.filter(({ header: { extendsName } }) => !!extendsName);
  for (const {
    header: { extendsName: extendsNameSub },
    methods,
  } of classInfosExtends) {
    const methodsBase = getBaseMethods(classInfos, extendsNameSub);
    methodsBase.forEach((method) => methods.push(method));
  }

  return classInfosNew;
}

export function rowToObjectChild(row: { [key: string]: any }): ObjectChild {
  const objects = new Set<string>(JSON.parse(row.objects) as string[]);
  const tablesInsert = new Set<string>(JSON.parse(row.tablesInsert) as string[]);
  const tablesUpdate = new Set<string>(JSON.parse(row.tablesUpdate) as string[]);
  const tablesDelete = new Set<string>(JSON.parse(row.tablesDelete) as string[]);
  const tablesOther = new Set<string>(JSON.parse(row.tablesOther) as string[]);
  const selectExists = row.selectExists == 1;

  return {
    objects,
    tablesInsert,
    tablesUpdate,
    tablesDelete,
    tablesOther,
    selectExists,
  };
}
export function rowToObjectInfo(row: { [key: string]: any }): ObjectInfo {
  const { objects, tablesInsert, tablesUpdate, tablesDelete, tablesOther, selectExists } = rowToObjectChild(row);
  const type = row.type as ObjectType;
  const name = row.name as string;

  return {
    type,
    name,
    objects,
    tablesInsert,
    tablesUpdate,
    tablesDelete,
    tablesOther,
    selectExists,
  };
}

function getObjectByStringLiteral(
  keyName: string,
  directoriesXml: string[],
  stringLiteral: string,
  routes: RouteTable<RouteTypeTable>[],
  depth: number
): boolean {
  // User.updateInfo
  // User.UserDao.updateInfo

  const row = tXmlInfo.selectXmlNodeInfoFindByNamespaceId(keyName, directoriesXml, stringLiteral);
  if (!row) {
    return false;
  }

  const { objects, tablesInsert, tablesUpdate, tablesDelete, tablesOther, selectExists } = rowToObjectChild(row);
  const routeXml: RouteTable<'xml'> = {
    seq: routes.length,
    depth,
    routeType: 'xml',
    valueXml: stringLiteral,
    objects,
    tablesInsert,
    tablesUpdate,
    tablesDelete,
    tablesOther,
    selectExists,
  };
  routes.push(routeXml);

  const typeAndPath = configReader.objectTypeAndPath();
  const rowsObj = tCache.selectObjectsDeep(typeAndPath, objects);
  for (const rowObj of rowsObj) {
    const { type, name, objects, tablesInsert, tablesUpdate, tablesDelete, tablesOther, selectExists } =
      rowToObjectInfo(rowObj);
    const depthCur = rowObj.depth as number;

    switch (type) {
      case 'view':
        const routeView: RouteTable<'view'> = {
          seq: routes.length,
          depth: depth + depthCur + 1,
          routeType: type,
          valueView: name,
          objects,
          tablesInsert,
          tablesUpdate,
          tablesDelete,
          tablesOther,
          selectExists,
        };
        routes.push(routeView);
        break;
      case 'function':
        const routeFunction: RouteTable<'function'> = {
          seq: routes.length,
          depth: depth + depthCur + 1,
          routeType: type,
          valueFunction: name,
          objects,
          tablesInsert,
          tablesUpdate,
          tablesDelete,
          tablesOther,
          selectExists,
        };
        routes.push(routeFunction);
        break;
      case 'procedure':
        const routeProcedure: RouteTable<'procedure'> = {
          seq: routes.length,
          depth: depth + depthCur + 1,
          routeType: type,
          valueProcedure: name,
          objects,
          tablesInsert,
          tablesUpdate,
          tablesDelete,
          tablesOther,
          selectExists,
        };
        routes.push(routeProcedure);
        break;
    }
  }

  return true;
}

function findByTypeMethod(
  keyName: string,
  directories: string[],
  typeName: string,
  classNameThis: string,
  methodName: string,
  callerParameterCount: number
): MethodInfoFind[] {
  const rows = tClassInfo.selectMethodInfoFindByNameParameterCount(
    keyName,
    methodName,
    callerParameterCount,
    directories,
    typeName,
    classNameThis
  );
  const finds = rowsToFinds(rows);
  return finds;
}

export function getTableNamesByMethod(
  keyName: string,
  find: MethodInfoFind,
  directories: string[],
  directoriesXml: string[],
  routes: RouteTable<RouteTypeTable>[],
  depth: number
): void {
  const { className: classNameThis, name: nameThis, callers } = find;
  for (let i = 0; i < callers.length; i++) {
    const { typeName, instanceName, methodName, parameterCount: callerParameterCount, stringLiteral } = callers[i];
    if (stringLiteral) {
      const ret = getObjectByStringLiteral(keyName, directoriesXml, stringLiteral, routes, depth);
      if (ret) {
        continue;
      }
    }

    const founds = findByTypeMethod(keyName, directories, typeName, classNameThis, methodName, callerParameterCount);
    for (let nFound = 0; nFound < founds.length; nFound++) {
      const found = founds[nFound];
      if (found) {
        const value = `${typeName ? `${typeName}.` : ''}${methodName}(${callerParameterCount})`;
        // to prevent duplicated search
        const foundPrev = routes.some(
          ({ routeType: routeTypePrev, valueMethod: valueMethodPrev, depth: depthPrev }) =>
            routeTypePrev === 'method' && valueMethodPrev === value && depthPrev <= depth
        );
        if (foundPrev) continue;

        const routeMethod: RouteTable<'method'> = {
          seq: routes.length,
          depth,
          routeType: 'method',
          valueMethod: value,
        };
        routes.push(routeMethod);

        getTableNamesByMethod(keyName, found, directories, directoriesXml, routes, depth + 1);
      }
    }
  }
}

export function getStartingToObjects(
  keyName: string,
  findsStarting: MethodInfoFind[],
  directories: string[],
  directoriesXml: string[],
  startingPoint: StartingPoint
): RouteTable<RouteTypeTable>[][] {
  const routesAll: RouteTable<RouteTypeTable>[][] = [];
  for (let nMethod = 0; nMethod < findsStarting.length; nMethod++) {
    const methodInStartings = findsStarting[nMethod];
    const { className, mappingValues, isPublic: methodIsPublic, name: methodName } = methodInStartings;
    if (startingPoint === 'map' && !mappingValues.length) continue;
    if (startingPoint === 'publicMethod' && !methodIsPublic) continue;

    const routes: RouteTable<RouteTypeTable>[] = [];

    if (startingPoint === 'map') {
      let depth = -1;
      const routeMapping: RouteTable<'mapping'> = {
        seq: routes.length,
        depth: ++depth,
        routeType: 'mapping',
        valueMapping: mappingValues,
      };
      routes.push(routeMapping);

      const classDotMethod = `${className}.${methodName}`;
      const routeMethod: RouteTable<'method'> = {
        seq: routes.length,
        depth: ++depth,
        routeType: 'method',
        valueMethod: classDotMethod,
      };
      routes.push(routeMethod);

      getTableNamesByMethod(keyName, methodInStartings, directories, directoriesXml, routes, depth + 1);
      routesAll.push(routes);
    } else if (startingPoint === 'publicMethod') {
      const classDotMethod = `${className}.${methodName}`;
      let depth = -1;
      const routeMethod: RouteTable<'method'> = {
        seq: routes.length,
        depth: ++depth,
        routeType: 'method',
        valueMethod: classDotMethod,
      };
      routes.push(routeMethod);

      getTableNamesByMethod(keyName, methodInStartings, directories, directoriesXml, routes, depth + 1);
      routesAll.push(routes);
    }
  }

  return routesAll;
}

function getJspPathsByJspPath(
  jspInfos: JspInfo[],
  jspPath: string,
  depth: number,
  routes: RouteJsp<RouteTypeJsp>[]
): void {
  const includes = filterJspFromJsp(jspInfos, jspPath);
  if (includes.size) {
    for (const include of includes) {
      const routeJsp: RouteJsp<'jsp'> = {
        seq: routes.length,
        depth,
        routeType: 'jsp',
        valueJsp: new Set<string>([include]),
      };
      routes.push(routeJsp);

      const jspPaths = getJspPathsByJspPath(jspInfos, include, depth + 1, routes);
    }
  }
}

export function getJspsByMethod(
  jspInfos: JspInfo[],
  jspDirectory: string,
  find: MethodInfoFind,
  routes: RouteJsp<RouteTypeJsp>[],
  depth: number
): void {
  const jspRoot = getLastPath(jspDirectory);

  const { jspViewFinds } = find;
  for (let i = 0; i < jspViewFinds.length; i++) {
    const { name, parsed, exists } = jspViewFinds[i];
    if (!parsed || !exists) continue;

    const jspPath = viewNameToJspPath(jspRoot, name);

    const routeJsp: RouteJsp<'jsp'> = {
      seq: routes.length,
      depth,
      routeType: 'jsp',
      valueJsp: new Set<string>([jspPath]),
    };
    routes.push(routeJsp);

    getJspPathsByJspPath(jspInfos, jspPath, depth + 1, routes);
  }
}

export function getStartingToJsps(
  findsStarting: MethodInfoFind[],
  jspDirectory: string,
  startingPoint: StartingPoint
): RouteTable<RouteTypeJsp>[][] {
  const jspInfos = getJspInfoFromDb();

  const routesAll: RouteTable<RouteTypeJsp>[][] = [];
  for (let nMethod = 0; nMethod < findsStarting.length; nMethod++) {
    const methodInStartings = findsStarting[nMethod];
    const { className, mappingValues, isPublic: methodIsPublic, name: methodName } = methodInStartings;
    if (startingPoint === 'map' && !mappingValues.length) continue;
    if (startingPoint === 'publicMethod' && !methodIsPublic) continue;

    const routes: RouteJsp<RouteTypeJsp>[] = [];

    if (startingPoint === 'map') {
      let depth = -1;
      const routeMapping: RouteJsp<'mapping'> = {
        seq: routes.length,
        depth: ++depth,
        routeType: 'mapping',
        valueMapping: mappingValues,
      };
      routes.push(routeMapping);

      const classDotMethod = `${className}.${methodName}`;
      const routeMethod: RouteJsp<'method'> = {
        seq: routes.length,
        depth: ++depth,
        routeType: 'method',
        valueMethod: classDotMethod,
      };
      routes.push(routeMethod);

      if (jspDirectory) {
        getJspsByMethod(jspInfos, jspDirectory, methodInStartings, routes, depth + 1);
        routesAll.push(routes);
      }
    } else if (startingPoint === 'publicMethod') {
      const classDotMethod = `${className}.${methodName}`;
      let depth = -1;
      const routeMethod: RouteJsp<'method'> = {
        seq: routes.length,
        depth: ++depth,
        routeType: 'method',
        valueMethod: classDotMethod,
      };
      routes.push(routeMethod);

      if (jspDirectory) {
        getJspsByMethod(jspInfos, jspDirectory, methodInStartings, routes, depth + 1);
        routesAll.push(routes);
      }
    }
  }

  return routesAll;
}
