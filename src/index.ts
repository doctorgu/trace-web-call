import { readFileSync } from 'fs';
import { findFiles } from './common/util';
import { getClassInfo } from './common/classHelper';
import { getXmls } from './common/xmlHelper';

async function getControllerInfo(rootDir: string, filePattern: string) {
  const callerOnlyInVars = true;
  for await (const fullPath of findFiles(rootDir, filePattern)) {
    const content = readFileSync(fullPath, { encoding: 'utf-8' });
    getClassInfo(content, callerOnlyInVars);

    console.log(fullPath);
  }
}
async function getServiceImplInfo(rootDir: string, filePattern: string) {
  const callerOnlyInVars = false;
  for await (const fullPath of findFiles(rootDir, filePattern)) {
    const content = readFileSync(fullPath, { encoding: 'utf-8' });
    getClassInfo(content, callerOnlyInVars);

    console.log(fullPath);
  }
}
async function getXmlIds(rootDir: string, filePattern: string) {
  for await (const fullPath of findFiles(rootDir, filePattern)) {
    const xml = readFileSync(fullPath, 'utf-8');
    const xmls = getXmls(xml);
    console.log(JSON.stringify(xmls, null, '  '));
  }
}
// getControllerInfo(
//   'D:\\Temp\\kbbizmicro-sb\\bz-manual-api-common\\src\\main\\java\\biz\\micro\\portal\\manual\\api\\common\\controller',
//   'ManualEditorController.java'
// );
// getServiceImplInfo(
//   'D:\\Temp\\kbbizmicro-sb\\bz-manual-api-common\\src\\main\\java\\biz\\micro\\portal\\manual\\api\\common\\spring\\service',
//   'ManualServiceImpl.java'
// );
getXmlIds('D:\\Temp\\kbbizmicro-sb\\bz-manual-api-common\\src\\main\\resources\\sql\\oracle', 'DocNotice.xml');
