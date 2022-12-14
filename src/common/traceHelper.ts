import { existsSync, statSync } from 'fs';
import { resolve } from 'path';
import { findFiles, getClassNameFromFullName, getLastPath, trimEnd, trimStart, trimStarts } from './util';
import { MethodInfo, MethodInfoFind, ClassInfo, rowsToFinds } from './classHelper';
import { ObjectInfo, ObjectChild, ObjectType } from '../common/batisHelper';
import { configReader } from '../config/configReader';
import { DirectoryAndFilePattern, StartingPoint } from '../config/ConfigType';
import tClassInfo from '../sqlTemplate/TClassInfo';
import tCache from '../sqlTemplate/TCache';
import tXmlInfo from '../sqlTemplate/TXmlInfo';
import { filterJspFromJsp, getJspInfoFromDb, JspInfo, viewNameToJspPath } from './jspHelper';
import {
  BatchJob,
  BeanSql,
  BeanTargetObject,
  getBatchJobFromDb,
  getBeanSqlFromDb,
  getBeanTargetObjectFromDb,
} from './batchHelper';
import { getXmlNodeInfoFindByNamespaceId } from './sqlMapperHelper';

export type RouteCommon = {
  groupSeq?: number; // Only used for inserting to table
  seq: number;
  seqParent?: number;
  depth: number;
  routeType: any;
};

export type RouteTypeTable = 'mapping' | 'method' | 'xml' | 'view' | 'function' | 'procedure';
export type RouteTable<RouteType> = RouteCommon & {
  value: RouteType extends 'mapping' ? '' : string;
  valueList: RouteType extends 'mapping' ? string[] : [];

  objects?: RouteType extends 'xml' | 'view' | 'function' | 'procedure' ? Set<string> : null;
  tablesInsert?: RouteType extends 'xml' | 'view' | 'function' | 'procedure' ? Set<string> : null;
  tablesUpdate?: RouteType extends 'xml' | 'view' | 'function' | 'procedure' ? Set<string> : null;
  tablesDelete?: RouteType extends 'xml' | 'view' | 'function' | 'procedure' ? Set<string> : null;
  tablesOther?: RouteType extends 'xml' | 'view' | 'function' | 'procedure' ? Set<string> : null;
  selectExists?: RouteType extends 'xml' | 'view' | 'function' | 'procedure' ? boolean : null;
};

export type RouteTypeJsp = 'mapping' | 'method' | 'jsp';
export type RouteJsp<RouteType> = RouteCommon & {
  value: RouteType extends 'mapping' ? '' : string;
  valueList: RouteType extends 'mapping' ? string[] : [];

  jsps?: RouteType extends 'jsp' ? Set<string> : '';
};

export type RouteTypeBatch = 'job' | 'step' | 'method' | 'xml' | 'view' | 'function' | 'procedure' | 'error';
export type RouteBatch<RouteType> = RouteCommon & {
  value: string;

  restartable?: RouteType extends 'job' ? boolean : false;

  objects?: RouteType extends 'xml' | 'view' | 'function' | 'procedure' ? Set<string> : null;
  tablesInsert?: RouteType extends 'xml' | 'view' | 'function' | 'procedure' ? Set<string> : null;
  tablesUpdate?: RouteType extends 'xml' | 'view' | 'function' | 'procedure' ? Set<string> : null;
  tablesDelete?: RouteType extends 'xml' | 'view' | 'function' | 'procedure' ? Set<string> : null;
  tablesOther?: RouteType extends 'xml' | 'view' | 'function' | 'procedure' ? Set<string> : null;
  selectExists?: RouteType extends 'xml' | 'view' | 'function' | 'procedure' ? boolean : null;
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

  const ret = getXmlNodeInfoFindByNamespaceId(keyName, directoriesXml, stringLiteral);
  if (!ret) {
    return false;
  }

  const { objects, tablesInsert, tablesUpdate, tablesDelete, tablesOther, selectExists } = ret;

  const routeXml: RouteTable<'xml'> = {
    seq: routes.length,
    depth,
    routeType: 'xml',
    value: stringLiteral,
    valueList: [],
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
          value: name,
          valueList: [],
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
          value: name,
          valueList: [],
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
          value: name,
          valueList: [],
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

function findByNameParameterCount(
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

function findByNames(
  keyName: string,
  directories: string[],
  typeName: string,
  methodNames: string[]
): MethodInfoFind[] {
  const rows = tClassInfo.selectMethodInfoFindByName(keyName, methodNames, directories, typeName);
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

    const founds = findByNameParameterCount(
      keyName,
      directories,
      typeName,
      classNameThis,
      methodName,
      callerParameterCount
    );
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

        const routeMethod: RouteTable<'method'> = {
          seq: routes.length,
          depth,
          routeType: 'method',
          value: value,
          valueList: [],
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
    if (startingPoint === 'mapping' && !mappingValues.length) continue;
    if (startingPoint === 'publicMethod' && !methodIsPublic) continue;

    const routes: RouteTable<RouteTypeTable>[] = [];

    if (startingPoint === 'mapping') {
      let depth = -1;
      const routeMapping: RouteTable<'mapping'> = {
        seq: routes.length,
        depth: ++depth,
        routeType: 'mapping',
        value: '',
        valueList: mappingValues,
      };
      routes.push(routeMapping);

      const classDotMethod = `${className}.${methodName}`;
      const routeMethod: RouteTable<'method'> = {
        seq: routes.length,
        depth: ++depth,
        routeType: 'method',
        value: classDotMethod,
        valueList: [],
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
        value: classDotMethod,
        valueList: [],
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
        value: '',
        valueList: [],
        jsps: new Set<string>([include]),
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
      value: '',
      valueList: [],
      jsps: new Set<string>([jspPath]),
    };
    routes.push(routeJsp);

    getJspPathsByJspPath(jspInfos, jspPath, depth + 1, routes);
  }
}

export function getStartingToJsps(
  keyName: string,
  findsStarting: MethodInfoFind[],
  jspDirectory: string,
  startingPoint: StartingPoint
): RouteTable<RouteTypeJsp>[][] {
  const jspInfos = getJspInfoFromDb(keyName);

  const routesAll: RouteTable<RouteTypeJsp>[][] = [];
  for (let nMethod = 0; nMethod < findsStarting.length; nMethod++) {
    const methodInStartings = findsStarting[nMethod];
    const { className, mappingValues, isPublic: methodIsPublic, name: methodName } = methodInStartings;
    if (startingPoint === 'mapping' && !mappingValues.length) continue;
    if (startingPoint === 'publicMethod' && !methodIsPublic) continue;

    const routes: RouteJsp<RouteTypeJsp>[] = [];

    if (startingPoint === 'mapping') {
      let depth = -1;
      const routeMapping: RouteJsp<'mapping'> = {
        seq: routes.length,
        depth: ++depth,
        routeType: 'mapping',
        value: '',
        valueList: mappingValues,
      };
      routes.push(routeMapping);

      const classDotMethod = `${className}.${methodName}`;
      const routeMethod: RouteJsp<'method'> = {
        seq: routes.length,
        depth: ++depth,
        routeType: 'method',
        value: classDotMethod,
        valueList: [],
      };
      routes.push(routeMethod);

      getJspsByMethod(jspInfos, jspDirectory, methodInStartings, routes, depth + 1);
      routesAll.push(routes);
    } else if (startingPoint === 'publicMethod') {
      const classDotMethod = `${className}.${methodName}`;
      let depth = -1;
      const routeMethod: RouteJsp<'method'> = {
        seq: routes.length,
        depth: ++depth,
        routeType: 'method',
        value: classDotMethod,
        valueList: [],
      };
      routes.push(routeMethod);

      getJspsByMethod(jspInfos, jspDirectory, methodInStartings, routes, depth + 1);
      routesAll.push(routes);
    }
  }

  return routesAll;
}

function routeTableToBatch(routesTable: RouteTable<RouteTypeTable>[], seqStart: number) {
  const routes: RouteBatch<RouteTypeBatch>[] = [];

  for (const routeTable of routesTable) {
    switch (routeTable.routeType) {
      case 'method':
        {
          const route: RouteBatch<'method'> = {
            seq: seqStart++,
            depth: routeTable.depth,
            routeType: 'method',
            value: routeTable.value,
          };
          routes.push(route);
        }
        break;
      case 'xml':
        {
          const route: RouteBatch<'xml'> = {
            seq: seqStart++,
            depth: routeTable.depth,
            routeType: 'xml',
            value: routeTable.value,

            objects: routeTable.objects as Set<string>,
            tablesInsert: routeTable.tablesInsert as Set<string>,
            tablesUpdate: routeTable.tablesUpdate as Set<string>,
            tablesDelete: routeTable.tablesDelete as Set<string>,
            tablesOther: routeTable.tablesOther as Set<string>,
            selectExists: routeTable.selectExists as boolean,
          };
          routes.push(route);
        }
        break;
      case 'view':
        {
          const route: RouteBatch<'view'> = {
            seq: seqStart++,
            depth: routeTable.depth,
            routeType: 'view',
            value: routeTable.value,

            objects: routeTable.objects as Set<string>,
            tablesInsert: routeTable.tablesInsert as Set<string>,
            tablesUpdate: routeTable.tablesUpdate as Set<string>,
            tablesDelete: routeTable.tablesDelete as Set<string>,
            tablesOther: routeTable.tablesOther as Set<string>,
            selectExists: routeTable.selectExists as boolean,
          };
          routes.push(route);
        }
        break;
      case 'function':
        {
          const route: RouteBatch<'function'> = {
            seq: seqStart++,
            depth: routeTable.depth,
            routeType: 'function',
            value: routeTable.value,

            objects: routeTable.objects as Set<string>,
            tablesInsert: routeTable.tablesInsert as Set<string>,
            tablesUpdate: routeTable.tablesUpdate as Set<string>,
            tablesDelete: routeTable.tablesDelete as Set<string>,
            tablesOther: routeTable.tablesOther as Set<string>,
            selectExists: routeTable.selectExists as boolean,
          };
          routes.push(route);
        }
        break;
      case 'procedure':
        {
          const route: RouteBatch<'procedure'> = {
            seq: seqStart++,
            depth: routeTable.depth,
            routeType: 'procedure',
            value: routeTable.value,

            objects: routeTable.objects as Set<string>,
            tablesInsert: routeTable.tablesInsert as Set<string>,
            tablesUpdate: routeTable.tablesUpdate as Set<string>,
            tablesDelete: routeTable.tablesDelete as Set<string>,
            tablesOther: routeTable.tablesOther as Set<string>,
            selectExists: routeTable.selectExists as boolean,
          };
          routes.push(route);
        }
        break;
    }
  }

  return routes;
}

export function getBatchToObjects(
  keyName: string,
  batchXmlDirectory: string,
  directories: string[],
  directoriesXml: string[]
): RouteBatch<RouteTypeBatch>[][] {
  const batchJobs: BatchJob[] = getBatchJobFromDb(keyName);
  const targets: BeanTargetObject[] = getBeanTargetObjectFromDb(keyName);
  const sqls: BeanSql[] = getBeanSqlFromDb(keyName);

  const routesAll: RouteBatch<RouteTypeBatch>[][] = [];
  for (const batchJob of batchJobs) {
    let routes: RouteBatch<RouteTypeBatch>[] = [];
    let depth = -1;

    const routeJob: RouteBatch<'job'> = {
      seq: routes.length,
      depth: ++depth,
      routeType: 'job',
      value: batchJob.id,
      restartable: batchJob.restartable,
    };
    routes.push(routeJob);

    for (const step of batchJob.steps) {
      let depthStep = depth;

      const beanIds: string[] = [];
      if (step.tasklet.ref) beanIds.push(step.tasklet.ref);
      if (step.tasklet.reader) beanIds.push(step.tasklet.reader);
      if (step.tasklet.processor) beanIds.push(step.tasklet.processor);
      if (step.tasklet.writer) beanIds.push(step.tasklet.writer);
      for (const beanId of beanIds) {
        let depthBean = depthStep;

        const target = targets.find((target) => target.batchPath === batchJob.batchPath && target.beanId === beanId);
        const sql = sqls.find((sql) => sql.batchPath === batchJob.batchPath && sql.beanId === beanId);

        if (target || sql) {
          const routeStep: RouteBatch<'step'> = {
            seq: routes.length,
            depth: ++depthBean,
            routeType: 'step',
            value: target?.beanId || sql?.beanId || '',
          };
          routes.push(routeStep);
        }

        if (target) {
          const typeName = getClassNameFromFullName(target.className);
          // read in ItemReader, process in ItemProcessor, write in ItemWriter
          const methodNames = target.targetMethod ? [target.targetMethod] : ['read', 'process', 'write'];
          const finds: MethodInfoFind[] = findByNames(keyName, directories, typeName, methodNames);
          if (finds.length === 0) {
            const valueError = { message: 'targetMethod not found', keyName, directories, typeName, methodNames };
            const routeError: RouteBatch<'error'> = {
              seq: routes.length,
              depth: ++depthBean,
              routeType: 'error',
              value: JSON.stringify(valueError),
            };
            routes.push(routeError);
            continue;
          }

          const find = finds[0];

          const routeMethod: RouteBatch<'method'> = {
            seq: routes.length,
            depth: ++depthBean,
            routeType: 'method',
            value: `${find.className}.${find.name}`,
          };
          routes.push(routeMethod);

          const routesTable: RouteTable<RouteTypeTable>[] = [];
          getTableNamesByMethod(keyName, find, directories, directoriesXml, routesTable, depthBean + 1);

          const routesBatch: RouteBatch<RouteTypeBatch>[] = routeTableToBatch(routesTable, routes.length);
          routes = routes.concat(routesBatch);
        } else if (sql) {
          const routeBatch: RouteBatch<'xml'> = {
            seq: routes.length,
            depth: ++depthBean,
            routeType: 'xml',
            value: sql.beanId,

            objects: sql.objects,
            tablesInsert: sql.tablesInsert,
            tablesUpdate: sql.tablesUpdate,
            tablesDelete: sql.tablesDelete,
            tablesOther: sql.tablesOther,
            selectExists: sql.selectExists,
          };
          routes.push(routeBatch);
        }
      }
    }

    routesAll.push(routes);
  }

  return routesAll;
}

/**
Set all seqParent by seq and depth property.

Q. Why does not set seqParent when adding new route?

A. Because no way to get seqParent in query in TCache.selectObjectsDeep method.

@param routes All routes
@param seqParent caller's seq

@example
// 0 Root
// 1 +-- Child1
// 2 +------ Child1-1
// 3 +------ Child1-2
// 4 +-- Child2
// 5 +------ Child2-2
// 6 +---------- Child2-2-1
const routes: RouteCommon[] = [];
routes.push({ seq: routes.length, depth: 0, routeType: 'Root' });
routes.push({ seq: routes.length, depth: 1, routeType: 'Child1' });
routes.push({ seq: routes.length, depth: 2, routeType: 'Child1-1' });
routes.push({ seq: routes.length, depth: 2, routeType: 'Child1-2' });
routes.push({ seq: routes.length, depth: 1, routeType: 'Child2' });
routes.push({ seq: routes.length, depth: 2, routeType: 'Child2-2' });
routes.push({ seq: routes.length, depth: 3, routeType: 'Child2-2-1' });

setSeqParent(routes, 0);
console.log(routes);
->
[
  { seq: 0, depth: 0, routeType: 'Root' },
  { seq: 1, depth: 1, routeType: 'Child1', seqParent: 0 },
  { seq: 2, depth: 2, routeType: 'Child1-1', seqParent: 1 },
  { seq: 3, depth: 2, routeType: 'Child1-2', seqParent: 1 },
  { seq: 4, depth: 1, routeType: 'Child2', seqParent: 0 },
  { seq: 5, depth: 2, routeType: 'Child2-2', seqParent: 4 },
  { seq: 6, depth: 3, routeType: 'Child2-2-1', seqParent: 5 }
]
*/
export function setSeqParent(routes: RouteCommon[], seqParent: number): void {
  const parent = routes.find((route) => route.seq === seqParent);
  if (!parent) return;

  const depthChild = parent.depth + 1;

  let seqCur = seqParent;
  while (true) {
    seqCur++;

    const routeCur = routes.find((route) => route.seq === seqCur);
    if (!routeCur) break;

    const depthCur = routeCur.depth;
    if (depthCur < depthChild) break;
    if (depthCur > depthChild) continue;

    routeCur.seqParent = seqParent;
    setSeqParent(routes, routeCur.seq);
  }
}

export function setGroupSeqAndSeqParent(routesAll: RouteCommon[][]): any[] {
  for (const routes of routesAll) {
    routes[0].seqParent = -1;
    setSeqParent(routes, 0);
  }

  const routes = routesAll
    .map((routes, i) => {
      return routes.map((route) => ({ groupSeq: i, ...route }));
    })
    .flat();
  return routes;
}
