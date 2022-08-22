import { readFileSync, writeFileSync } from 'fs';
import { findFiles } from './util';
import { Annotation, MethodInfoFind, getClassInfo } from './classHelper';
import { XmlNodeInfoFind, getXmlInfo, getObjectAndTables, ObjectAndTables } from './sqlHelper';
import { config } from '../config/config';

type ClassType = 'controller' | 'serviceImpl';

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

export async function getMethodInfoFinds(
  rootDir: string,
  filePattern: string | RegExp,
  classType: ClassType
): Promise<MethodInfoFind[]> {
  let finds: MethodInfoFind[] = [];

  const callerOnlyInVars = classType === 'controller';

  for await (const fullPath of findFiles(rootDir, filePattern)) {
    const content = readFileSync(fullPath, { encoding: 'utf-8' });
    const classInfo = getClassInfo(content, callerOnlyInVars);
    const { classHeader, methods } = classInfo;
    const { name: className, implementsName, annotations: annotationsClass } = classHeader;
    const findsCur = methods.map(({ annotations, name, callers }) => {
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
        mappingValues,
        name,
        callers,
      };
    });
    finds = finds.concat(findsCur);
  }

  return finds;
}

export async function getXmlNodeInfoFinds(rootDir: string, filePattern: string | RegExp): Promise<XmlNodeInfoFind[]> {
  let finds: XmlNodeInfoFind[] = [];

  const tables = config.tables();

  const objectAndTables = new Map<string, Set<string>>();
  [...config.objectAndTables('view')].forEach(([object, tables]) => objectAndTables.set(object, tables));
  [...config.objectAndTables('function')].forEach(([object, tables]) => objectAndTables.set(object, tables));
  [...config.objectAndTables('procedure')].forEach(([object, tables]) => objectAndTables.set(object, tables));

  for await (const fullPath of findFiles(rootDir, filePattern)) {
    const xml = readFileSync(fullPath, 'utf-8');
    const xmlInfo = getXmlInfo(xml, tables, objectAndTables);
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
  xmls: XmlNodeInfoFind[],
  stringLiteral: string
): { tables: Set<string>; objectAndTables: ObjectAndTables } | null {
  // User.updateInfo
  // User.UserDao.updateInfo
  const literals = stringLiteral.split('.');
  const first = literals[0];
  const rest = literals.filter((v, i) => i >= 1).join('.');

  const nodeInfoFind = xmls.find(({ namespace, id }) => (namespace === first && id === rest) || id === stringLiteral);
  if (!nodeInfoFind) return null;

  const { tables, objectAndTables } = nodeInfoFind;
  return { tables, objectAndTables };
}

export function getTableNamesByMethod(
  find: MethodInfoFind,
  methods: MethodInfoFind[],
  xmls: XmlNodeInfoFind[],
  routes: RouteInfo[],
  depth: number
): { tables: Set<string>; objectAndTables: ObjectAndTables } {
  let tablesAll: string[] = [];
  let objectAndTablesAll: ObjectAndTables = new Map<string, Set<string>>();

  const { className: classNameThis, name: nameThis, callers } = find;
  for (let i = 0; i < callers.length; i++) {
    const { typeName, methodName, stringLiteral } = callers[i];
    if (stringLiteral) {
      const ret = getObjectByStringLiteral(xmls, stringLiteral);
      if (ret) {
        const { tables, objectAndTables } = ret;

        routes.push({ routeType: 'xml', value: stringLiteral, depth: depth });

        routes.push({ routeType: 'table', value: [...tables].join(','), depth: depth + 1 });
        if (objectAndTables.size) {
          for (const [object, tables] of objectAndTables) {
            const objectType = config.objectType(object);
            routes.push({
              routeType: objectType,
              value: [...tables].map((table) => `${object}(${[...tables].join(',')})`).join(','),
              depth: depth + 1,
            });
          }
        }

        tablesAll = tablesAll.concat([...tables]);
        [...objectAndTables].forEach(([view, tables]) => objectAndTablesAll.set(view, tables));
        continue;
      }
    }

    const found = methods.find(({ className, implementsName, name }) => {
      if (typeName) {
        return (className === typeName || implementsName === typeName) && name === methodName;
      } else {
        return className === classNameThis && name === methodName;
      }
    });
    if (found) {
      const value = `${typeName ? `${typeName}.` : ''}${methodName}`;
      routes.push({ routeType: 'method', value, depth });

      const ret = getTableNamesByMethod(found, methods, xmls, routes, depth + 1);
      if (ret) {
        const { tables, objectAndTables } = ret;
        tablesAll = tablesAll.concat([...tables]);
        [...objectAndTables].forEach(([view, tables]) => objectAndTablesAll.set(view, tables));
        continue;
      }
    }
  }

  return { tables: new Set(tablesAll), objectAndTables: objectAndTablesAll };
}
