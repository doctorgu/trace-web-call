import { parse } from 'java-parser';
import { exec as execProc } from 'child_process';
import { statSync } from 'fs';
import { promisify } from 'util';
import { fromFileSync } from 'hasha';

import { readFileSyncUtf16le, trimList, trimEnd } from './util';
import { SqlTemplate } from '../common/sqliteHelper';
import { config } from '../config/config';
import { configReader } from '../config/configReader';
import { runinsertToDbFirst } from './message';
import { getDbPath } from './common';
import { getStartingToTables, RouteInfo } from './traceHelper';
import tClassInfo from '../sqlTemplate/TClassInfo';
import tCommon from '../sqlTemplate/TCommon';
import tCache from '../sqlTemplate/TCache';

const runExec = promisify(execProc);

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
  | 'Public'
  | 'elementValuePair';

type PathsAndImage = {
  paths: string[];
  image: string;
};

export type Mapping = {
  method: string;
  values: string[];
};

export type VarInfo = {
  annotations: Mapping[];
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
  mapping: Mapping;
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
  mappingMethod: string;
  mappingValues: string[];
  isPublic: boolean; // !!! Need Public, Protected, Private when finding by extended
  name: string;
  parameterCount: number;
  callers: CallerInfo[];
};

export type HeaderInfo = {
  name: string;
  implementsName: string;
  extendsName: string;
  mapping: Mapping;
};

export type ClassInfo = {
  classPath: string;
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
function getPathsAndImagesFromSimpleCst(parent: any) {
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

function exec(r: RegExp, paths: string[], index: number = 0) {
  const value = paths.filter((v, i) => i >= index).join('');
  return r.exec(value);
}

function getMapping(
  mappingName: string,
  pathsAndImages: PathsAndImage[],
  posMapping: number
): { mapping: Mapping; posRBrace: number } | null {
  const posLBrace = posMapping + 1;
  const { paths } = pathsAndImages[posLBrace];
  if (!endsWith(paths, 'LBrace')) {
    return null;
  }
  const posRBrace = getRBracePosition(pathsAndImages, posLBrace);

  let method = '';
  // PostMapping, GetMapping...
  if (mappingName !== 'RequestMapping') {
    method = trimEnd(mappingName, 'Mapping').toUpperCase();
  }

  const list = pathsAndImages.filter((v, i) => i > posLBrace && i < posRBrace);
  const images = list.map(({ image }) => image);
  const posMethod = images.indexOf('method');
  if (posMethod !== -1) {
    const m = exec(/RequestMethod\.(\w+)/, images, posMethod);
    if (m) {
      method = m[1];
    }
  }

  let values: string[] = [];
  const posValue = images.indexOf('value');
  const posEqual = images.indexOf('=', posValue);
  const posLCurly = images.indexOf('{', posEqual);
  if (posValue !== -1 && posEqual !== -1) {
    if (posLCurly !== -1) {
      // @RequestMapping(value={"/abc/abc5.do","/abc/abc6.do"})
      const posRCurly = getRCurlyPosition(list, posLCurly);
      values = images.filter((v, i) => i > posLCurly && i < posRCurly && v !== ',').map((v) => v);
    } else {
      // @RequestMapping(value = "/abc/abc2.do")
      values = [images[posEqual + 1]];
    }
  } else {
    // @RequestMapping("/abc/abc.do")
    // @RequestMapping({"/abc/abc.do", "/abc/abc2.do"})
    values = images.filter((v) => v !== '{' && v !== '}' && v !== ',').map((v) => v);
  }
  values = values.map((value) => trimList(value, '"'));

  return { mapping: { method, values }, posRBrace };
}

function getHeaderInfo(classDeclaration: any): HeaderInfo {
  const classModifier = getProperty(classDeclaration, 'classModifier'.split('.'));
  let mapping: Mapping = { method: '', values: [] };
  if (classModifier !== null) {
    const pathsAndImages = getPathsAndImagesFromSimpleCst(classModifier);
    for (let i = 0; i < pathsAndImages.length; i++) {
      const { paths, image } = pathsAndImages[i];

      if (endsWith(paths, 'annotation', 'typeName', 'Identifier') && image.endsWith('Mapping')) {
        const ret = getMapping(image, pathsAndImages, i);
        if (ret) {
          mapping = ret.mapping;
          i = ret.posRBrace;
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

  return { name, implementsName, extendsName, mapping };
}

function getVars(pathsAndImageList: PathsAndImage[]): VarInfo[] {
  const fieldDecls = pathsAndImageList.filter(({ paths, image }) => includes(paths, 'fieldDeclaration'));

  const vars: VarInfo[] = [];
  let annotations: Mapping[] = [];
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
        annotations.push({ method: image, values: [] });
      } else if (endsWith(paths, 'StringLiteral')) {
        annotations[annotations.length - 1].values.push(trimList(image, '"'));
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
      stringLiteral = trimList(image, '"');
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
  let mapping: Mapping = { method: '', values: [] };
  let isPublic = false;
  let methodName = '';
  let parameterCount = 0;
  let callers: CallerInfo[] = [];
  for (let i = 0; i < methodDecls.length; i++) {
    const { paths, image } = methodDecls[i];

    // RequestMapping, PostMapping, GetMapping
    if (endsWith(paths, 'annotation', 'typeName', 'Identifier') && image.endsWith('Mapping')) {
      const ret = getMapping(image, methodDecls, i);
      if (ret) {
        mapping = ret.mapping;
        i = ret.posRBrace;
      }
    } else if (includes(paths, 'methodDeclaration', 'methodModifier') && endsWith(paths, 'Public')) {
      isPublic = true;
    } else if (endsWith(paths, 'methodDeclarator', 'Identifier')) {
      methodName = image;
    } else if (endsWith(paths, 'LCurly') && methodName) {
      const posLCurly = i;
      const posRCurly = getRCurlyPosition(methodDecls, posLCurly);
      callers = getCallerInfos(cstSimple, methodDecls, vars, posLCurly, posRCurly);

      methods.push({ mapping, isPublic, name: methodName, parameterCount, callers });

      mapping = { method: '', values: [] };
      isPublic = false;
      methodName = '';
      callers = [];

      i = posRCurly;
    } else if (endsWith(paths, 'LBrace') && methodName) {
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
      mappingMethod,
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
      mappingMethod,
      mappingValues: mappingValues2,
      isPublic: isPublic2,
      name,
      parameterCount,
      callers: callers2,
    });
  }

  return finds;
}

export function getClassInfoFromDb(rootDir: string, fullPath: string): ClassInfo {
  const classPath = getDbPath(rootDir, fullPath);

  const rowHeader = tClassInfo.selectHeaderInfo(classPath);
  if (!rowHeader) {
    throw new Error(runinsertToDbFirst);
  }

  const rowsMethod = tClassInfo.selectMethodInfo(classPath);

  const { name, implementsName, extendsName, mapping: mappingHeader } = rowHeader;
  const header: HeaderInfo = { name, implementsName, extendsName, mapping: JSON.parse(mappingHeader) };

  const methods: MethodInfo[] = [];
  for (const row of rowsMethod) {
    const { mapping, isPublic, name, callers, parameterCount } = row;
    const mapping2: Mapping = JSON.parse(mapping);
    const isPublic2 = isPublic === 1;
    const callers2: CallerInfo[] = JSON.parse(callers);

    methods.push({ mapping: mapping2, isPublic: isPublic2, name, callers: callers2, parameterCount });
  }

  return { classPath, header, methods };
}

// async function getSha1UsingGit(fullPath: string): Promise<string> {
//   const cmd = `git hash-object ${fullPath}`;
//   const { stdout, stderr } = await runExec(cmd);
//   if (stderr) {
//     throw new Error(`${cmd} ${stderr}`);
//   }
//   return stdout;
// }

function getCstSimple(fullPath: string): any {
  const content = readFileSyncUtf16le(fullPath);
  const cst = parse(content);

  const pathsAndImageListAll = getPathsAndImageListFromCst(cst);
  const cstSimple = getSimplifiedCst(pathsAndImageListAll);
  return cstSimple;
}

function getCstSimpleFromDbCache(fullPath: string): { cstSimple: any; sha1: string } | null {
  const sha1 = fromFileSync(fullPath, { algorithm: 'sha1' });
  const cstSimpleFromDb = tCache.selectCstSimpleBySha1(sha1);
  if (cstSimpleFromDb) {
    return JSON.parse(cstSimpleFromDb);
  }

  const cstSimple = getCstSimple(fullPath);
  const path = getDbPath(config.path.source.rootDir, fullPath);
  tCache.insertCstSimple(sha1, path, cstSimple);

  return cstSimple;
}

export function getClassInfo(fullPath: string): {
  header: HeaderInfo;
  vars: VarInfo[];
  methods: MethodInfo[];
} {
  const cstSimple = getCstSimpleFromDbCache(fullPath);
  const classDeclaration = getCstClassDeclaration(cstSimple);
  const pathsAndImageList = getPathsAndImagesFromSimpleCst(classDeclaration);

  const header = getHeaderInfo(classDeclaration);
  const vars = getVars(pathsAndImageList);
  const methods = getMethods(classDeclaration, pathsAndImageList, vars);

  return { header, vars, methods };
}

export function insertClassInfo(rootDir: string, fullPath: string): ClassInfo | null {
  const classPath = getDbPath(rootDir, fullPath);

  const rowClass = tClassInfo.selectClassInfo(classPath);
  if (rowClass) {
    return null;
  }

  const { header, vars, methods } = getClassInfo(fullPath);

  tClassInfo.insertClassInfo(classPath, header, methods);

  return { classPath, header, methods };
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
function getMethodInfoFinds(classInfosMerged: ClassInfo[]): MethodInfoFind[] {
  let finds: MethodInfoFind[] = [];

  for (const classInfo of classInfosMerged) {
    const { classPath, header, methods } = classInfo;
    const { name: className, implementsName, extendsName, mapping: mappingClass } = header;
    const findsCur = methods.map(({ mapping, isPublic, name, parameterCount, callers }) => {
      const methodRoot = mappingClass.method;
      const mappingRoot = mappingClass.values?.[0] || '';

      const mappingMethod = mapping.method || methodRoot;
      const mappingValues = mapping.values.map((value) => `${mappingRoot}${value}`);

      return {
        classPath,
        className,
        implementsName,
        extendsName,
        mappingMethod,
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

  return finds;
}

export function insertMethodInfoFindKeyName(keyName: string, classInfosMerged: ClassInfo[]): MethodInfoFind[] {
  const finds = getMethodInfoFinds(classInfosMerged);

  tClassInfo.insertMethodInfoFindKeyName(keyName, finds);

  return finds;
}

export function getFindsByKeyNameFromDb(keyName: string): MethodInfoFind[] {
  const rows = tClassInfo.selectMethodInfoFindByKeyName(keyName);
  const finds = rowsToFinds(rows);
  return finds;
}

export function getFindsByClassPathClassNameFromDb(
  keyName: string,
  directory: string,
  filePattern: string | RegExp
): MethodInfoFind[] {
  const db = configReader.db();

  let fileNameWildcard = '';
  let fileNamePattern = '';
  if (typeof filePattern === 'string') {
    fileNameWildcard = filePattern;
  } else {
    fileNamePattern = filePattern.source;
  }

  const rows = tClassInfo.selectMethodInfoFindByClassPathClassName(
    keyName,
    directory,
    fileNameWildcard,
    fileNamePattern
  );
  const finds = rowsToFinds(rows);
  return finds;
}

export function insertRouteInfoKeyName() {
  const directoriesDep: string[] = config.path.source.dependency.map(({ service: { directory } }) => directory);
  const directoriesXmlDep: string[] = config.path.source.dependency.map(({ xml }) => xml);

  for (let i = 0; i < config.path.source.main.length; i++) {
    const {
      startings: { directory, file },
      serviceAndXmls,
      keyName,
    } = config.path.source.main[i];

    const findsStarting = getFindsByClassPathClassNameFromDb(keyName, directory, file);

    const directories = serviceAndXmls.map(({ service: { directory } }) => directory);
    const directoriesXml = serviceAndXmls.map(({ xml }) => xml);

    console.log(`getStartingToTables`);
    const startToTables = getStartingToTables(
      keyName,
      findsStarting,
      directories.concat(directoriesDep),
      directoriesXml.concat(directoriesXmlDep),
      config.startingPoint
    );

    const routesCur = startToTables
      .map(({ routes }, i) => {
        return routes.map((route) => ({ groupSeq: i, ...route }));
      })
      .flat();
    if (!routesCur.length) {
      continue;
    }
    console.log(`insertRouteInfoKeyName`);
    tCommon.insertRouteInfoKeyName(keyName, routesCur);
  }
}
