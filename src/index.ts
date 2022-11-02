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
import {
  getNameObjectsAllFromDb,
  getTablesFromDb,
  getUsersFromDb,
  getXmlInfoXmlNodeInfo,
  insertTablesToDb,
} from './common/sqlMapperHelper';
import { getPathsAndImagesFromSimpleCst } from './common/cstHelper';
import { insertBatchInfo } from './common/batchHelper';

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
  // const cstSimple = getCstSimple('./test/VariableHistoryTest.java');
  // const classDeclaration = getCstClassDeclaration(cstSimple);
  // const pathsAndImageList = getPathsAndImagesFromSimpleCst(classDeclaration);
  // --
  // let usersAll = getUsersFromDb();
  // let { tables: tablesAll, tablesNoSchema: tablesAllNoSchema } = getTablesFromDb();
  // let { nameObjects: nameObjectsAll, nameObjectsNoSchema: nameObjectsAllNoSchema } = getNameObjectsAllFromDb();
  // insertBatchInfo(
  //   'batchTest',
  //   'C:/source/trace-web-call/test',
  //   'C:/source/trace-web-call/test/batchTest/AlrimiDayJob.xml',
  //   usersAll,
  //   tablesAll,
  //   tablesAllNoSchema,
  //   nameObjectsAll,
  //   nameObjectsAllNoSchema
  // );
  // --
  //

  const rootDir = 'C:/source/trace-web-call';
  const fullPath = 'C:/source/trace-web-call/test/manual_common.xml';
  const usersAll = getUsersFromDb();
  insertTablesToDb();
  const { tables: tablesAll, tablesNoSchema: tablesAllNoSchema } = getTablesFromDb();
  const { nameObjects: nameObjectsAll, nameObjectsNoSchema: nameObjectsAllNoSchema } = getNameObjectsAllFromDb();
  const ret = getXmlInfoXmlNodeInfo(
    rootDir,
    fullPath,
    usersAll,
    tablesAll,
    tablesAllNoSchema,
    nameObjectsAll,
    nameObjectsAllNoSchema
  );
  if (ret) {
    console.log(ret.nodes);
  }
}
// doTest();
insertToDb();
// copyModifiedUntracked();
// logCompared();
