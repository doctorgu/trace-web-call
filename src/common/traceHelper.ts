import { existsSync, statSync } from 'fs';
import { resolve } from 'path';
import { findFiles } from './util';
import {
  MethodInfo,
  MethodInfoFind,
  getFindsByClassPathClassNameFromDb,
  ClassInfo,
  CallerInfo,
  rowsToFinds,
} from './classHelper';
import { XmlNodeInfoFind, getXmlInfo, ObjectAndTables } from './sqlHelper';
import { config } from '../config/config';
import { configReader } from '../config/configReader';
import { StartingPoint } from '../config/configTypes';
import tClassInfo from '../sqlTemplate/TClassInfo';
import tTables from '../sqlTemplate/TTables';
import tXmlInfo from '../sqlTemplate/TXmlInfo';

export type RouteType = 'mapping' | 'method' | 'xml' | 'table' | 'view' | 'function' | 'procedure';
export type RouteInfo<RouteType> = {
  groupSeq?: number; // Only used for inserting to table
  seq: number;
  depth: number;
  routeType: RouteType;
  valueMapping?: RouteType extends 'mapping' ? string[] : [];
  valueMethod?: RouteType extends 'method' ? string : '';
  valueXml?: RouteType extends 'xml' ? string : '';
  valueTable?: RouteType extends 'table' ? Set<string> : null;
  valueView?: RouteType extends 'view' ? { object: string; tables: Set<string> } : {};
  valueFunction?: RouteType extends 'function' ? { object: string; tables: Set<string> } : {};
  valueProcedure?: RouteType extends 'procedure' ? { object: string; tables: Set<string> } : {};
};

type StartToObjects = {
  mappingOrMethod: string;
  tables: Set<string>;
  objectAndTables: ObjectAndTables;
  routes: RouteInfo<RouteType>[];
};

function getBaseMethods(classInfos: ClassInfo[], extendsNameSub: string): MethodInfo[] {
  let methodsBaseAll: MethodInfo[] = [];

  const classBases = classInfos.filter(({ header: { name: className } }) => className === extendsNameSub);
  if (!classBases.length) {
    console.warn(`Base class: ${extendsNameSub} not exists.`);
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

export function getXmlNodeInfoFinds(
  rootDir: string,
  directory: string,
  filePattern: string | RegExp
): XmlNodeInfoFind[] {
  const fullDir = resolve(rootDir, directory);
  if (!existsSync(fullDir)) {
    return [];
  }

  let finds: XmlNodeInfoFind[] = [];

  const tablesAll = configReader.tables();

  const objectAndTablesAll = new Map<string, Set<string>>();
  configReader.objectAndTables('view').forEach((tables, object) => objectAndTablesAll.set(object, tables));
  configReader.objectAndTables('function').forEach((tables, object) => objectAndTablesAll.set(object, tables));
  configReader.objectAndTables('procedure').forEach((tables, object) => objectAndTablesAll.set(object, tables));

  const fullPaths = statSync(fullDir).isDirectory() ? [...findFiles(fullDir, filePattern)] : [fullDir];
  for (const fullPath of fullPaths) {
    const xmlInfo = getXmlInfo(rootDir, fullPath, tablesAll, objectAndTablesAll);
    if (!xmlInfo) continue;

    const { xmlPath, namespace, nodes } = xmlInfo;
    const findsCur: XmlNodeInfoFind[] = nodes.map(({ id, tagName, params, tables, objectAndTables }) => ({
      xmlPath,
      namespaceId: namespace ? `${namespace}.${id}` : id,
      id,
      tagName,
      params,
      tables,
      objectAndTables,
    }));
    finds = finds.concat(findsCur);
  }

  return finds;
}

function getObjectByStringLiteral(
  keyName: string,
  directoriesXml: string[],
  stringLiteral: string
): { tables: Set<string>; objectAndTables: ObjectAndTables } | null {
  // User.updateInfo
  // User.UserDao.updateInfo

  const row = tXmlInfo.selectXmlNodeInfoFindByNamespaceId(keyName, directoriesXml, stringLiteral);
  if (!row) {
    return null;
  }

  const { tables, objectAndTables } = row;

  const tables2 = new Set<string>(JSON.parse(tables));

  const objectAndTables2 = JSON.parse(objectAndTables) as [string, string[]][];
  const objectAndTables3 = new Map<string, Set<string>>(
    objectAndTables2.map(([object, tables]) => [object, new Set<string>(tables)])
  );

  return { tables: tables2, objectAndTables: objectAndTables3 };
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

  // const founds = findsAll.filter(
  //   ({ className, implementsName, name, parameterCount }) =>
  //     (typeName ? className === typeName || implementsName === typeName : className === classNameThis) &&
  //     name === methodName &&
  //     parameterCount === callerParameterCount
  // );
  // return founds;
}

export function getTableNamesByMethod(
  keyName: string,
  find: MethodInfoFind,
  directories: string[],
  directoriesXml: string[],
  routes: RouteInfo<RouteType>[],
  depth: number
): { tables: Set<string>; objectAndTables: ObjectAndTables } {
  let tablesRet: string[] = [];
  let objectAndTablesRet: ObjectAndTables = new Map<string, Set<string>>();

  const { className: classNameThis, name: nameThis, callers } = find;
  for (let i = 0; i < callers.length; i++) {
    const { typeName, instanceName, methodName, parameterCount: callerParameterCount, stringLiteral } = callers[i];
    if (stringLiteral) {
      const ret = getObjectByStringLiteral(keyName, directoriesXml, stringLiteral);
      if (ret) {
        const { tables, objectAndTables } = ret;

        const routeXml: RouteInfo<'xml'> = {
          seq: routes.length,
          depth: depth,
          routeType: 'xml',
          valueXml: stringLiteral,
        };
        routes.push(routeXml);

        const routeTable: RouteInfo<'table'> = {
          seq: routes.length,
          depth: depth + 1,
          routeType: 'table',
          valueTable: tables,
        };
        routes.push(routeTable);

        if (objectAndTables.size) {
          for (const [object, tables] of objectAndTables) {
            const objectType = configReader.objectType(object);
            switch (objectType) {
              case 'view':
                const routeView: RouteInfo<'view'> = {
                  seq: routes.length,
                  depth: depth + 1,
                  routeType: objectType,
                  valueView: { object, tables },
                };
                routes.push(routeView);
                break;
              case 'function':
                const routeFunction: RouteInfo<'function'> = {
                  seq: routes.length,
                  depth: depth + 1,
                  routeType: objectType,
                  valueFunction: { object, tables },
                };
                routes.push(routeFunction);
                break;
              case 'procedure':
                const routeProcedure: RouteInfo<'procedure'> = {
                  seq: routes.length,
                  depth: depth + 1,
                  routeType: objectType,
                  valueProcedure: { object, tables },
                };
                routes.push(routeProcedure);
                break;
            }
          }
        }

        tablesRet = tablesRet.concat([...tables]);
        objectAndTables.forEach((tables, object) => {
          objectAndTablesRet.set(object, tables);
          tablesRet = tablesRet.concat([...tables]);
        });
        continue;
      }
    }

    const founds = findByTypeMethod(keyName, directories, typeName, classNameThis, methodName, callerParameterCount);
    // const founds = methodsAll.filter(({ className, implementsName, extendsName, name, parameterCount }) => {
    //   const classFound = typeName ? className === typeName || implementsName === typeName : className === classNameThis;
    //   if (!classFound) return false;

    //   const methodFound = name === methodName && parameterCount === callerParameterCount;
    //   if (!methodFound) return false;
    // });

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

        const routeMethod: RouteInfo<'method'> = {
          seq: routes.length,
          depth: depth,
          routeType: 'method',
          valueMethod: value,
        };
        routes.push(routeMethod);

        const ret = getTableNamesByMethod(keyName, found, directories, directoriesXml, routes, depth + 1);
        if (ret) {
          const { tables, objectAndTables } = ret;
          tablesRet = tablesRet.concat([...tables]);
          objectAndTables.forEach((tables, object) => objectAndTablesRet.set(object, tables));
          continue;
        }
      }
    }
  }

  return { tables: new Set(tablesRet), objectAndTables: objectAndTablesRet };
}

// export function getDependency(): { directories: string[]; xmls: XmlNodeInfoFind[] } {
//   const directories: string[] = [];
//   let xmls: XmlNodeInfoFind[] = [];

//   const { rootDir } = config.path.source;
//   for (let i = 0; i < config.path.source.dependency.length; i++) {
//     const {
//       service: { directory },
//       xml,
//     } = config.path.source.dependency[i];

//     directories.push(directory);

//     const xmlsCur = getXmlNodeInfoFinds(rootDir, xml, '*.xml');
//     xmls = xmls.concat(xmlsCur);
//   }

//   return { directories, xmls };
// }

export function getStartingToTables(
  keyName: string,
  findsStarting: MethodInfoFind[],
  directories: string[],
  directoriesXml: string[],
  startingPoint: StartingPoint
): StartToObjects[] {
  const startToObjects: StartToObjects[] = [];

  for (let nMethod = 0; nMethod < findsStarting.length; nMethod++) {
    const methodInStartings = findsStarting[nMethod];
    const { className, mappingValues, isPublic: methodIsPublic, name: methodName } = methodInStartings;
    if (startingPoint === 'map' && !mappingValues.length) continue;
    if (startingPoint === 'publicMethod' && !methodIsPublic) continue;

    const routes: RouteInfo<RouteType>[] = [];

    if (startingPoint === 'map') {
      let depth = -1;
      const routeMapping: RouteInfo<'mapping'> = {
        seq: routes.length,
        depth: ++depth,
        routeType: 'mapping',
        valueMapping: mappingValues,
      };
      routes.push(routeMapping);

      const classDotMethod = `${className}.${methodName}`;
      const routeMethod: RouteInfo<'method'> = {
        seq: routes.length,
        depth: ++depth,
        routeType: 'method',
        valueMethod: classDotMethod,
      };
      routes.push(routeMethod);

      const { tables, objectAndTables } = getTableNamesByMethod(
        keyName,
        methodInStartings,
        directories,
        directoriesXml,
        routes,
        depth + 1
      );
      startToObjects.push({ mappingOrMethod: mappingValues.join(','), tables, objectAndTables, routes });
    } else if (startingPoint === 'publicMethod') {
      const classDotMethod = `${className}.${methodName}`;
      let depth = -1;
      const routeMethod: RouteInfo<'method'> = {
        seq: routes.length,
        depth: ++depth,
        routeType: 'method',
        valueMethod: classDotMethod,
      };
      routes.push(routeMethod);

      const { tables, objectAndTables } = getTableNamesByMethod(
        keyName,
        methodInStartings,
        directories,
        directoriesXml,
        routes,
        depth + 1
      );
      startToObjects.push({
        mappingOrMethod: classDotMethod,
        tables,
        objectAndTables,
        routes,
      });
    }
  }

  return startToObjects;
}
