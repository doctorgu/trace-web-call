import { renameSync, readFileSync } from 'fs';
import { configComposite } from '../config/configComposite';
import { Config } from '../config/configTypes';

export function compareAndReplace(config: Config) {
  function compareAndReplace2(pathNew: string, pathOld: string): boolean {
    const contentNew = readFileSync(pathNew, 'utf-8');
    const contentOld = readFileSync(pathOld, 'utf-8');
    if (contentOld !== contentNew) return false;

    renameSync(pathNew, pathOld);
    return true;
  }

  for (let i = 0; i < config.path.main.length; i++) {
    const { filePostfix: filePostfixNew } = config.path.main[i];
    if (!filePostfixNew.endsWith('2')) {
      throw new Error(`${filePostfixNew} not ends with '2'`);
    }

    const filePostfixOld = filePostfixNew.substring(0, filePostfixNew.length - 1);

    const pathStartToTableNew = `${config.path.outputDirectory}/${config.startingPoint}ToTables${filePostfixNew}.${config.outputType}`;
    const pathStartToTableOld = `${config.path.outputDirectory}/${config.startingPoint}ToTables${filePostfixOld}.${config.outputType}`;
    const successStartToTable = compareAndReplace2(pathStartToTableNew, pathStartToTableOld);
    console.log(`${successStartToTable} = compareAndReplace2(${pathStartToTableNew}, ${pathStartToTableOld})`);

    const pathRouteNew = `${config.path.outputDirectory}/routes${filePostfixNew}.${config.outputType}`;
    const pathRouteOld = `${config.path.outputDirectory}/routes${filePostfixOld}.${config.outputType}`;
    const succeessRoute = compareAndReplace2(pathRouteNew, pathRouteOld);
    console.log(`${succeessRoute} = compareAndReplace2(${pathRouteNew}, ${pathRouteOld})`);
  }
}

compareAndReplace(configComposite);
