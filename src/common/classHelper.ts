import { parse } from 'java-parser';
import { getClosingPosition, removeCommentSql, trimSpecific } from './util';

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
  | 'literal'
  | 'This';

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
  stringLiteral: string;
};

type MethodInfo = {
  annotations: Annotation[];
  name: string;
  callers: CallerInfo[];
};

export type MethodInfoFind = {
  className: string;
  implementsName: string;
  mappingValues: string[];
  name: string;
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
// function endsWithSeparator(paths: string[]): boolean {
//   return endsWith(paths, 'LCurly') || endsWith(paths, 'RCurly') || endsWith(paths, 'Semicolon');
// }

function getClassHeader(cst2: any): ClassHeader {
  const classDeclaration = getProperty(cst2, 'ordinaryCompilationUnit.typeDeclaration.classDeclaration'.split('.'));

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

  // const className = getImageValue(classDeclarations[0], 'normalClassDeclaration.typeIdentifier.Identifier');
  // const extendsName = getImageValue(classDeclarations[0], 'normalClassDeclaration.superclass.classType.Identifier');
  // const implementsName = getImageValue(
  //   classDeclarations[0],
  //   'normalClassDeclaration.superinterfaces.interfaceTypeList.interfaceType.classType.Identifier'
  // );
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

function getCallerInfos(
  methodDecls: PathsAndImage[],
  vars: VarInfo[],
  posLCurly: number,
  posRCurly: number,
  callerOnlyInVars: boolean
): CallerInfo[] {
  let step = 0;

  const STEP_00_NONE = 0;
  const STEP_01_FIRST = 1;
  const STEP_14_LBraceAfterFirst = 14;
  const STEP_15_StringLiteral = 15;

  const STEP_02_DOT = 2;
  const STEP_03_REST = 3;
  const STEP_04_LBraceAfterRest = 4;
  const STEP_05_StringLiteral = 5;

  const callers: CallerInfo[] = [];

  let typeName = '';
  let firstName = '';
  let restName = '';

  const list = methodDecls.filter((v, i) => i >= posLCurly && i <= posRCurly);
  for (let i = 0; i < list.length; i++) {
    const { paths, image } = list[i];

    // 'primary', 'primarySuffix' can be array or not
    const includesPrimarySuffix = includes(paths, 'primary', 'primarySuffix');

    if (
      (endsWith(
        paths,
        'primary',
        'primaryPrefix',
        'fqnOrRefType',
        'fqnOrRefTypePartFirst',
        'fqnOrRefTypePartCommon',
        'Identifier'
      ) ||
        endsWith(paths, 'primary', 'primaryPrefix', 'This')) &&
      step === STEP_00_NONE
    ) {
      if (callerOnlyInVars) {
        const varByInstance = vars.find(({ instanceName }) => instanceName === image);
        if (varByInstance) {
          step = STEP_01_FIRST;
          typeName = varByInstance.typeName;
        }
      } else {
        step = STEP_01_FIRST;
      }
    } else if (endsWith(paths, 'Dot') && step === STEP_01_FIRST) {
      step = STEP_02_DOT;
    } else if (includesPrimarySuffix && endsWith(paths, 'methodInvocationSuffix', 'LBrace')) {
      if (step === STEP_01_FIRST) {
        step = STEP_14_LBraceAfterFirst;
      } else if (step === STEP_03_REST) {
        step = STEP_04_LBraceAfterRest;
      }
    } else if (includes(paths, 'primary') && endsWith(paths, 'Identifier') && step === STEP_02_DOT) {
      step = STEP_03_REST;
    } else if (endsWith(paths, 'primary', 'primaryPrefix', 'literal', 'StringLiteral')) {
      if (step === STEP_04_LBraceAfterRest) {
        step = STEP_05_StringLiteral;
      } else if (step === STEP_14_LBraceAfterFirst) {
        step = STEP_15_StringLiteral;
      }
    } else {
      step = STEP_00_NONE;
    }

    if (step === STEP_01_FIRST) {
      firstName = image;
    } else if (step === STEP_03_REST) {
      restName = image;
    } else if (step === STEP_04_LBraceAfterRest) {
      callers.push({ typeName, instanceName: firstName, methodName: restName, stringLiteral: '' });
      typeName = '';
      firstName = '';
      restName = '';
    } else if (step === STEP_14_LBraceAfterFirst) {
      callers.push({ typeName: '', instanceName: '', methodName: firstName, stringLiteral: '' });
      typeName = '';
      firstName = '';
      restName = '';
    } else if (step === STEP_05_StringLiteral || step === STEP_15_StringLiteral) {
      // stringLiteral can be 1 more but only save not empy string because it is only needed for SQL id.
      const stringLiteral = trimSpecific(image, '"');
      if (stringLiteral) {
        callers[callers.length - 1].stringLiteral = stringLiteral;
      }
    }
  }

  return callers;
}

function getMethods(pathsAndImageList: PathsAndImage[], vars: VarInfo[], callerOnlyInVars: boolean): MethodInfo[] {
  const methodDecls = pathsAndImageList.filter(({ paths, image }) => includes(paths, 'methodDeclaration'));

  const methods: MethodInfo[] = [];
  let annotations: Annotation[] = [];
  let methodName = '';
  let callers: CallerInfo[] = [];
  for (let i = 0; i < methodDecls.length; i++) {
    const { paths, image } = methodDecls[i];

    if (includes(paths, 'annotation')) {
      if (endsWith(paths, 'typeName', 'Identifier')) {
        annotations.push({ name: image, values: [] });
      } else if (endsWith(paths, 'StringLiteral')) {
        annotations[annotations.length - 1].values.push(trimSpecific(image, '"'));
      }
    } else if (includes(paths, 'methodDeclarator', 'Identifier')) {
      methodName = image;
    } else if (includes(paths, 'LCurly')) {
      const posLCurly = i;
      const posRCurly = getRCurlyPosition(methodDecls, posLCurly);
      callers = getCallerInfos(methodDecls, vars, posLCurly, posRCurly, callerOnlyInVars);

      methods.push({ annotations, name: methodName, callers });

      annotations = [];
      methodName = '';
      callers = [];

      i = posRCurly;
    }
  }

  return methods;
}

export function getClassInfo(content: string, callerOnlyInVars: boolean): ClassInfo {
  const cst = parse(content);

  const pathsAndImageList = getPathsAndImageListFromCst(cst);
  const cst2 = getSimplifiedCst(pathsAndImageList);

  const classHeader = getClassHeader(cst2);
  const vars = getVars(pathsAndImageList);
  const methods = getMethods(pathsAndImageList, vars, callerOnlyInVars);

  return { classHeader, vars, methods };
}
