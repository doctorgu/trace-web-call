// @RequestMapping(value="/coe/cs"+ACTION_NAME)

import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { config } from './config/config';
import { getClassInfo, getFindsByClassPathClassNameFromDb } from './common/classHelper';
import { getCstSimple } from './common/cstSimpleHelper';
import { getXmlNodeInfoFinds, getStartingToObjects, RouteTable } from './common/traceHelper';
import { findFiles, readFileSyncUtf16le, removeCommentLiteralSql } from './common/util';
import { insertToDb } from './run/insertToDb';
import { getDbPath } from './common/common';
import { getJspIncludes } from './common/jspHelper';
import { logCompared } from './run/logCompared';
import { copyModifiedUntracked } from './run/copyModifiedUntracked';

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
  const { methods } = getClassInfo('./test/jspModelAndView/ModelAndViewTestController.java');
  for (let nMethod = 0; nMethod < methods.length; nMethod++) {
    const { jspViews } = methods[nMethod];
    console.log(jspViews);
  }
  // --
  // const xmls = getXmlNodeInfoFinds('./test', 'IncludeTest.xml');
  // for (let i = 0; i < xmls.length; i++) {
  //   const { namespace, id, tagName, params, tables } = xmls[i];
  //   console.log(namespace, id, tagName, params, tables);
  // }
}
// doTest();
insertToDb();
// copyModifiedUntracked();
// logCompared();
