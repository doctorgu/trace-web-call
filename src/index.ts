// @RequestMapping(value="/coe/cs"+ACTION_NAME)

import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { config } from './config/config';
import { getClassInfo, getFindsByClassPathClassNameFromDb } from './common/classHelper';
import { getCstSimple } from './common/cstSimpleHelper';
import { getXmlNodeInfoFinds, getStartingToTables, RouteTable } from './common/traceHelper';
import { findFiles, readFileSyncUtf16le, removeCommentLiteralSql } from './common/util';
import { insertToDb } from './run/insertToDb';
import { getDbPath } from './common/common';
import { getJspIncludes } from './common/jspHelper';
import { logCompared } from './run/logCompared';

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
  // const viewSql = readFileSyncUtf16le(`${config.path.test}/viewTest.sql`);
  // const tables = new Set<string>(['TAB1', 'TAB2', 'TAB3', 'TAB4', 'TAB5', 'TAB6', 'TAB7', 'TAB8', 'TAB9']);
  // const objectAndTables = getObjectAndTables(viewSql, tables);
  // const tablesUsed = objectAndTables.map(({ tables }) => [...tables]).flat();
  // // ['TAB1', 'TAB2', 'TAB3', 'TAB4', 'TAB6', 'TAB7', 'TAB8']
  // console.log(tablesUsed);
}
// doTest();
insertToDb();
// logCompared();
