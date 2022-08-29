import { parse } from 'java-parser';
import { findLastIndex, trimSpecific } from './util';

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
  | 'unaryExpressionNotPlusMinus';

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

type MethodInfo = {
  annotations: Annotation[];
  name: string;
  callers: CallerInfo[];
  parameterCount: number;
};

export type MethodInfoFind = {
  className: string;
  implementsName: string;
  extendsName: string;
  mappingValues: string[];
  name: string;
  parameterCount: number;
  callers: CallerInfo[];
};

type ClassHeader = {
  name: string;
  implementsName: string;
  extendsName: string;
  annotations: Annotation[];
};

export type ClassInfo = {
  classHeader: ClassHeader;
  vars: VarInfo[];
  methods: MethodInfo[];
};

function getProperty(parent: any, paths: string[]): any {
  const kvList = Object.entries(parent);
  for (let i = 0; i < kvList.length; i += 1) {
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
  for (let i = 0; i < kvList.length; i += 1) {
    const [key, value] = kvList[i];

    const prop = children[key];

    if (Array.isArray(value) && value.length) {
      const useIndex = value.length > 1;
      for (let i = 0; i < value.length; i += 1) {
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

function getClassHeader(classDeclaration: any): ClassHeader {
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

  return { name, implementsName, extendsName, annotations };
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

  for (let i = posLCurly + 1; i < methodDecls.length; i += 1) {
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

  for (let i = posLBrace + 1; i < pathsAndImages.length; i += 1) {
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
    } else if (endsWith(paths, 'methodDeclarator', 'Identifier')) {
      methodName = image;
    } else if (endsWith(paths, 'LBrace')) {
      const posLBrace = i;
      const posRBrace = getRBracePosition(methodDecls, posLBrace);
      const rangeBrace = methodDecls.filter((v, i) => i > posLBrace && i < posRBrace);
      parameterCount = getParameterCount(cstSimple, rangeBrace, true);
    } else if (endsWith(paths, 'LCurly')) {
      const posLCurly = i;
      const posRCurly = getRCurlyPosition(methodDecls, posLCurly);
      callers = getCallerInfos(cstSimple, methodDecls, vars, posLCurly, posRCurly);

      methods.push({ annotations, name: methodName, parameterCount, callers });

      annotations = [];
      methodName = '';
      callers = [];

      i = posRCurly;
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

export function getClassInfo(content: string): ClassInfo {
  const cst = parse(content);

  const pathsAndImageListAll = getPathsAndImageListFromCst(cst);
  const cstSimpleAll = getSimplifiedCst(pathsAndImageListAll);
  const classDeclaration = getCstClassDeclaration(cstSimpleAll);
  const pathsAndImageList = getPathsAndImageListFromSimpleCst(classDeclaration);

  const classHeader = getClassHeader(classDeclaration);
  const vars = getVars(pathsAndImageList);
  const methods = getMethods(classDeclaration, pathsAndImageList, vars);

  return { classHeader, vars, methods };
}
