// @RequestMapping(value="/coe/cs"+ACTION_NAME)

import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { config } from './config/config';
import { getClassInfo, getCstClassDeclaration, getFindsByClassPathClassNameFromDb } from './common/classHelper';
import { getCstSimple } from './common/cstSimpleHelper';
import { getStartingToObjects, RouteTable } from './common/traceHelper';
import { findFiles, readFileSyncUtf16le, removeCommentLiteralSql } from './common/util';
import { insertToDb } from './run/insertToDb';
import { getDbPath } from './common/common';
import { getJspIncludes } from './common/jspHelper';
import { logCompared } from './run/logCompared';
import { copyModifiedUntracked } from './run/copyModifiedUntracked';
import { getUsersFromDb } from './common/batisHelper';
import { getPathsAndImagesFromSimpleCst } from './common/cstHelper';

function doTest() {
  // const ret = getClassInfo('C:/source/trace-web-call/test/AnnotationTestController.java');
  // console.log(ret);
  // const methodsInStartings = getMethodInfoFinds('./test', 'OverloadTestServiceImpl');
  // for (let nMethod = 0; nMethod < methodsInStartings.length; nMethod++) {
  //   const methodInStartings = methodsInStartings[nMethod];
  //   const { callers } = methodInStartings;
  //   console.log(callers);
  // }
  // --
  // const { methods } = getClassInfo('./test/jspTest/JspTestController.java');
  // const { methods } = getClassInfo('./test/SeparatorTest.java');
  // const { methods } = getClassInfo('./test/jspModelAndView/ModelAndViewTestController.java');
  // for (let nMethod = 0; nMethod < methods.length; nMethod++) {
  //   const { jspViews } = methods[nMethod];
  //   console.log(jspViews);
  // }
  // --
  // const cstSimple = getCstSimple('./test/SeparatorTest.java');
  // const classDeclaration = getCstClassDeclaration(cstSimple);
  // const pathsAndImageList = getPathsAndImagesFromSimpleCst(classDeclaration);
}
// doTest();
insertToDb();
// copyModifiedUntracked();
// logCompared();
