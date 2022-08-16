import { matchOfSkipRange, getClosingPosition } from './util';

type PrivateVars = {
  typeName: string;
  instanceName: string;
};
type CallerInfo = {
  instanceName: string;
  functionName: string;
  params: string;
};
type FunctionHeader = {
  isPrivate: boolean;
  returnType: string;
  name: string;
  params: string;
  indexLast: number; // before the index of {
};
type FunctionBody = {
  from: number; // index of {
  to: number; // index of }
  value: string;
};
export type FunctionInfo = {
  mappingValues: string[];
  header: FunctionHeader;
  body: FunctionBody;
  callers: CallerInfo[];
};
export type ControllerInfo = {
  privateVars: PrivateVars[];
  functions: FunctionInfo[];
};

// function getPrivateVarOrFunc(
//   value: string,
//   index: number,
//   range: [number, number][]
// ) {
//   let pos = index;

//   const privateVars: PrivateVars[] = [];
//   const funcs: FunctionInfo[] = [];

//   while (true) {
//     const reVar = /^\s*private\s+(?<typeName>\w+)\s+(?<instanceName>\w+)\s*;|/m;
//     const reFunc = /^\s*(?<public>public\s*)*(?<header>\w.+?\{)/ms;

//     const retVar = matchOfSkipRange(value, reVar, pos, range);
//     const retFunc = matchOfSkipRange(value, reFunc, pos, range);

//     if (!retVar && !retFunc) break;

//     const indexVar = retVar ? retVar.index : Number.MAX_SAFE_INTEGER;
//     const indexFunc = retFunc ? retFunc.index : Number.MAX_SAFE_INTEGER;
//     const isVarFirst = indexVar < indexFunc;

//     if (isVarFirst && retVar) {
//       const { typeName, instanceName } = retVar.match.groups || {
//         typeName: '',
//         instanceName: '',
//       };
//       privateVars.push({ typeName, instanceName });

//       pos = retVar.index + retVar.match[0].length;

//     } else if (!isVarFirst && retFunc) {
//       const header = getFunctionHeader(value, pos, range);
//       if (!header) {
//         pos = retFunc.index + retFunc.match[0].length;
//         continue;
//       };

//       pos = header.indexLast + 1;
//       const body = getFunctionBody(value, pos, range);
//       if (!body) {
//         pos = retFunc.index + retFunc.match[0].length;
//         continue;
//       }

//       const callers = getCallers(value, privateVars, body, range);

//       funcs.push({
//         mappingValues: retValues.values,
//         annotations,
//         header,
//         body,
//         callers,
//       });
//       pos = body.to + 1;
//     }
//   }

//   return privateVars;
// }

function getPrivateVars(
  value: string,
  range: [number, number][]
): PrivateVars[] {
  const privateVars: PrivateVars[] = [];

  let pos = 0;
  while (true) {
    const ret = matchOfSkipRange(
      value,
      /^\s*private\s+(?<typeName>\w+)\s+(?<instanceName>\w+)\s*;/gm,
      pos,
      range
    );
    if (!ret) break;

    const { typeName, instanceName } = ret.match.groups || {
      typeName: '',
      instanceName: '',
    };
    privateVars.push({ typeName, instanceName });

    pos = ret.index + ret.match[0].length;
  }

  return privateVars;
}

/*
@RequestMapping("/sub/Test.do")
@RequestMapping("/sub")
@RequestMapping(value="/sub/Test.do")
@RequestMapping(value="/sub/Test.do",method=RequestMethod.GET)
@RequestMapping(value="/sub/Test.do",method=RequestMethod.POST)
@RequestMapping(value="/sub/Test"+ACTION_NAME)
@RequestMapping(value="/{pkg}/test.do")
@RequestMapping(value={"/sub/test.do"})
@RequestMapping(value={"/sub/test.do","/sub/test2.do"})
@RequestMapping(value={"/sub/test.do","/sub/test2.do"},method=RequestMethod.GET)
*/
function getMappingValues(
  value: string,
  index: number,
  range: [number, number][]
): { values: string[]; indexLast: number } | null {
  function getValues(value: string): string[] {
    const valueNew = value.trim();
    const mapValues: string[] = [];

    let m: RegExpExecArray | null = null;

    // @RequestMapping("/sub/Test.do")
    m = /^"(.+)"$/.exec(valueNew);
    if (m) {
      mapValues.push(m[1]);
      return mapValues;
    }

    // @RequestMapping(value="/sub/Test.do")
    // @RequestMapping(value="/sub/Test.do",method=RequestMethod.GET)
    m = /^value\s*=\s*"([^"]+)"/.exec(valueNew);
    if (m) {
      mapValues.push(m[1]);
      return mapValues;
    }

    // @RequestMapping(value={"/sub/test.do","/sub/test2.do"})
    m = /^value\s*=\s*\{([^}]+)\}/.exec(valueNew);
    if (m) {
      const valueList = m[1];
      valueList.split(',').forEach((v) => {
        const m2 = /\s*"(.+)"\s*/.exec(v);
        const inner = m2?.[1] || '';
        mapValues.push(inner);
      });
      return mapValues;
    }

    throw new Error(`Wrong value: ${value}`);
  }

  const values: string[] = [];

  const reMapping = /@\w+Mapping\(([^)]+)\)/;

  const ret = matchOfSkipRange(value, reMapping, index, range);
  if (!ret) {
    return null;
  }

  const inner = ret.match[1];
  const valuesCur = getValues(inner);
  values.push(...valuesCur);
  return { values, indexLast: ret.index + ret.match[0].length - 1 };
}

function getFunctionReturnType(value: string): {
  returnType: string;
  indexLast: number;
} | null {
  let cntAngle = 0;
  for (let i = 0; i < value.length; i += 1) {
    const c = value[i];
    if (c === '<') {
      cntAngle++;
    } else if (c === '>') {
      cntAngle--;
    } else if (/\s/.test(c) && cntAngle === 0) {
      const from = 0;
      const to = i - 1;
      return { returnType: value.substring(from, to + 1), indexLast: to };
    }
  }

  return null;
}

function getFunctionNameParams(
  value: string,
  range: [number, number][]
): { name: string; params: string } | null {
  const m = /(\w+)\(/.exec(value);
  if (!m) return null;

  const name = m[1];

  const posOpen = m.index + m[0].length - 1;
  const posClose = getClosingPosition(value, posOpen, '(', ')', range);
  if (posClose === -1) return null;

  const params = value.substring(posOpen + 1, posClose);

  return { name, params };
}

// List<UserVO> selectUser(userId String,
// age int) {
// public List<UserVO> selectUser(userId String, age int) {
// Map<String, String> selectUser(userId String, age int) {
function getFunctionHeader(
  value: string,
  index: number,
  range: [number, number][]
): FunctionHeader | null {
  const ret = matchOfSkipRange(
    value,
    /^\s*(?<public>public\s*)*(?<header>\w.+?\{)/ms,
    index,
    range
  );
  if (!ret) return null;

  // exclude '{' because it is start of body
  const indexLast = ret.index + ret.match[0].length - 1 - 1;

  const isPrivate = ret.match.groups?.public !== 'public';
  const header = ret.match.groups?.header as string;

  const retReturn = getFunctionReturnType(header);
  if (!retReturn) return null;

  const retNameParams = getFunctionNameParams(
    header.substring(retReturn.indexLast + 1),
    range
  );
  if (!retNameParams) return null;

  return {
    isPrivate,
    returnType: retReturn.returnType,
    name: retNameParams.name,
    params: retNameParams.params,
    indexLast,
  };
}

function getFunctionBody(
  value: string,
  indexOpen: number,
  range: [number, number][]
): FunctionBody | null {
  const indexEnd = getClosingPosition(value, indexOpen, '{', '}', range);
  if (indexEnd === -1) {
    return null;
  }

  return {
    from: indexOpen,
    to: indexEnd,
    value: value.substring(indexOpen, indexEnd + 1),
  };
}

function getCallers(
  value: string,
  privateVars: PrivateVars[],
  body: FunctionBody,
  range: [number, number][]
): CallerInfo[] {
  const callers: CallerInfo[] = [];

  let pos = body.from;

  while (pos < body.to) {
    let found = false;
    for (let nVar = 0; nVar < privateVars.length; nVar += 1) {
      const { instanceName } = privateVars[nVar];
      const re = new RegExp(
        `${instanceName}\\.(?<functionName>\\w+)(?<openToSemi>\\(.+?;)`,
        's'
      );
      const ret = matchOfSkipRange(value, re, pos, range);
      if (ret) {
        const { functionName, openToSemi } = ret.match.groups || {
          functionName: '',
          openToSemi: '',
        };

        const posOpen = 0;
        const posClose = getClosingPosition(openToSemi, 0, '(', ')', range);
        const params = openToSemi.substring(posOpen + 1, posClose);
        callers.push({ instanceName, functionName, params });

        pos = ret.index + ret.match[0].length;
        found = true;
        break;
      }
    }
    if (!found) break;
  }

  return callers;
}

export function getFunctionsByMapping(
  value: string,
  rangeComment: [number, number][],
  rangeLiteral: [number, number][]
): ControllerInfo | null {
  const rangeAll = [...rangeComment, ...rangeLiteral];

  const privateVars = getPrivateVars(value, rangeAll);
  if (!privateVars.length) return null;

  const functions: FunctionInfo[] = [];
  let pos = 0;
  while (true) {
    const retValues = getMappingValues(value, pos, rangeAll);
    if (!retValues) break;

    pos = retValues.indexLast + 1;
    const header = getFunctionHeader(value, pos, rangeAll);
    if (!header) break;

    pos = header.indexLast + 1;
    const body = getFunctionBody(value, pos, rangeAll);
    if (!body) break;

    const callers = getCallers(value, privateVars, body, rangeAll);

    functions.push({
      mappingValues: retValues.values,
      header,
      body,
      callers,
    });
    pos = body.to + 1;
  }
  if (!functions.length) return null;

  return { privateVars, functions };
}
