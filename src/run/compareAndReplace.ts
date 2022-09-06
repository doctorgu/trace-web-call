import { renameSync, existsSync } from 'fs';
import { Config } from '../config/configTypes';
import { readFileSyncUtf16le } from '../common/util';
import { config } from '../config/config';

function compareAndReplace() {
  function compareAndReplace2(pathNew: string, pathOld: string): boolean {
    const contentNew = readFileSyncUtf16le(pathNew);
    const contentOld = readFileSyncUtf16le(pathOld);
    if (contentOld !== contentNew) return false;

    renameSync(pathNew, pathOld);
    return true;
  }

  for (let i = 0; i < config.path.source.main.length; i++) {
    const { filePostfix: filePostfixNew } = config.path.source.main[i];
    if (!filePostfixNew.endsWith('2')) {
      throw new Error(`${filePostfixNew} not ends with '2'`);
    }

    const filePostfixOld = filePostfixNew.substring(0, filePostfixNew.length - 1);

    const pathStartToTableNew = `${config.path.outputDirectory}/${config.startingPoint}ToTables${filePostfixNew}.${config.outputType}`;
    const pathStartToTableOld = `${config.path.outputDirectory}/${config.startingPoint}ToTables${filePostfixOld}.${config.outputType}`;
    const existsStartToTableNew = existsSync(pathStartToTableNew);
    const existsStartToTableOld = existsSync(pathStartToTableOld);
    if (!existsStartToTableNew) {
      console.log(`${pathStartToTableNew} not exists`);
    } else if (!existsStartToTableOld) {
      console.log(`${pathStartToTableOld} not exists`);
    } else {
      const successStartToTable = compareAndReplace2(pathStartToTableNew, pathStartToTableOld);
      console.log(`${successStartToTable} = compareAndReplace2(${pathStartToTableNew}, ${pathStartToTableOld})`);
    }

    const pathRouteNew = `${config.path.outputDirectory}/routes${filePostfixNew}.${config.outputType}`;
    const pathRouteOld = `${config.path.outputDirectory}/routes${filePostfixOld}.${config.outputType}`;
    const existsRouteNew = existsSync(pathRouteNew);
    const existsRouteOld = existsSync(pathRouteOld);
    if (!existsRouteNew) {
      console.log(`${pathRouteNew} not exists`);
    } else if (!existsRouteOld) {
      console.log(`${pathRouteOld} not exists`);
    } else {
      const succeessRoute = compareAndReplace2(pathRouteNew, pathRouteOld);
      console.log(`${succeessRoute} = compareAndReplace2(${pathRouteNew}, ${pathRouteOld})`);
    }
  }
}

compareAndReplace();
