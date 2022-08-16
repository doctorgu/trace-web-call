import { parse } from 'java-parser';
import { getClosingPosition } from './util';

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
  | 'literal';

type PathsAndImage = {
  paths: string[];
  image: string;
};

type Annotation = {
  name: string;
  value: string;
};

type VarInfo = {
  annotations: Annotation[];
  typeName: string;
  instanceName: string;
};

type CallerInfo = {
  instanceName: string;
  methodName: string;
  stringLiteral: string;
};

type MethodInfo = {
  annotations: Annotation[];
  name: string;
  callers: CallerInfo[];
};

function getItemByPath(parent: any, paths: string[]): any[] {
  const children = parent.children;
  if (!children) return [];

  const kvList = Object.entries(children);
  for (let i = 0; i < kvList.length; i += 1) {
    const [key, value] = kvList[i];

    if (paths[0] !== key) continue;

    const prop = children[key];
    paths.shift();
    if (paths.length === 0) {
      return prop;
    }

    if (Array.isArray(value) && value.length) {
      let child = prop[0];

      const index = Number.parseInt(paths[0]);
      if (!isNaN(index)) {
        if (index >= value.length) throw new Error(`index: ${index} is larger than value.length: ${value.length}`);

        child = prop[index];
        paths.shift();
      }

      return getItemByPath(child, paths);
    }
  }

  return [];
}

function getImageValue(parent: any, pathDotSeparated: string): string {
  const paths = pathDotSeparated.split('.');

  const imageParents = getItemByPath(parent, paths);
  if (!imageParents) return '';

  const image = imageParents[0].image;
  return image;
}

function getAllValueAndPaths(parent: any, paths: string[], pathsAndImageList: PathsAndImage[]): void {
  const children = parent.children;
  const image = parent.image;
  // All leaf property name which has value is always 'image', so do not add 'image' to paths
  if (image) {
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
        getAllValueAndPaths(prop[i], pathsNew, pathsAndImageList);
      }
    }
  }
}

function getAllValues(parent: any): string[] {
  const paths: string[] = [];
  const pathsAndImageList: PathsAndImage[] = [];
  getAllValueAndPaths(parent, paths, pathsAndImageList);

  const pathsRet = pathsAndImageList.map(({ image }) => image);
  return pathsRet;
}

// modifiers: FieldModifiers or MethodModifiers
function getAnnotations(modifiers: any[]): Annotation[] {
  const annotations: Annotation[] = [];

  for (let nMod = 0; nMod < modifiers.length; nMod += 1) {
    const modifier = modifiers[nMod];
    // GetMapping
    const name = getImageValue(modifier, 'annotation.typeName.Identifier');
    if (name) {
      // "/api/manual/v1/categoryhandler"
      const value = getImageValue(
        modifier,
        'annotation.elementValue.expression.ternaryExpression.binaryExpression.unaryExpression.primary.primaryPrefix.literal.StringLiteral'
      );

      annotations.push({ name, value });
    }
  }

  return annotations;
}

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
  let index = paths.indexOf(finds[0]);
  if (index === -1) return false;

  for (let i = 1; i < finds.length; i++) {
    index++;
    if (finds[i] !== paths[index]) return false;
  }

  return true;
}
function endsWithSeparator(paths: string[]): boolean {
  return endsWith(paths, 'LCurly') || endsWith(paths, 'RCurly') || endsWith(paths, 'Semicolon');
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
      if (includes(paths, 'typeName', 'Identifier')) {
        annotations.push({ name: image, value: '' });
      } else if (includes(paths, 'StringLiteral')) {
        annotations[annotations.length - 1].value = image;
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
  const STEP_14_LBrace = 14;
  const STEP_15_StringLiteral = 15;

  const STEP_02_DOT = 2;
  const STEP_03_REST = 3;
  const STEP_04_LBrace = 4;
  const STEP_05_StringLiteral = 5;

  const callers: CallerInfo[] = [];

  let firstName = '';
  let restName = '';
  for (let i = posLCurly; i <= posRCurly; i++) {
    const { paths, image } = methodDecls[i];

    if (
      endsWith(
        paths,
        'primary',
        'primaryPrefix',
        'fqnOrRefType',
        'fqnOrRefTypePartFirst',
        'fqnOrRefTypePartCommon',
        'Identifier'
      ) &&
      step === STEP_00_NONE
    ) {
      const goToNext = callerOnlyInVars ? vars.some(({ instanceName }) => instanceName === image) : true;
      if (goToNext) {
        step = STEP_01_FIRST;
      }
    } else if (endsWith(paths, 'primary', 'primaryPrefix', 'fqnOrRefType', 'Dot') && step === STEP_01_FIRST) {
      step = STEP_02_DOT;
    } else if (endsWith(paths, 'primary', 'primarySuffix', 'methodInvocationSuffix', 'LBrace')) {
      if (step === STEP_01_FIRST) {
        step = STEP_14_LBrace;
      } else if (step === STEP_03_REST) {
        step = STEP_04_LBrace;
      }
    } else if (
      endsWith(
        paths,
        'primary',
        'primaryPrefix',
        'fqnOrRefType',
        'fqnOrRefTypePartRest',
        'fqnOrRefTypePartCommon',
        'Identifier'
      ) &&
      step === STEP_02_DOT
    ) {
      step = STEP_03_REST;
    } else if (endsWith(paths, 'primary', 'primaryPrefix', 'literal', 'StringLiteral')) {
      if (step === STEP_04_LBrace) {
        step = STEP_05_StringLiteral;
      } else if (step === STEP_14_LBrace) {
        step = STEP_15_StringLiteral;
      }
    } else {
      step = STEP_00_NONE;
    }

    if (step === STEP_01_FIRST) {
      firstName = image;
    } else if (step === STEP_14_LBrace) {
      callers.push({ instanceName: '', methodName: firstName, stringLiteral: '' });
      firstName = '';
      restName = '';
    } else if (step === STEP_03_REST) {
      restName = image;

      callers.push({ instanceName: firstName, methodName: restName, stringLiteral: '' });
      firstName = '';
      restName = '';
    } else if (step === STEP_05_StringLiteral || step === STEP_15_StringLiteral) {
      callers[callers.length - 1].stringLiteral = image;
    }
  }

  return callers;
}

function getMethods(pathsAndImageList: PathsAndImage[], vars: VarInfo[], callerOnlyInVars: boolean): MethodInfo[] {
  const methodDecls = pathsAndImageList.filter(({ paths, image }) => includes(paths, 'methodDeclaration'));

  const methods: MethodInfo[] = [];
  let annotations: Annotation[] = [];
  let name = '';
  let callers: CallerInfo[] = [];
  for (let i = 0; i < methodDecls.length; i++) {
    const { paths, image } = methodDecls[i];

    if (includes(paths, 'annotation')) {
      if (includes(paths, 'typeName', 'Identifier')) {
        annotations.push({ name: image, value: '' });
      } else if (includes(paths, 'StringLiteral')) {
        annotations[annotations.length - 1].value = image;
      }
    } else if (includes(paths, 'methodDeclarator', 'Identifier')) {
      name = image;
    } else if (includes(paths, 'LCurly')) {
      const posLCurly = i;
      const posRCurly = getRCurlyPosition(methodDecls, posLCurly);
      callers = getCallerInfos(methodDecls, vars, posLCurly, posRCurly, callerOnlyInVars);

      methods.push({ annotations, name, callers });

      annotations = [];
      name = '';
      callers = [];

      i = posRCurly;
    }
  }

  return methods;
}

export function getClassInfo(content: string, callerOnlyInVars: boolean): { vars: VarInfo[]; methods: MethodInfo[] } {
  const cst = parse(content);
  const cst2 = cst as any;
  const classBodys: any[] = getItemByPath(
    cst2,
    'ordinaryCompilationUnit.typeDeclaration.classDeclaration.normalClassDeclaration.classBody'.split('.')
  );

  const paths: string[] = [];
  const pathsAndImageList: PathsAndImage[] = [];
  getAllValueAndPaths(classBodys[0], paths, pathsAndImageList);

  const vars = getVars(pathsAndImageList);
  const methods = getMethods(pathsAndImageList, vars, callerOnlyInVars);

  // console.log(JSON.stringify(vars, null, '  '));
  console.log(JSON.stringify(methods, null, '  '));
  console.log('x');

  return { vars, methods };
}