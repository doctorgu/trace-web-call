import { statSync } from 'fs';

import { trims, trimEnd, trim } from './util';
import { config } from '../config/config';
import { runInsertToDbFirst } from './message';
import { getDbPath } from './common';
import { getStartingToObjects } from './traceHelper';
import tClassInfo from '../sqlTemplate/TClassInfo';
import tCommon from '../sqlTemplate/TCommon';
import tCache from '../sqlTemplate/TCache';
import {
  endsWith,
  endsWith2,
  getValue,
  getRBracePosition,
  getProperty,
  getRCurlyPosition,
  includes,
  includes2,
  execImages,
  getPathsAndImagesFromSimpleCst,
  indexOf,
  rangeOfImages,
  reorderBinaryOperator,
  lastRangeOfImages,
} from './cstHelper';
import { getJspViewFinds, JspView, JspViewFind } from './jspHelper';
import { configConstructor, configFunc, configVar, FuncInfo, FuncType, ignores, ValueType } from '../config/configFunc';
import { getCstSimple, PathsAndImage } from './cstSimpleHelper';

export type Keyword =
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
  | 'expressionStatement'
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
  | 'elementValuePair'
  | 'methodHeader'
  | 'result'
  | 'Return'
  | 'BinaryOperator'
  | 'localVariableDeclarationStatement'
  | 'Equals'
  | 'AssignmentOperator';

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
  returnType: string;
  name: string;
  parameterCount: number;
  callers: CallerInfo[];
  jspViews: JspView[];
};

export type MethodInfoFind = {
  classPath: string;
  className: string;
  implementsName: string;
  extendsName: string;
  mappingMethod: string;
  mappingValues: string[];
  isPublic: boolean; // !!! Need Public, Protected, Private when finding by extended
  returnType: string;
  name: string;
  parameterCount: number;
  callers: CallerInfo[];
  jspViewFinds: JspViewFind[];
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

  const blocks = pathsAndImages.filter((v, i) => i > posLBrace && i < posRBrace);
  const posMethod = blocks.findIndex(({ image }) => image === 'method');
  if (posMethod !== -1) {
    const ret = execImages(/RequestMethod\.(\w+)/, blocks, '', posMethod);
    if (ret) {
      const { match, start, end } = ret;
      method = match[1];
    }
  }

  let values: string[] = [];
  const images = blocks.map(({ image }) => image);
  const posValue = images.indexOf('value');
  const posEqual = images.indexOf('=', posValue);
  const posLCurly = images.indexOf('{', posEqual);
  if (posValue !== -1 && posEqual !== -1) {
    if (posLCurly !== -1) {
      // @RequestMapping(value={"/abc/abc5.do","/abc/abc6.do"})
      const posRCurly = getRCurlyPosition(blocks, posLCurly);
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
  values = values.map((value) => trims(value, ['"']));

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
        annotations[annotations.length - 1].values.push(trims(image, ['"']));
      }
    } else if (includes(paths, 'unannType')) {
      typeName = image;
    } else if (includes(paths, 'variableDeclaratorList')) {
      instanceName = image;
    }
  }

  return vars;
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
      stringLiteral = trims(image, ['"']);
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

function getConstructFuncVarValue(
  valueType: ValueType,
  blocks: PathsAndImage[],
  start: number,
  posSemicolon: number
): { type?: FuncType; value: JspView; end: number } | null {
  const configWhat: FuncInfo[] =
    (valueType === 'Constructor' && configConstructor) ||
    (valueType === 'Function' && configFunc) ||
    (valueType === 'Variable' && configVar) ||
    configConstructor;

  for (const func of configWhat) {
    const { type, find, skipPlusComma, replace } = func;

    const ret = rangeOfImages(blocks, start, posSemicolon, find, skipPlusComma);
    if (ret && ret.start === start) {
      const { end } = ret;
      if (typeof replace === 'string') {
        return { type, value: { name: replace, parsed: true }, end };
      } else {
        const { matches, end } = ret;
        const replaced = replace(matches);
        return { type, value: { name: replaced, parsed: true }, end };
      }
    }
  }

  return null;
}
function getValueType(
  blocks: PathsAndImage[],
  start: number,
  end: number
): { type: ValueType; value: string; end: number } {
  // new ModelAndView("abc", model);
  const findsNewClass = ['new', /^\w+$/, '('];
  const retNew = rangeOfImages(blocks, start, end, findsNewClass, true);
  if (retNew && retNew.start === start) {
    const posRBrace = getRBracePosition(blocks, retNew.end);
    if (posRBrace !== -1) {
      const start = retNew.start;
      const end = posRBrace;
      const value = blocks
        .filter((v, i) => i >= start && i <= end)
        .map(({ image }) => image)
        .join('');
      return { type: 'Constructor', value, end };
    }
  }

  // svc.get(p1, p2);
  const findsClassDotMethod = [/^\w+$/, '.', /^\w+$/, '('];
  let retFunc = rangeOfImages(blocks, start, end, findsClassDotMethod, true);
  if (!retFunc) {
    // get(p1, p2);
    const findsMethod = [/^\w+$/, '('];
    retFunc = rangeOfImages(blocks, start, end, findsMethod, true);
  }
  if (retFunc && retFunc.start === start) {
    const posRBrace = getRBracePosition(blocks, retFunc.end);
    if (posRBrace !== -1) {
      const start = retFunc.start;
      const end = posRBrace;
      const value = blocks
        .filter((v, i) => i >= start && i <= end)
        .map(({ image }) => image)
        .join('');
      return { type: 'Function', value, end };
    }
  }

  const value = blocks[start].image;
  const mLiteral = /^"([^"]*)"$/.exec(value);
  if (mLiteral) {
    return { type: 'Literal', value: trim(mLiteral[1], '"'), end: start };
  }
  const mVariable = /^\w+$/.exec(value);
  if (mVariable) {
    return { type: 'Variable', value, end: start };
  }

  return { type: 'Other', value, end: start };
}
function getValues(blocks: PathsAndImage[], start: number, posSemicolon: number): { values: JspView[]; end: number } {
  const { image } = blocks[start];
  if (ignores.has(image)) return { values: [], end: -1 };

  const { type, value, end: endMain } = getValueType(blocks, start, posSemicolon);
  if (type === 'Constructor') {
    const retConstructor = getConstructFuncVarValue(type, blocks, start, posSemicolon);
    if (retConstructor) {
      const { type: typeCon, value: valueCon, end: endCon } = retConstructor;
      if (typeCon === 'ModelAndViewWithParam') {
        const posSemicolon = blocks.findIndex(({ paths }, i) => i > start && endsWith(paths, 'Semicolon'));

        // new ModelAndView("abc", model);
        let retRBrace = lastRangeOfImages(blocks, posSemicolon, [',', /\w+/, ')', ';']);
        if (!retRBrace) {
          // new ModelAndView("abc");
          retRBrace = lastRangeOfImages(blocks, posSemicolon, [')', ';']);
        }
        if (!retRBrace) {
          throw new Error(`ModelAndView right part not found`);
        }

        const idxStart = endCon + 1;
        const idxEnd = retRBrace.start - 1;
        let values: JspView[] = [];
        for (let j = idxStart; j <= idxEnd; j++) {
          const { values: valuesSub, end: endSub } = getValues(blocks, j, posSemicolon);
          if (valuesSub.length) {
            values = cartesianTwo(values, valuesSub);
            j = endSub;
          }
        }
        // -1 to expose semicolon to getValuesByVariable
        return { values, end: retRBrace.end - 1 };
      } else {
        return { values: valueCon ? [valueCon] : [], end: endCon };
      }
    } else {
      return { values: [{ name: value, parsed: false }], end: endMain };
    }
  } else if (type === 'Function') {
    const retFunc = getConstructFuncVarValue(type, blocks, start, posSemicolon);
    if (retFunc) {
      const { value, end } = retFunc;
      return { values: value ? [value] : [], end };
    } else {
      return { values: [{ name: value, parsed: false }], end: endMain };
    }
  } else if (type === 'Variable') {
    const retVar = getConstructFuncVarValue(type, blocks, start, posSemicolon);
    if (retVar) {
      const { value, end } = retVar;
      return { values: value ? [value] : [], end };
    } else {
      const values = getValuesByVariable(blocks, start, posSemicolon, value);
      return { values, end: endMain };
    }
  } else if (type === 'Literal') {
    return { values: value ? [{ name: value, parsed: true }] : [], end: endMain };
  } else if (type === 'Other') {
    return { values: [{ name: value, parsed: false }], end: endMain };
  }

  throw new Error(`Wrong type: ${type}`);
}
function getValuesByVariable(
  blocks: PathsAndImage[],
  posVar: number,
  posSemicolon: number,
  varName: string
): JspView[] {
  // String viewNm = "/mobile/dp/Etv";
  // {paths:["localVariableDeclarationStatement","localVariableDeclaration","localVariableType","unannType","unannReferenceType","unannClassOrInterfaceType","unannClassType","Identifier",],image:"String",},
  // {paths:["localVariableDeclarationStatement","localVariableDeclaration","variableDeclaratorList","variableDeclarator","variableDeclaratorId","Identifier",],image:"viewNm",},
  // {paths:["localVariableDeclarationStatement","localVariableDeclaration","variableDeclaratorList","variableDeclarator","Equals",],image:"=",},
  // {paths:["localVariableDeclarationStatement","localVariableDeclaration","variableDeclaratorList","variableDeclarator","variableInitializer","expression","ternaryExpression","binaryExpression","unaryExpression","primary","primaryPrefix","literal","StringLiteral",],image:"\"/mobile/dp/Etv\"",},
  // {paths:["localVariableDeclarationStatement","Semicolon",],image:";",}

  // viewNm = "/mobile/dp/Etv";
  // {paths:["expressionStatement","statementExpression","expression","ternaryExpression","binaryExpression","unaryExpression","primary","primaryPrefix","fqnOrRefType","fqnOrRefTypePartFirst","fqnOrRefTypePartCommon","Identifier",],image:"viewNm",},
  // {paths:["expressionStatement","statementExpression","expression","ternaryExpression","binaryExpression","AssignmentOperator",],image:"=",},
  // {paths:["expressionStatement","statementExpression","expression","ternaryExpression","binaryExpression","expression","ternaryExpression","binaryExpression","unaryExpression","primary","primaryPrefix","literal","StringLiteral",],image:"\"/mobile/dp/Etv\"",},
  // {paths:["expressionStatement","Semicolon",],image:";",}

  let equalFound = false;
  let valuesAll: JspView[] = [];
  let values: JspView[] = [];
  for (let i = 0; i < posVar; i++) {
    const { paths, image } = blocks[i];
    const { paths: pathsNext, image: imageNext } = blocks[i + 1];

    const declare = !equalFound && includes(paths, 'localVariableDeclarationStatement');
    const assign = !equalFound && includes(paths, 'expressionStatement');

    if (
      (declare || assign) &&
      image === varName &&
      (endsWith(pathsNext, 'Equals') || endsWith(pathsNext, 'AssignmentOperator'))
    ) {
      equalFound = true;
      i++;
    } else if (equalFound && !endsWith(paths, 'Semicolon')) {
      const { values: valuesSub, end: endSub } = getValues(blocks, i, posSemicolon);
      if (valuesSub.length) {
        values = cartesianTwo(values, valuesSub);
        i = endSub;
      }
    } else if (endsWith(paths, 'Semicolon')) {
      equalFound = false;

      valuesAll = valuesAll.concat(values);
      values = [];
    }
  }

  return valuesAll;
}
function cartesianTwo(values: JspView[], valuesSub: JspView[]): JspView[] {
  const valuesNew: JspView[] = [];

  if (values.length === 0) {
    values.push({ name: '', parsed: true });
  }
  for (let i = 0; i < values.length; i++) {
    const valueCur = values[i];

    for (let j = 0; j < valuesSub.length; j++) {
      const valueSubCur = valuesSub[j];

      const valueNew = mergeName(valueCur, valueSubCur);
      valuesNew.push(valueNew);
    }
  }

  return valuesNew;
}
function mergeName(value1: JspView, value2: JspView): JspView {
  const parsed = value1.parsed && value2.parsed;
  return { name: `${value1.name}${value2.name}`, parsed };
}
function getValuesInReturn(blocks: PathsAndImage[], posReturn: number): JspView[] {
  let values: JspView[] = [];

  const posSemicolon = blocks.findIndex(({ paths }, i) => i > posReturn && endsWith(paths, 'Semicolon'));

  const { values: valuesSub } = getValues(blocks, posReturn + 1, posSemicolon);
  if (valuesSub.length) {
    values = cartesianTwo(values, valuesSub);
  } else {
    const name = blocks
      .filter((v, i) => i > posReturn && i < posSemicolon)
      .map(({ image }) => image)
      .join(' ');
    values.push({ name, parsed: false });
  }

  const posReturnSub = blocks.findIndex(({ paths }, i) => i > posSemicolon && endsWith(paths, 'Return'));
  if (posReturnSub !== -1) {
    const valuesSub = getValuesInReturn(blocks, posReturnSub);
    if (valuesSub.length) {
      values = values.concat(valuesSub);
    }
  }

  return values;
}
function getJspViews(methodDecls: PathsAndImage[], posLCurly: number, posRCurly: number): JspView[] {
  const methodBlocks = methodDecls.filter((v, i) => i > posLCurly && i < posRCurly);

  const posReturn = methodBlocks.findIndex(({ paths }) => endsWith(paths, 'Return'));
  if (posReturn === -1) {
    // throw new Exception case
    return [];
  }
  const jspViews = getValuesInReturn(methodBlocks, posReturn);
  const jspViewsUnique = jspViews.reduce(
    (prev: JspView[], cur: JspView) => (!prev.some((jspView) => jspView.name === cur.name) ? [...prev, cur] : prev),
    []
  );
  return jspViewsUnique;
}

function getMethods(cstSimple: any, pathsAndImageList: PathsAndImage[], vars: VarInfo[]): MethodInfo[] {
  const methodDecls = pathsAndImageList.filter(({ paths, image }) => includes(paths, 'methodDeclaration'));

  const methods: MethodInfo[] = [];
  let mapping: Mapping = { method: '', values: [] };
  let isPublic = false;
  let returnType = '';
  let methodName = '';
  let parameterCount = 0;
  let callers: CallerInfo[] = [];
  let jspViews: JspView[] = [];

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
    } else if (includes(paths, 'methodDeclaration', 'methodHeader', 'result')) {
      // ResponseEntity<?> will return 'ResponseEntity', '<', '?', '>'
      returnType += image;
    } else if (endsWith(paths, 'methodDeclarator', 'Identifier')) {
      methodName = image;
    } else if (endsWith(paths, 'LCurly') && methodName) {
      const posLCurly = i;
      const posRCurly = getRCurlyPosition(methodDecls, posLCurly);
      callers = getCallerInfos(cstSimple, methodDecls, vars, posLCurly, posRCurly);
      if (returnType === 'ModelAndView' || returnType === 'View') {
        jspViews = getJspViews(methodDecls, posLCurly, posRCurly);
      }

      methods.push({ mapping, isPublic, returnType, name: methodName, parameterCount, callers, jspViews });

      mapping = { method: '', values: [] };
      isPublic = false;
      returnType = '';
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
      returnType,
      name,
      parameterCount,
      callers,
      jspViewFinds,
    } = row;
    const mappingValues2: string[] = JSON.parse(mappingValues);
    const isPublic2 = isPublic === 1;
    const callers2: CallerInfo[] = JSON.parse(callers);
    const jspViewFinds2: JspViewFind[] = JSON.parse(jspViewFinds);

    finds.push({
      classPath,
      className,
      implementsName,
      extendsName,
      mappingMethod,
      mappingValues: mappingValues2,
      isPublic: isPublic2,
      returnType,
      name,
      parameterCount,
      callers: callers2,
      jspViewFinds: jspViewFinds2,
    });
  }

  return finds;
}

export function getClassInfoFromDb(rootDir: string, fullPath: string): ClassInfo {
  const classPath = getDbPath(rootDir, fullPath);

  const rowHeader = tClassInfo.selectHeaderInfo(classPath);
  if (!rowHeader) {
    throw new Error(runInsertToDbFirst);
  }

  const rowsMethod = tClassInfo.selectMethodInfo(classPath);

  const { name, implementsName, extendsName, mapping: mappingHeader } = rowHeader;
  const header: HeaderInfo = { name, implementsName, extendsName, mapping: JSON.parse(mappingHeader) };

  const methods: MethodInfo[] = [];
  for (const row of rowsMethod) {
    const { mapping, isPublic, returnType, name, parameterCount, callers, jspViews } = row;
    const mapping2: Mapping = JSON.parse(mapping);
    const isPublic2 = isPublic === 1;
    const callers2: CallerInfo[] = JSON.parse(callers);
    const jspViews2: JspView[] = JSON.parse(jspViews);

    methods.push({
      mapping: mapping2,
      isPublic: isPublic2,
      returnType,
      name,
      parameterCount,
      callers: callers2,
      jspViews: jspViews2,
    });
  }

  return { classPath, header, methods };
}

function getCstSimpleFromDb(fullPath: string): any {
  try {
    const path = getDbPath(config.path.source.rootDir, fullPath);
    const mtime = statSync(fullPath).mtime;

    const cstSimpleFromDb = tCache.selectCstSimpleByMtime(path, mtime);
    if (cstSimpleFromDb) {
      return JSON.parse(cstSimpleFromDb);
    }

    const cstSimple = getCstSimple(fullPath);
    tCache.insertCstSimple(path, mtime, cstSimple);

    return cstSimple;
  } catch (ex) {
    console.error(fullPath);
    throw new Error(ex);
  }
}

export function getClassInfo(fullPath: string): {
  header: HeaderInfo;
  vars: VarInfo[];
  methods: MethodInfo[];
} {
  const cstSimple = getCstSimpleFromDb(fullPath);
  // const cstSimple = getCstSimple(fullPath);
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
function getMethodInfoFinds(jspPaths: string[], classInfosMerged: ClassInfo[]): MethodInfoFind[] {
  let finds: MethodInfoFind[] = [];

  for (const classInfo of classInfosMerged) {
    const { classPath, header, methods } = classInfo;
    const { name: className, implementsName, extendsName, mapping: mappingClass } = header;
    const findsCur = methods.map(({ mapping, isPublic, returnType, name, parameterCount, callers, jspViews }) => {
      const methodRoot = mappingClass.method;
      const mappingRoot = mappingClass.values?.[0] || '';

      const mappingMethod = mapping.method || methodRoot;
      const mappingValues = mapping.values.map((value) => `${mappingRoot}${value}`);

      const jspViewFinds = getJspViewFinds(jspViews, jspPaths);

      return {
        classPath,
        className,
        implementsName,
        extendsName,
        mappingMethod,
        mappingValues,
        isPublic,
        returnType,
        name,
        parameterCount,
        callers,
        jspViewFinds,
      };
    });

    const dupMethod = getDupMethod(findsCur);
    if (dupMethod) {
      // throw new Error(`Found duplicated method: ${foundDup[0]}`);
      // console.log(`Found duplicated method in ${classPath}: ${dupMethod}`);
    }

    finds = finds.concat(findsCur);
  }

  return finds;
}

export function insertMethodInfoFindKeyName(
  keyName: string,
  jspPaths: string[],
  classInfosMerged: ClassInfo[]
): MethodInfoFind[] {
  const finds = getMethodInfoFinds(jspPaths, classInfosMerged);

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

export function insertRouteTableKeyName() {
  const directoriesDep: string[] = config.path.source.dependency.map(({ service: { directory } }) => directory);
  const directoriesXmlDep: string[] = config.path.source.dependency.map(({ xml }) => xml);

  for (let i = 0; i < config.path.source.main.length; i++) {
    const {
      startings: { directory, file },
      keyName,
      service,
      xml,
    } = config.path.source.main[i];

    const findsStarting = getFindsByClassPathClassNameFromDb(keyName, directory, file);

    const directories = [service.directory];
    const directoriesXml = [xml];

    console.log(`getStartingToTables`);
    const routesAll = getStartingToObjects(
      keyName,
      findsStarting,
      directories.concat(directoriesDep),
      directoriesXml.concat(directoriesXmlDep),
      config.startingPoint
    );

    const routesCur = routesAll
      .map((routes, i) => {
        return routes.map((route) => ({ groupSeq: i, ...route }));
      })
      .flat();
    if (!routesCur.length) {
      continue;
    }
    console.log(`insertRouteTableKeyName`);
    tCommon.insertRouteTableKeyName(keyName, routesCur);
  }
}
