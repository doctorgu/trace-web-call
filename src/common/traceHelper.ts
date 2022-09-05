import { existsSync, statSync } from 'fs';
import { resolve } from 'path';
import { findFiles, readFileSyncUtf16le, trimEndSpecific } from './util';
import { Annotation, MethodInfoFind, getClassInfo } from './classHelper';
import { XmlNodeInfoFind, getXmlInfo, getObjectAndTables, ObjectAndTables } from './sqlHelper';
import { config, configReader } from '../config/config';
import { StartingPoint } from '../config/configTypes';

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

export function getMethodInfoFinds(rootDir: string, directory: string, filePattern: string | RegExp): MethodInfoFind[] {
  function getDupMethod(finds: MethodInfoFind[]): string {
    const nameAndCount = new Map<string, number>();
    for (let i = 0; i < finds.length; i++) {
      const { className, name, parameterCount } = finds[i];
      const classDotNameCount = `${className}.${name}(${parameterCount})`;
      const count = nameAndCount.get(classDotNameCount) || 0;
      nameAndCount.set(classDotNameCount, count + 1);
    }
    const foundDup = [...nameAndCount].find(([, count]) => count > 1);
    if (!foundDup) return '';

    const [name] = foundDup;
    return name;
  }

  const initDir = resolve(rootDir, directory);

  let finds: MethodInfoFind[] = [];

  for (const fullPath of [...findFiles(initDir, filePattern)]) {
    const classInfo = getClassInfo(rootDir, fullPath);
    const { header, methods } = classInfo;
    const { name: className, implementsName, extendsName, annotations: annotationsClass } = header;
    const findsCur = methods.map(({ annotations, isPublic, name, parameterCount, callers }) => {
      const mappingClass = annotationsClass.find(({ name }) => name.endsWith('Mapping'));
      const root = mappingClass?.values?.[0] || '';

      const mappingValues: string[] = [];
      const mappingCur = annotations.find(({ name }) => name.endsWith('Mapping'));
      if (mappingCur) {
        for (let i = 0; i < mappingCur.values.length; i++) {
          mappingValues.push(`${root}${mappingCur.values[i]}`);
        }
      }

      return {
        className,
        implementsName,
        extendsName,
        mappingValues,
        isPublic,
        name,
        parameterCount,
        callers,
      };
    });

    const dupMethod = getDupMethod(findsCur);
    if (dupMethod) {
      // throw new Error(`Found duplicated method: ${foundDup[0]}`);
      console.log(`Found duplicated method in ${fullPath}: ${dupMethod}`);
    }

    finds = finds.concat(findsCur);
  }

  return finds;
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

  const objectAndTables = new Map<string, Set<string>>();
  [...configReader.objectAndTables('view')].forEach(([object, tables]) => objectAndTables.set(object, tables));
  [...configReader.objectAndTables('function')].forEach(([object, tables]) => objectAndTables.set(object, tables));
  [...configReader.objectAndTables('procedure')].forEach(([object, tables]) => objectAndTables.set(object, tables));

  const fullPaths = statSync(fullDir).isDirectory() ? [...findFiles(fullDir, filePattern)] : [fullDir];
  for (const fullPath of fullPaths) {
    const xmlInfo = getXmlInfo(rootDir, fullPath, tablesAll, objectAndTables);
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

function findByTypeMethod(
  methodsAll: MethodInfoFind[],
  typeName: string,
  classNameThis: string,
  methodName: string,
  callerParameterCount: number
): MethodInfoFind[] {
  const foundsClass = methodsAll.filter(({ className, implementsName }) =>
    typeName ? className === typeName || implementsName === typeName : className === classNameThis
  );
  if (!foundsClass.length) {
    return [];
  }

  const foundsMethod = foundsClass.filter(
    ({ name, parameterCount }) => name === methodName && parameterCount === callerParameterCount
  );
  if (!foundsMethod.length) {
    const { extendsName } = foundsClass[0];
    return findByTypeMethod(methodsAll, extendsName, '', methodName, callerParameterCount);
  }

  return foundsMethod;
}

export function getTableNamesByMethod(
  find: MethodInfoFind,
  methodsAll: MethodInfoFind[],
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

    const founds = findByTypeMethod(methodsAll, typeName, classNameThis, methodName, callerParameterCount);
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
        // !!! to check: routeTypePrev === 'method' && valuePrev === value && depthPrev <= depth
        const foundPrev = routes.some(
          ({ routeType: routeTypePrev, value: valuePrev, depth: depthPrev }) =>
            routeTypePrev === 'method' && valuePrev === value && depthPrev <= depth
        );
        if (foundPrev) continue;

        routes.push({ routeType: 'method', value, depth });

        const ret = getTableNamesByMethod(found, methodsAll, xmlsAll, routes, depth + 1);
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

export function getDependency(): { finds: MethodInfoFind[]; xmls: XmlNodeInfoFind[] } {
  let finds: MethodInfoFind[] = [];
  let xmls: XmlNodeInfoFind[] = [];

  const { rootDir } = config.path.source;
  for (let i = 0; i < config.path.source.dependency.length; i++) {
    const { service, xml } = config.path.source.dependency[i];

    const { directory, file } = service;
    const findsCur = getMethodInfoFinds(rootDir, directory, file);
    finds = finds.concat(findsCur);

    const xmlsCur = getXmlNodeInfoFinds(rootDir, xml, '*.xml');
    xmls = xmls.concat(xmlsCur);
  }

  return { finds, xmls };
}

export function getStartToTables(
  findsController: MethodInfoFind[],
  findsService: MethodInfoFind[],
  xmls: XmlNodeInfoFind[],
  findsDependency: MethodInfoFind[],
  xmlsDependency: XmlNodeInfoFind[],
  startingPoint: StartingPoint
): StartToObjects[] {
  const methodsAll = [...findsController, ...findsService, ...findsDependency];

  const xmlsAll = xmls.concat(xmlsDependency);

  const startToObjects: StartToObjects[] = [];

  for (let nMethod = 0; nMethod < findsController.length; nMethod++) {
    const methodInStartings = findsController[nMethod];
    const { className, mappingValues, isPublic: methodIsPublic, name: methodName } = methodInStartings;
    if (startingPoint === 'map' && !mappingValues.length) continue;
    if (startingPoint === 'publicMethod' && !methodIsPublic) continue;

    const routes: RouteInfo[] = [];

    if (startingPoint === 'map') {
      for (let nValue = 0; nValue < mappingValues.length; nValue++) {
        const mappingValue = mappingValues[nValue];

        const classDotMethod = `${className}.${methodName}`;
        let depth = -1;
        routes.push({ routeType: 'mapping', value: `${mappingValue}`, depth: ++depth });
        routes.push({ routeType: 'method', value: classDotMethod, depth: ++depth });

        const { tables, objectAndTables } = getTableNamesByMethod(
          methodInStartings,
          methodsAll,
          xmlsAll,
          routes,
          depth + 1
        );
        startToObjects.push({ mappingOrMethod: mappingValue, tables, objectAndTables, routes });
      }
    } else if (startingPoint === 'publicMethod') {
      const classDotMethod = `${className}.${methodName}`;
      let depth = -1;
      routes.push({ routeType: 'method', value: classDotMethod, depth: ++depth });

      const { tables, objectAndTables } = getTableNamesByMethod(
        methodInStartings,
        methodsAll,
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
