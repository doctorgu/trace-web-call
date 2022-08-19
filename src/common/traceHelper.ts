import { readFileSync, writeFileSync } from 'fs';
import { findFiles } from './util';
import { Annotation, MethodInfoFind, getClassInfo } from './classHelper';
import { XmlNodeInfoFind, getXmlInfo } from './xmlHelper';
import { config } from '../config/config';

type ClassType = 'controller' | 'serviceImpl';

export type RouteInfo = {
  routeType: 'mapping' | 'method' | 'xml' | 'table';
  value: string;
  depth: number;
};

export type MappingToTables = {
  mappingValue: string;
  tables: string[];
  routes: RouteInfo[];
};

export async function getMethodInfoFinds(
  rootDir: string,
  filePattern: string,
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

export async function getXmlNodeInfoFinds(rootDir: string, filePattern: string): Promise<XmlNodeInfoFind[]> {
  let finds: XmlNodeInfoFind[] = [];

  for await (const fullPath of findFiles(rootDir, filePattern)) {
    const xml = readFileSync(fullPath, 'utf-8');
    const xmlInfo = getXmlInfo(xml, config.tables());
    if (!xmlInfo) continue;

    const { namespace, nodes } = xmlInfo;
    const findsCur = nodes.map(({ id, tagName, params, tables }) => ({ namespace, id, tagName, params, tables }));
    finds = finds.concat(findsCur);

    // console.log(JSON.stringify(xmlInfo, null, '  '));
    // console.log(fullPath);
  }

  return finds;
}

function getTablesByStringLiteral(xmls: XmlNodeInfoFind[], stringLiteral: string): string[] {
  // User.updateInfo
  // User.UserDao.updateInfo
  const literals = stringLiteral.split('.');
  const first = literals[0];
  const rest = literals.filter((v, i) => i >= 1).join('.');

  const nodeInfoFind = xmls.find(({ namespace, id }) => (namespace === first && id === rest) || id === stringLiteral);
  if (!nodeInfoFind) return [];

  return [...nodeInfoFind.tables].sort();
}

export function getTableNamesByMethod(
  find: MethodInfoFind,
  methods: MethodInfoFind[],
  xmls: XmlNodeInfoFind[],
  routes: RouteInfo[],
  depth: number
): string[] {
  let tablesAll: string[] = [];

  const { className: classNameThis, name: nameThis, callers } = find;
  for (let i = 0; i < callers.length; i++) {
    const { typeName, methodName, stringLiteral } = callers[i];
    if (stringLiteral) {
      const tables = getTablesByStringLiteral(xmls, stringLiteral);
      if (tables.length) {
        routes.push({ routeType: 'xml', value: stringLiteral, depth: depth });
        routes.push({ routeType: 'table', value: [...tables].join(','), depth: depth + 1 });
        tablesAll = tablesAll.concat(tables);
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

      const tables = getTableNamesByMethod(found, methods, xmls, routes, depth + 1);
      if (tables.length) {
        tablesAll = tablesAll.concat(tables);
        continue;
      }
    }
  }

  return [...new Set(tablesAll)].sort();
}
