import { readFileSync, existsSync, statSync } from 'fs';
import { findFiles } from './util';
import { Annotation, MethodInfoFind, getClassInfo } from './classHelper';
import { XmlNodeInfoFind, getXmlInfo, getObjectAndTables, ObjectAndTables } from './sqlHelper';
import { config, configReader } from '../config/config';

export type RouteInfo = {
  routeType: 'mapping' | 'method' | 'xml' | 'table' | 'view' | 'function' | 'procedure';
  value: string;
  depth: number;
};

export type MappingToObjects = {
  mappingValue: string;
  tables: Set<string>;
  objectAndTables: ObjectAndTables;
  routes: RouteInfo[];
};

export function getMethodInfoFinds(rootDir: string, filePattern: string | RegExp): MethodInfoFind[] {
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

  let finds: MethodInfoFind[] = [];

  for (const fullPath of [...findFiles(rootDir, filePattern)]) {
    const content = readFileSync(fullPath, { encoding: 'utf-8' });
    const classInfo = getClassInfo(content);
    const { classHeader, methods } = classInfo;
    const { name: className, implementsName, extendsName, annotations: annotationsClass } = classHeader;
    const findsCur = methods.map(({ annotations, name, parameterCount, callers }) => {
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
        name,
        parameterCount,
        callers,
      };
    });

    const dupMethod = getDupMethod(findsCur);
    if (dupMethod) {
      // throw new Error(`Founded duplicated method: ${foundDup[0]}`);
      console.log(`Founded duplicated method in ${fullPath}: ${dupMethod}`);
    }

    finds = finds.concat(findsCur);
  }

  return finds;
}

export function getXmlNodeInfoFinds(rootDir: string, filePattern: string | RegExp): XmlNodeInfoFind[] {
  if (!existsSync(rootDir)) {
    return [];
  }

  let finds: XmlNodeInfoFind[] = [];

  const tablesAll = configReader.tables();

  const objectAndTables = new Map<string, Set<string>>();
  [...configReader.objectAndTables('view')].forEach(([object, tables]) => objectAndTables.set(object, tables));
  [...configReader.objectAndTables('function')].forEach(([object, tables]) => objectAndTables.set(object, tables));
  [...configReader.objectAndTables('procedure')].forEach(([object, tables]) => objectAndTables.set(object, tables));

  const fullPaths = statSync(rootDir).isDirectory() ? [...findFiles(rootDir, filePattern)] : [rootDir];
  for (const fullPath of fullPaths) {
    const xml = readFileSync(fullPath, 'utf-8');
    const xmlInfo = getXmlInfo(xml, tablesAll, objectAndTables);
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
  let tablesAll: string[] = [];
  let objectAndTablesAll: ObjectAndTables = new Map<string, Set<string>>();

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

        tablesAll = tablesAll.concat([...tables]);
        [...objectAndTables].forEach(([view, tables]) => objectAndTablesAll.set(view, tables));
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
          tablesAll = tablesAll.concat([...tables]);
          [...objectAndTables].forEach(([view, tables]) => objectAndTablesAll.set(view, tables));
          continue;
        }
      }
    }
  }

  return { tables: new Set(tablesAll), objectAndTables: objectAndTablesAll };
}

export function getDependency(): { finds: MethodInfoFind[]; xmls: XmlNodeInfoFind[] } {
  let finds: MethodInfoFind[] = [];
  let xmls: XmlNodeInfoFind[] = [];

  for (let i = 0; i < config.path.dependency.length; i++) {
    const { service, xml } = config.path.dependency[i];

    const { directory, file } = service;
    const findsCur = getMethodInfoFinds(directory, file);
    finds = finds.concat(findsCur);

    const xmlsCur = getXmlNodeInfoFinds(xml, '*.xml');
    xmls = xmls.concat(xmlsCur);
  }

  return { finds, xmls };
}
