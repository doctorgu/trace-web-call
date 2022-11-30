// @RequestMapping(value="/coe/cs"+ACTION_NAME)
// * Auto set seqParent
// * Create query to get start from object or table
// * Unite to value from valueJob or valueStep...
// Ignore unneeded route
// Function to get all route used by specific table
// Merge config of FO, BO and Core

/*
with tree as
(
    select  r.value, r.valueList,
            r.keyName, r.groupSeq, r.seq, r.seqParent, r.routeType, r.depth
    from    RouteTable r
            inner join json_each(r.tablesInsert) ji
    where   ji.value = 'BIZMICRO.WK_BIZMENU' and r.groupSeq = 33
    union all
    select  p.value, p.valueList,
            p.keyName, p.groupSeq, p.seq, p.seqParent, p.routeType, p.depth
    from    tree c
            inner join RouteTable p
            on p.keyName = c.keyName
            and p.groupSeq = c.groupSeq
            and p.seq = c.seqParent
)
select  *
from    tree
order by seq
;

select * from vRouteTableIndent where keyName = 'bz-store-api-bizgroup' and groupSeq = 33;
*/

import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { config } from './config/config';
import { getClassInfo, getFindsByClassPathClassNameFromDb } from './common/classHelper';
import { convertCstWithLocationToCstSimple, getCstWithLocation } from './common/cstSimpleHelper';
import { getStartingToObjects, RouteCommon, RouteTable, setSeqParent } from './common/traceHelper';
import { findFiles, readFileSyncUtf16le, removeCommentLiteralSql } from './common/util';
import { insertToDb } from './run/insertToDb';
import { deleteNoNeedRouteTableRouteBatch, getDbPath } from './common/common';
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
import { getPathsAndImagesFromCstSimple } from './common/cstHelper';
import { insertBatchInfo } from './common/batchHelper';
import { copyFile } from './run/tmpLogDirectory';

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
  //   const { methods } = getClassInfo('./test/jspTest/JspTestController.java');
  //   const { methods } = getClassInfo('./test/jspModelAndView/ModelAndViewTestController.java');
  // const cstWithLocation = getCstWithLocation('C:/source/trace-web-call/test/SeparatorTest.java');
  // const cstSimple = convertCstWithLocationToCstSimple(cstWithLocation);
  // const pathsAndImages = getPathsAndImagesFromCstSimple(cstSimple);
  // const ret = getClassInfo('C:/source/trace-web-call/test/SeparatorTest.java');
  // console.log(ret);
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
  // const rootDir = 'C:/source/trace-web-call';
  // const fullPath = 'C:/source/trace-web-call/test/manual_common.xml';
  // const usersAll = getUsersFromDb();
  // insertTablesToDb();
  // const { tables: tablesAll, tablesNoSchema: tablesAllNoSchema } = getTablesFromDb();
  // const { nameObjects: nameObjectsAll, nameObjectsNoSchema: nameObjectsAllNoSchema } = getNameObjectsAllFromDb();
  // const ret = getXmlInfoXmlNodeInfo(
  //   rootDir,
  //   fullPath,
  //   usersAll,
  //   tablesAll,
  //   tablesAllNoSchema,
  //   nameObjectsAll,
  //   nameObjectsAllNoSchema
  // );
  // if (ret) {
  //   console.log(ret.nodes);
  // }
  // --
  //   const ret = getClassInfo('C:/source/trace-web-call/test/ParenthesisTest.java');
  // --
  copyFile('D:/source/hmall/hdhs_hmall/hmall_pc_was/src/main/java/hmall/cp/cpa/web/CPACsegLnbSrvyController.java');
}
doTest();
// insertToDb();
// deleteNoNeedRouteTableRouteBatch();
// logCompared();
// copyModifiedUntracked();
// logCompared();
