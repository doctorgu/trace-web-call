import { readFileSync } from 'fs';
import { findFiles, getCommentRange, getLiteralRange } from './common/util';
import { getFunctionsByMapping } from './common/controllerHelper';
import { getXmls } from './common/xmlHelper';

async function getControllerInfo(rootDir: string, pattern: string) {
  for await (const fullPath of findFiles(rootDir, pattern)) {
    const content = readFileSync(fullPath, { encoding: 'utf-8' });

    const rangeComment = getCommentRange(content);
    const rangeLiteral = getLiteralRange(content, rangeComment);
    const funcs = getFunctionsByMapping(content, rangeComment, rangeLiteral);
    console.log(fullPath);
    console.log(JSON.stringify(funcs, null, '  '));
  }
}
getControllerInfo(
  'D:\\Temp\\kbbizmicro-sb\\bz-manual-api-common\\src\\main\\java\\biz\\micro\\portal\\manual\\api\\common\\controller',
  'ManualCategoryController.java'
);

// async function getServiceInfo(rootDir: string, pattern: string) {
//   for await (const fullPath of findFiles(rootDir, pattern)) {
//     const content = readFileSync(fullPath, { encoding: 'utf-8' });

//     const rangeComment = getCommentRange(content);
//     const rangeLiteral = getLiteralRange(content, rangeComment);
//     const funcs = getFunctionsByService(content, rangeComment, rangeLiteral);
//     console.log(fullPath);
//     console.log(JSON.stringify(funcs, null, '  '));
//   }
// }
// getServiceInfo(
//   'D:\\Temp\\kbbizmicro-sb\\bz-manual-api-common\\src\\main\\java\\biz\\micro\\portal\\manual\\api\\common\\spring\\service',
//   'ManualDocNoticeServiceImpl.java'
// );

async function getXmlIds(rootDir: string, pattern: string) {
  for await (const fullPath of findFiles(rootDir, pattern)) {
    const xml = readFileSync(fullPath, 'utf-8');
    const xmls = getXmls(xml);
    console.log(JSON.stringify(xmls, null, '  '));
  }
}
// getXmlIds(
//   'D:\\Temp\\kbbizmicro-sb\\bz-manual-api-common\\src\\main\\resources\\sql\\oracle',
//   'DocNotice.xml'
// );

// Startup script, add breakpoints to test debugging

// let strings: string[] = [];

// strings.push('Hello');
// strings.push('World!');

// strings.forEach((str) => {
//   console.log(str);
// });

// console.log('Done');
