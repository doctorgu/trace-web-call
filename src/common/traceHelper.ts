import { existsSync, statSync } from 'fs';
import { resolve } from 'path';
import { findFiles } from './util';
import {
  MethodInfo,
  MethodInfoFind,
  getMethodInfoFindsFromDb,
  ClassInfo,
  CallerInfo,
  rowsToFinds,
} from './classHelper';
import { XmlNodeInfoFind, getXmlInfo, ObjectAndTables } from './sqlHelper';
import { config, configReader } from '../config/config';
import { StartingPoint } from '../config/configTypes';
import { all } from './dbHelper';

export type RouteInfo = {
  routeType: 'mapping' | 'method' | 'xml' | 'table' | 'view' | 'function' | 'procedure';
  value: string;
  depth: number;
};

type StartToObjects = {
  mappingOrMethod: string;
  tables: Set<string>;
  objectAndTables: ObjectAndTables;
  routes: RouteInfo[];
};

function getBaseMethods(classInfos: ClassInfo[], extendsNameSub: string): MethodInfo[] {
  let methodsBaseAll: MethodInfo[] = [];

  const classBases = classInfos.filter(({ header: { name: className } }) => className === extendsNameSub);
  if (!classBases.length) {
    console.error(`Base class: ${extendsNameSub} not exists.`);
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
  [...configReader.objectAndTables('view')].forEach(([object, tables]) => objectAndTablesAll.set(object, tables));
  [...configReader.objectAndTables('function')].forEach(([object, tables]) => objectAndTablesAll.set(object, tables));
  [...configReader.objectAndTables('procedure')].forEach(([object, tables]) => objectAndTablesAll.set(object, tables));

  const fullPaths = statSync(fullDir).isDirectory() ? [...findFiles(fullDir, filePattern)] : [fullDir];
  for (const fullPath of fullPaths) {
    const xmlInfo = getXmlInfo(rootDir, fullPath, tablesAll, objectAndTablesAll);
    if (!xmlInfo) continue;

    const { namespace, nodes } = xmlInfo;
    const findsCur = nodes.map(({ id, tagName, params, tables, objectAndTables }) => ({
      namespace,
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
  xmlsAll: XmlNodeInfoFind[],
  stringLiteral: string
): { tables: Set<string>; objectAndTables: ObjectAndTables } | null {
  // User.updateInfo
  // User.UserDao.updateInfo
  const literals = stringLiteral.split('.');
  const first = literals[0];
  const rest = literals.filter((v, i) => i >= 1).join('.');

  const nodeInfoFind = xmlsAll.find(
    ({ namespace, id }) => (namespace === first && id === rest) || id === stringLiteral
  );
  if (!nodeInfoFind) return null;

  const { tables, objectAndTables } = nodeInfoFind;
  return { tables, objectAndTables };
}

// function findByTypeMethod(
//   methodsAll: MethodInfoFind[],
//   typeName: string,
//   classNameThis: string,
//   methodName: string,
//   callerParameterCount: number
// ): MethodInfoFind[] {
//   const foundsClass = methodsAll.filter(({ className, implementsName }) =>
//     typeName ? className === typeName || implementsName === typeName : className === classNameThis
//   );
//   if (!foundsClass.length) {
//     return [];
//   }

//   const foundsMethod = foundsClass.filter(
//     ({ name, parameterCount }) => name === methodName && parameterCount === callerParameterCount
//   );
//   if (!foundsMethod.length) {
//     const { extendsName } = foundsClass[0];
//     return findByTypeMethod(methodsAll, extendsName, '', methodName, callerParameterCount);
//   }

//   return foundsMethod;
// }
function findByTypeMethod(
  filePostfix: string,
  directories: string[],
  typeName: string,
  classNameThis: string,
  methodName: string,
  callerParameterCount: number
): MethodInfoFind[] {
  const db = configReader.db();
  const rows = all(db, 'ClassInfo', 'selectMethodInfoFindByNameParameterCount', {
    filePostfix,
    classPathsLike: directories,
    typeName,
    classNameThis,
    methodName,
    callerParameterCount,
  });
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
  filePostfix: string,
  find: MethodInfoFind,
  directories: string[],
  xmlsAll: XmlNodeInfoFind[],
  routes: RouteInfo[],
  depth: number
): { tables: Set<string>; objectAndTables: ObjectAndTables } {
  let tablesRet: string[] = [];
  let objectAndTablesRet: ObjectAndTables = new Map<string, Set<string>>();

  const { className: classNameThis, name: nameThis, callers } = find;
  for (let i = 0; i < callers.length; i++) {
    const { typeName, instanceName, methodName, parameterCount: callerParameterCount, stringLiteral } = callers[i];
    if (stringLiteral) {
      const ret = getObjectByStringLiteral(xmlsAll, stringLiteral);
      if (ret) {
        const { tables, objectAndTables } = ret;

        routes.push({ routeType: 'xml', value: stringLiteral, depth: depth });

        routes.push({ routeType: 'table', value: [...tables].join(','), depth: depth + 1 });
        if (objectAndTables.size) {
          for (const [object, tables] of objectAndTables) {
            const objectType = configReader.objectType(object);
            routes.push({
              routeType: objectType,
              value: `${object}(${[...tables].join(',')})`,
              depth: depth + 1,
            });
          }
        }

        tablesRet = tablesRet.concat([...tables]);
        [...objectAndTables].forEach(([object, tables]) => {
          objectAndTablesRet.set(object, tables);
          tablesRet = tablesRet.concat([...tables]);
        });
        continue;
      }
    }

    const founds = findByTypeMethod(
      filePostfix,
      directories,
      typeName,
      classNameThis,
      methodName,
      callerParameterCount
    );
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
          ({ routeType: routeTypePrev, value: valuePrev, depth: depthPrev }) =>
            routeTypePrev === 'method' && valuePrev === value && depthPrev <= depth
        );
        if (foundPrev) continue;

        routes.push({ routeType: 'method', value, depth });

        const ret = getTableNamesByMethod(filePostfix, found, directories, xmlsAll, routes, depth + 1);
        if (ret) {
          const { tables, objectAndTables } = ret;
          tablesRet = tablesRet.concat([...tables]);
          [...objectAndTables].forEach(([object, tables]) => objectAndTablesRet.set(object, tables));
          continue;
        }
      }
    }
  }

  return { tables: new Set(tablesRet), objectAndTables: objectAndTablesRet };
}

export function getDependency(): { directories: string[]; xmls: XmlNodeInfoFind[] } {
  const directories: string[] = [];
  let xmls: XmlNodeInfoFind[] = [];

  const { rootDir } = config.path.source;
  for (let i = 0; i < config.path.source.dependency.length; i++) {
    const {
      service: { directory },
      xml,
    } = config.path.source.dependency[i];

    directories.push(directory);

    const xmlsCur = getXmlNodeInfoFinds(rootDir, xml, '*.xml');
    xmls = xmls.concat(xmlsCur);
  }

  return { directories, xmls };
}

export function getStartingToTables(
  filePostfix: string,
  findsStarting: MethodInfoFind[],
  directories: string[],
  xmls: XmlNodeInfoFind[],
  xmlsDependency: XmlNodeInfoFind[],
  startingPoint: StartingPoint
): StartToObjects[] {
  const xmlsAll = xmls.concat(xmlsDependency);

  const startToObjects: StartToObjects[] = [];

  for (let nMethod = 0; nMethod < findsStarting.length; nMethod++) {
    const methodInStartings = findsStarting[nMethod];
    const { className, mappingValues, isPublic: methodIsPublic, name: methodName } = methodInStartings;
    if (startingPoint === 'map' && !mappingValues.length) continue;
    if (startingPoint === 'publicMethod' && !methodIsPublic) continue;

    const routes: RouteInfo[] = [];

    if (startingPoint === 'map') {
      const mappingValuesComma = mappingValues.join(',');

      let depth = -1;
      routes.push({ routeType: 'mapping', value: `${mappingValuesComma}`, depth: ++depth });

      const classDotMethod = `${className}.${methodName}`;
      routes.push({ routeType: 'method', value: classDotMethod, depth: ++depth });

      const { tables, objectAndTables } = getTableNamesByMethod(
        filePostfix,
        methodInStartings,
        directories,
        xmlsAll,
        routes,
        depth + 1
      );
      startToObjects.push({ mappingOrMethod: mappingValuesComma, tables, objectAndTables, routes });
    } else if (startingPoint === 'publicMethod') {
      const classDotMethod = `${className}.${methodName}`;
      let depth = -1;
      routes.push({ routeType: 'method', value: classDotMethod, depth: ++depth });

      const { tables, objectAndTables } = getTableNamesByMethod(
        filePostfix,
        methodInStartings,
        directories,
        xmlsAll,
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
