// @RequestMapping(value="/coe/cs"+ACTION_NAME)
// * Two class case
// * Add current className, methodName, parameterCount to routes !!! to check: routeTypePrev === 'method' && valuePrev === value && depthPrev <= depth
// * Selecting user_name.tables support
// * extends support
// * dependency support
// * Remove quoted text from sql
// * Starting point is not mapping

import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { config } from './config/config';
import { getClassInfo, getFindsByClassPathClassNameFromDb } from './common/classHelper';
import { getXmlNodeInfoFinds, getStartingToTables, RouteInfo } from './common/traceHelper';
import { readFileSyncUtf16le, removeCommentLiteralSql } from './common/util';
import { insertToDb } from './run/insertToDb';

function doTest() {
  // const ret = getClassInfo('C:/source/trace-web-call/test/AnnotationTestController.java');
  // console.log(ret);
  // const methodsInStartings = getMethodInfoFinds('./test', 'OverloadTestServiceImpl');
  // for (let nMethod = 0; nMethod < methodsInStartings.length; nMethod++) {
  //   const methodInStartings = methodsInStartings[nMethod];
  //   const { callers } = methodInStartings;
  //   console.log(callers);
  // }
  // const { methods } = getClassInfo('./test/AnnotationTestController.java');
  // for (let nMethod = 0; nMethod < methods.length; nMethod++) {
  //   const { mapping } = methods[nMethod];
  //   console.log(mapping.values.join(','));
  // }
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
