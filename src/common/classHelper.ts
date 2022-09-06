import { parse } from 'java-parser';
import { SqlTemplate, readFileSyncUtf16le, findLastIndex, trimSpecific, trimStartSpecific, escapeDollar } from './util';
import { all, get, execSql } from './dbHelper';
import { configReader } from '../config/config';
import { runSaveToDbFirst } from './message';
import { getDbPath } from './common';

type Keyword =
  | 'LCurly'
  | 'RCurly'
  | 'Semicolon'
  | 'annotation'
  | 'typeName'
  | 'Identifier'
  | 'StringLiteral'
  | 'fieldDeclaration'
  | 'unannType'
  | 'variableDeclaratorList'
  | 'methodDeclaration'
  | 'methodDeclarator'
  | 'fqnOrRefType'
  | 'fqnOrRefTypePartFirst'
  | 'fqnOrRefTypePartCommon'
  | 'Identifier'
  | 'Dot'
  | 'fqnOrRefTypePartRest'
  | 'primary'
  | 'primaryPrefix'
  | 'primarySuffix'
  | 'methodInvocationSuffix'
  | 'LBrace'
  | 'RBrace'
  | 'literal'
  | 'This'
  | 'variableDeclaratorId'
  | 'unaryExpression'
  | '0'
  | '1'
  | 'Comma'
  | 'argumentList'
  | 'formalParameterList'
  | 'expression'
  | 'formalParameter'
  | 'unaryExpressionNotPlusMinus'
  | 'methodModifier'
  | 'Public';

type PathsAndImage = {
  paths: string[];
  image: string;
};

export type Annotation = {
  name: string;
  values: string[];
};

export type VarInfo = {
  annotations: Annotation[];
  typeName: string;
  instanceName: string;
};

export type CallerInfo = {
  typeName: string;
  instanceName: string;
  methodName: string;
  parameterCount: number;
  stringLiteral: string;
};

export type MethodInfo = {
  annotations: Annotation[];
  isPublic: boolean;
  name: string;
  parameterCount: number;
  callers: CallerInfo[];
};

export type MethodInfoFind = {
  classPath: string;
  className: string;
  implementsName: string;
  extendsName: string;
  mappingValues: string[];
  isPublic: boolean; // !!! Need Public, Protected, Private when finding by extended
  name: string;
  parameterCount: number;
  callers: CallerInfo[];
};

type HeaderInfo = {
  classPath: string;
  name: string;
  implementsName: string;
  extendsName: string;
  annotations: Annotation[];
};

export type ClassInfo = {
  header: HeaderInfo;
  // vars: VarInfo[];
  methods: MethodInfo[];
};

function getProperty(parent: any, paths: string[]): any {
  const kvList = Object.entries(parent);
  for (let i = 0; i < kvList.length; i++) {
    const [key] = kvList[i];

    if (paths[0] !== key) continue;

    const child = parent[key];
    paths.shift();
    if (paths.length === 0) {
      return child;
    }

    return getProperty(child, paths);
  }

  return null;
}

function getValue(parent: any, pathDotSeparated: string): string {
  const paths = pathDotSeparated.split('.');

  const prop = getProperty(parent, paths);
  if (prop === null) return '';

  return prop;
}

function getSimplifiedCst(pathsAndImageList: PathsAndImage[]) {
  const treeNew: any = {};
  for (let i = 0; i < pathsAndImageList.length; i++) {
    const { paths, image } = pathsAndImageList[i];

    let child = treeNew;
    for (let i = 0; i < paths.length - 1; i++) {
      const path = paths[i];

      if (!(path in child)) {
        const nextPathIsIndex = !isNaN(parseInt(paths[i + 1]));
        if (nextPathIsIndex) {
          child[path] = [];
        } else {
          child[path] = {};
        }
      }
      child = child[path];
    }
    child[paths[paths.length - 1]] = image;
  }
  return treeNew;
}

function getPathsAndImageListFromSimpleCst2(parent: any, paths: string[], pathsAndImageList: PathsAndImage[]): void {
  if (typeof parent === 'string') {
    pathsAndImageList.push({ paths, image: parent });
    return;
  }

  const kvList = Object.entries(parent);
  for (let nKv = 0; nKv < kvList.length; nKv++) {
    const [key, value] = kvList[nKv];

    const prop = parent[key];

    const pathsNew = [...paths];
    pathsNew.push(key);
    getPathsAndImageListFromSimpleCst2(prop, pathsNew, pathsAndImageList);
  }
}
function getPathsAndImageListFromSimpleCst(parent: any) {
  const paths: string[] = [];
  const pathsAndImageList: PathsAndImage[] = [];
  getPathsAndImageListFromSimpleCst2(parent, paths, pathsAndImageList);
  return pathsAndImageList;
}

function getPathsAndImageListFromCst2(parent: any, paths: string[], pathsAndImageList: PathsAndImage[]): void {
  const children = parent.children;
  // All leaf property name which has value is always 'image', so do not add 'image' to paths
  if ('image' in parent) {
    const image = parent.image;
    pathsAndImageList.push({ paths, image });
    return;
  }
  if (!children) {
    throw new Error(`No children in ${paths.join('.')}`);
  }

  const kvList = Object.entries(children);
  for (let i = 0; i < kvList.length; i++) {
    const [key, value] = kvList[i];

    const prop = children[key];

    if (Array.isArray(value) && value.length) {
      const useIndex = value.length > 1;
      for (let i = 0; i < value.length; i++) {
        const pathsNew = [...paths];
        pathsNew.push(key);
        if (useIndex) pathsNew.push(i.toString());
        getPathsAndImageListFromCst2(prop[i], pathsNew, pathsAndImageList);
      }
    }
  }
}
function getPathsAndImageListFromCst(parent: any) {
  const paths: string[] = [];
  const pathsAndImageList: PathsAndImage[] = [];
  getPathsAndImageListFromCst2(parent, paths, pathsAndImageList);
  return pathsAndImageList;
}

// function getAllValues(parent: any): string[] {
//   const paths: string[] = [];
//   const pathsAndImageList: PathsAndImage[] = [];
//   getPathsAndImageList(parent, paths, pathsAndImageList);

//   const pathsRet = pathsAndImageList.map(({ image }) => image);
//   return pathsRet;
// }

function endsWith(paths: string[], ...finds: Keyword[]): boolean {
  return endsWith2(paths, finds);
}
function endsWith2(paths: string[], finds: Keyword[]): boolean {
  const finds2 = [...finds];

  let index = paths.length;
  for (let i = finds2.length - 1; i >= 0; i--) {
    index--;
    if (finds2[i] !== paths[index]) {
      return false;
    }
  }

  return true;
}

function includes(paths: string[], ...finds: Keyword[]): boolean {
  return includes2(paths, finds);
}
function includes2(paths: string[], finds: Keyword[]): boolean {
  let fromIndex = 0;

  while (true) {
    let index = paths.indexOf(finds[0], fromIndex);
    if (index === -1) return false;

    fromIndex = index + 1;

    let found = true;
    for (let i = 1; i < finds.length; i++) {
      index++;
      if (finds[i] !== paths[index]) {
        found = false;
        break;
      }
    }
    if (found) return true;
  }
}

function getHeaderInfo(classPath: string, classDeclaration: any): HeaderInfo {
  const classModifier = getProperty(classDeclaration, 'classModifier'.split('.'));
  let annotations: Annotation[] = [];
  if (classModifier !== null) {
    const pathsAndImageList = getPathsAndImageListFromSimpleCst(classModifier);
    for (let i = 0; i < pathsAndImageList.length; i++) {
      const { paths, image } = pathsAndImageList[i];

      if (includes(paths, 'annotation')) {
        if (endsWith(paths, 'typeName', 'Identifier')) {
          annotations.push({ name: image, values: [] });
        } else if (endsWith(paths, 'StringLiteral')) {
          annotations[annotations.length - 1].values.push(trimSpecific(image, '"'));
        }
      }
    }
  }

  const name = getValue(classDeclaration, 'normalClassDeclaration.typeIdentifier.Identifier');
  const extendsName = getValue(classDeclaration, 'normalClassDeclaration.superclass.classType.Identifier');
  const implementsName = getValue(
    classDeclaration,
    'normalClassDeclaration.superinterfaces.interfaceTypeList.interfaceType.classType.Identifier'
  );

  return { name, implementsName, extendsName, annotations, classPath };
}

function getVars(pathsAndImageList: PathsAndImage[]): VarInfo[] {
  const fieldDecls = pathsAndImageList.filter(({ paths, image }) => includes(paths, 'fieldDeclaration'));

  const vars: VarInfo[] = [];
  let annotations: Annotation[] = [];
  let typeName = '';
  let instanceName = '';
  for (let i = 0; i < fieldDecls.length; i++) {
    const { paths, image } = fieldDecls[i];
    if (endsWith(paths, 'LCurly') || endsWith(paths, 'Semicolon')) {
      vars.push({ annotations, typeName, instanceName });
      annotations = [];
      typeName = '';
      instanceName = '';
    }

    if (includes(paths, 'annotation')) {
      if (endsWith(paths, 'typeName', 'Identifier')) {
        annotations.push({ name: image, values: [] });
      } else if (endsWith(paths, 'StringLiteral')) {
        annotations[annotations.length - 1].values.push(trimSpecific(image, '"'));
      }
    } else if (includes(paths, 'unannType')) {
      typeName = image;
    } else if (includes(paths, 'variableDeclaratorList')) {
      instanceName = image;
    }
  }

  return vars;
}

function getRCurlyPosition(methodDecls: PathsAndImage[], posLCurly: number): number {
  let counter = 1;

  for (let i = posLCurly + 1; i < methodDecls.length; i++) {
    const { paths } = methodDecls[i];
    if (endsWith(paths, 'LCurly')) {
      counter++;
    } else if (endsWith(paths, 'RCurly')) {
      counter--;
    }

    if (counter === 0) {
      return i;
    }
  }

  throw new Error(`RCurly not found after ${posLCurly} index.`);
}

function getRBracePosition(pathsAndImages: PathsAndImage[], posLBrace: number): number {
  let counter = 1;

  for (let i = posLBrace + 1; i < pathsAndImages.length; i++) {
    const { paths } = pathsAndImages[i];
    if (endsWith(paths, 'LBrace')) {
      counter++;
    } else if (endsWith(paths, 'RBrace')) {
      counter--;
    }

    if (counter === 0) {
      return i;
    }
  }

  throw new Error(`RBrace not found after ${posLBrace} index.`);
}

function getParameterCount(cstSimple: any, rangeBrace: PathsAndImage[], isMethod: boolean): number {
  const finds: Keyword[] = isMethod ? ['formalParameterList', 'formalParameter'] : ['argumentList', 'expression'];

  let found = rangeBrace.find(({ paths }) => includes2(paths, finds));
  if (!found) {
    return 0;
  }

  const pathsNew = [...found.paths];
  while (!endsWith2(pathsNew, finds)) {
    pathsNew.pop();
  }
  const prop = getProperty(cstSimple, pathsNew);
  if (!prop) {
    return 0;
  }

  if (!Array.isArray(prop)) {
    return 1;
  }

  return prop.length;
}

function getCallerInfos2(
  cstSimple: any,
  list: PathsAndImage[],
  vars: VarInfo[],
  posStart: number,
  posEnd: number,
  callers: CallerInfo[] = []
): CallerInfo[] {
  const range = list.filter((v, i) => i >= posStart && i <= posEnd);

  const posLBrace = range.findIndex(({ paths }) => endsWith(paths, 'LBrace'));
  if (posLBrace === -1) {
    return callers;
  }

  const posRBrace = getRBracePosition(range, posLBrace);
  if (posRBrace === -1) {
    return callers;
  }

  /*
  fqnOrRefType.fqnOrRefTypePartFirst.fqnOrRefTypePartCommon.Identifier
  fqnOrRefType.fqnOrRefTypePartRest .fqnOrRefTypePartCommon.Identifier
  sessionInfo.getInteger("USER_ID");

  fqnOrRefType.fqnOrRefTypePartFirst.fqnOrRefTypePartCommon.Identifier
  selectMember(siteId, param);

  unaryExpression.primary.primaryPrefix
  unaryExpression.primary.primarySuffix.0.Identifier
  this.selectMember(siteId, param);

  unaryExpression.primary.primaryPrefix
  unaryExpression.primary.primarySuffix.0.Identifier
  unaryExpression.primary.primarySuffix.1.Identifier
  this.memberInfoDAO.selectMember(siteId, param);
  */

  const rangeBeforeLBrace = range.filter((v, i) => i < posLBrace);

  let first = '';
  let rest = '';
  let thisFound = false;
  for (let i = 0; i < rangeBeforeLBrace.length; i++) {
    const { paths, image } = rangeBeforeLBrace[i];
    if (includes(paths, 'fqnOrRefType', 'fqnOrRefTypePartFirst', 'fqnOrRefTypePartCommon', 'Identifier')) {
      first = image;
    } else if (includes(paths, 'fqnOrRefType', 'fqnOrRefTypePartRest', 'fqnOrRefTypePartCommon', 'Identifier')) {
      rest = image;
    } else if (includes(paths, 'This')) {
      thisFound = true;
    } else if (thisFound) {
      if (
        includes(paths, 'unaryExpression', 'primary', 'primarySuffix', '0', 'Identifier') ||
        includes(paths, 'unaryExpressionNotPlusMinus', 'primary', 'primarySuffix', '0', 'Identifier')
      ) {
        first = image;
      } else if (
        includes(paths, 'unaryExpression', 'primary', 'primarySuffix', '1', 'Identifier') ||
        includes(paths, 'unaryExpressionNotPlusMinus', 'primary', 'primarySuffix', '1', 'Identifier')
      ) {
        rest = image;
      }
    }
  }

  let typeName = '';
  let instanceName = '';
  let methodName = '';
  if (first) {
    if (rest) {
      instanceName = first;
      methodName = rest;

      const varByInstance = vars.find(({ instanceName: instanceNameVar }) => instanceNameVar === instanceName);
      if (varByInstance) {
        typeName = varByInstance.typeName;
      }
    } else {
      methodName = first;
    }
  }

  const rangeBrace = range.filter((v, i) => i > posLBrace && i < posRBrace);

  let stringLiteral = '';
  for (let i = 0; i < rangeBrace.length; i++) {
    const { paths, image } = rangeBrace[i];
    const lBraceInnerFound = endsWith(paths, 'LBrace');
    if (lBraceInnerFound) {
      const posLBraceInner = i;
      const posRBraceInner = getRBracePosition(rangeBrace, posLBraceInner);
      const callersInner = getCallerInfos2(cstSimple, rangeBrace, vars, 0, posRBraceInner);
      callers = callers.concat(callersInner);
      i = posRBraceInner;
    }
    if (endsWith(paths, 'StringLiteral') && image) {
      stringLiteral = trimSpecific(image, '"');
    }
  }

  const parameterCount = getParameterCount(cstSimple, rangeBrace, false);

  if (methodName) {
    callers.push({ typeName, instanceName, methodName, stringLiteral, parameterCount });
  }

  return callers;
}

function getCallerInfos(
  cstSimple: any,
  methodDecls: PathsAndImage[],
  vars: VarInfo[],
  posLCurly: number,
  posRCurly: number
): CallerInfo[] {
  let callers: CallerInfo[] = [];

  const list = methodDecls.filter((v, i) => i > posLCurly && i < posRCurly);
  for (let i = 0; i < list.length; i++) {
    const posLBrace = list.findIndex(({ paths }, idx) => idx >= i && endsWith(paths, 'LBrace'));
    if (posLBrace === -1) break;

    const posRBrace = getRBracePosition(list, posLBrace);
    const callersCur = getCallerInfos2(cstSimple, list, vars, i, posRBrace);
    if (callersCur.length) {
      callers = callers.concat(callersCur);
    }

    i = posRBrace;
  }

  return callers;
}

function getMethods(cstSimple: any, pathsAndImageList: PathsAndImage[], vars: VarInfo[]): MethodInfo[] {
  const methodDecls = pathsAndImageList.filter(({ paths, image }) => includes(paths, 'methodDeclaration'));

  const methods: MethodInfo[] = [];
  let annotations: Annotation[] = [];
  let isPublic = false;
  let methodName = '';
  let parameterCount = 0;
  let callers: CallerInfo[] = [];
  for (let i = 0; i < methodDecls.length; i++) {
    const { paths, image } = methodDecls[i];

    if (includes(paths, 'annotation')) {
      if (endsWith(paths, 'typeName', 'Identifier')) {
        annotations.push({ name: image, values: [] });
      } else if (endsWith(paths, 'StringLiteral')) {
        annotations[annotations.length - 1].values.push(trimSpecific(image, '"'));
      }
    } else if (includes(paths, 'methodDeclaration', 'methodModifier') && endsWith(paths, 'Public')) {
      isPublic = true;
    } else if (endsWith(paths, 'methodDeclarator', 'Identifier')) {
      methodName = image;
    } else if (endsWith(paths, 'LCurly')) {
      const posLCurly = i;
      const posRCurly = getRCurlyPosition(methodDecls, posLCurly);
      callers = getCallerInfos(cstSimple, methodDecls, vars, posLCurly, posRCurly);

      methods.push({ annotations, isPublic, name: methodName, parameterCount, callers });

      annotations = [];
      isPublic = false;
      methodName = '';
      callers = [];

      i = posRCurly;
    } else if (endsWith(paths, 'LBrace')) {
      const posLBrace = i;
      const posRBrace = getRBracePosition(methodDecls, posLBrace);
      const rangeBrace = methodDecls.filter((v, i) => i > posLBrace && i < posRBrace);
      parameterCount = getParameterCount(cstSimple, rangeBrace, true);
    }
  }

  return methods;
}

function getCstClassDeclaration(cstSimpleAll: any): any {
  let classDeclaration = getProperty(
    cstSimpleAll,
    'ordinaryCompilationUnit.typeDeclaration.classDeclaration'.split('.')
  );
  if (!classDeclaration) {
    // Get only first public class and ignore rest private classes if one file has multiple classes.
    classDeclaration = getProperty(
      cstSimpleAll,
      'ordinaryCompilationUnit.typeDeclaration.0.classDeclaration'.split('.')
    );
  }

  return classDeclaration;
}

export function rowsToFinds(rows: any[]): MethodInfoFind[] {
  const finds: MethodInfoFind[] = [];
  for (const row of rows) {
    const {
      classPath,
      className,
      implementsName,
      extendsName,
      mappingValues,
      isPublic,
      name,
      parameterCount,
      callers,
    } = row;
    const mappingValues2: string[] = JSON.parse(mappingValues);
    const isPublic2 = isPublic === 1;
    const callers2: CallerInfo[] = JSON.parse(callers);

    finds.push({
      classPath,
      className,
      implementsName,
      extendsName,
      mappingValues: mappingValues2,
      isPublic: isPublic2,
      name,
      parameterCount,
      callers: callers2,
    });
  }

  return finds;
}

function getClassInfoFromDb(classPath: string): ClassInfo | null {
  const db = configReader.db();
  const rowHeader = get(db, 'ClassInfo', 'selectHeaderInfo', { classPath });
  if (!rowHeader) {
    return null;
  }

  const rowsMethod = all(db, 'ClassInfo', 'selectMethodInfo', { classPath });

  const { name, implementsName, extendsName, annotations } = rowHeader;
  const annoHeader: Annotation[] = JSON.parse(annotations);
  const header: HeaderInfo = { classPath, name, implementsName, extendsName, annotations: annoHeader };

  const methods: MethodInfo[] = [];
  for (const row of rowsMethod) {
    const { annotations, isPublic, name, callers, parameterCount } = row;
    const annoMethod: Annotation[] = JSON.parse(annotations);
    const isPublic2 = isPublic === 1;
    const callers2: CallerInfo[] = JSON.parse(callers);

    methods.push({ annotations: annoMethod, isPublic: isPublic2, name, callers: callers2, parameterCount });
  }

  return { header, methods };
}

function insertClassInfo(
  classPath: string,
  header: {
    name: string;
    implementsName: string;
    extendsName: string;
    annotations: string;
  },
  methods: {
    annotations: string;
    isPublic: boolean;
    name: string;
    callers: string;
    parameterCount: number;
  }[]
) {
  const sqlTmpClass = `
  insert into ClassInfo
    (classPath)
  values
    ({classPath})`;
  const sqlClass = new SqlTemplate(sqlTmpClass).replace('{classPath}', classPath).toString();

  const sqlTmpHeader = `
    insert into HeaderInfo
      (classPath, name, implementsName, extendsName, annotations)
    values
      ({classPath}, {header.name}, {header.implementsName}, {header.extendsName}, {header.annotations})`;
  const sqlHeader = new SqlTemplate(sqlTmpHeader).replaceAll({ classPath, header });

  let sqlMethod = '';
  if (methods.length) {
    const sqlTmpMethod = `
    insert into MethodInfo
      (classPath, annotations, isPublic, name, callers, parameterCount)
    values
      {values}`;
    const sqlTmpValues = `({classPath}, {method.annotations}, {method.isPublic}, {method.name}, {method.callers}, {method.parameterCount})`;
    const sqlValues = new SqlTemplate(sqlTmpValues).replaceAlls(
      methods.map((method) => ({ classPath, method })),
      ',\n'
    );
    sqlMethod = sqlTmpMethod.replace('{values}', escapeDollar(sqlValues));
  }

  const sqlAll = `
  ${sqlClass};
  ${sqlHeader};
  ${sqlMethod};
  `;
  execSql(configReader.db(), sqlAll);
}

export function getClassInfo(rootDir: string, fullPath: string): ClassInfo {
  const classPath = getDbPath(rootDir, fullPath);

  const classDb = getClassInfoFromDb(classPath);
  if (!classDb) {
    throw new Error(runSaveToDbFirst);
  }

  return classDb;
}

export function saveClassInfoToDb(rootDir: string, fullPath: string): ClassInfo {
  const classPath = getDbPath(rootDir, fullPath);

  const content = readFileSyncUtf16le(fullPath);
  const cst = parse(content);

  const pathsAndImageListAll = getPathsAndImageListFromCst(cst);
  const cstSimpleAll = getSimplifiedCst(pathsAndImageListAll);
  const classDeclaration = getCstClassDeclaration(cstSimpleAll);
  const pathsAndImageList = getPathsAndImageListFromSimpleCst(classDeclaration);

  const header = getHeaderInfo(classPath, classDeclaration);
  const vars = getVars(pathsAndImageList);
  const methods = getMethods(classDeclaration, pathsAndImageList, vars);

  const headerJson = {
    name: header.name,
    implementsName: header.implementsName,
    extendsName: header.extendsName,
    annotations: JSON.stringify(header.annotations),
  };
  const methodsJson = methods.map((method) => ({
    annotations: JSON.stringify(method.annotations),
    isPublic: method.isPublic,
    name: method.name,
    callers: JSON.stringify(method.callers),
    parameterCount: method.parameterCount,
  }));
  insertClassInfo(classPath, headerJson, methodsJson);

  return { header, methods };
}

function insertMethodInfoFind(
  finds: {
    classPath: string;
    className: string;
    implementsName: string;
    extendsName: string;
    mappingValues: string;
    isPublic: boolean;
    name: string;
    parameterCount: number;
    callers: string;
  }[]
) {
  if (!finds.length) return;

  const sqlTmp = `
  insert into MethodInfoFind
    (classPath, className, implementsName, extendsName, mappingValues, isPublic, name, parameterCount, callers)
  values
    {values}`;
  const sqlTmpValues = `({classPath}, {className}, {implementsName}, {extendsName}, {mappingValues}, {isPublic}, {name}, {parameterCount}, {callers})`;
  const sqlValues = new SqlTemplate(sqlTmpValues).replaceAlls(finds, ',\n');
  const sql = sqlTmp.replace('{values}', escapeDollar(sqlValues));
  execSql(configReader.db(), sql);
}

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
export function saveMethodInfoFindToDb(classInfosMerged: ClassInfo[]): MethodInfoFind[] {
  let finds: MethodInfoFind[] = [];

  for (const classInfo of classInfosMerged) {
    const { header, methods } = classInfo;
    const { classPath, name: className, implementsName, extendsName, annotations: annotationsClass } = header;
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
        classPath,
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
      console.log(`Found duplicated method in ${classPath}: ${dupMethod}`);
    }

    finds = finds.concat(findsCur);
  }

  const findsJson = finds.map((find) => ({
    classPath: find.classPath,
    className: find.className,
    implementsName: find.implementsName,
    extendsName: find.extendsName,
    mappingValues: JSON.stringify(find.mappingValues),
    isPublic: find.isPublic,
    name: find.name,
    parameterCount: find.parameterCount,
    callers: JSON.stringify(find.callers),
  }));
  insertMethodInfoFind(findsJson);

  return finds;
}

export function getMethodInfoFinds(directory: string, filePattern: string | RegExp): MethodInfoFind[] {
  const db = configReader.db();

  let fileNameWildcard = '';
  let fileNamePattern = '';
  if (typeof filePattern === 'string') {
    fileNameWildcard = filePattern;
  } else {
    fileNamePattern = filePattern.source;
  }

  const rows = all(db, 'ClassInfo', 'selectMethodInfoFindByClassPathClassName', {
    classPathLike: directory,
    fileNameWildcard,
    fileNamePattern,
  });
  const finds = rowsToFinds(rows);
  return finds;
}
