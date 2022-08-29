// @RequestMapping(value="/coe/cs"+ACTION_NAME)
// * Two class case
// * Add current className, methodName, parameterCount to routes !!! to check: routeTypePrev === 'method' && valuePrev === value && depthPrev <= depth
// * Selecting user_name.tables support
// * extends support
// * dependency support
// Starting point is not mapping
// Remove quoted text from sql

import { writeFileSync, readFileSync } from 'fs';
import { config } from './config/config';
import {
  RouteInfo,
  MappingToObjects,
  getMethodInfoFinds,
  getXmlNodeInfoFinds,
  getTableNamesByMethod,
  getDependency,
} from './common/traceHelper';
import { getObjectAndTables, XmlInfo, XmlNodeInfoFind } from './common/sqlHelper';
import { MethodInfoFind } from './common/classHelper';
import { DirectoryAndFilePattern } from './config/configTypes';

function getMappingToTables(
  findsController: MethodInfoFind[],
  findsService: MethodInfoFind[],
  xmls: XmlNodeInfoFind[],
  findsDependency: MethodInfoFind[],
  xmlsDependency: XmlNodeInfoFind[]
): MappingToObjects[] {
  const methodsAll = [...findsController, ...findsService, ...findsDependency];

  const xmlsAll = xmls.concat(xmlsDependency);

  const mappingAndTables: MappingToObjects[] = [];

  for (let nMethod = 0; nMethod < findsController.length; nMethod++) {
    const methodInControllers = findsController[nMethod];
    const { className, mappingValues, name: methodName } = methodInControllers;
    if (!mappingValues.length) continue;

    const routes: RouteInfo[] = [];

    for (let nValue = 0; nValue < mappingValues.length; nValue++) {
      const mappingValue = mappingValues[nValue];

      let depth = -1;
      routes.push({ routeType: 'mapping', value: `${mappingValue}`, depth: ++depth });
      routes.push({ routeType: 'method', value: `${className}.${methodName}`, depth: ++depth });

      const { tables, objectAndTables } = getTableNamesByMethod(
        methodInControllers,
        methodsAll,
        xmlsAll,
        routes,
        depth + 1
      );
      mappingAndTables.push({ mappingValue, tables, objectAndTables, routes });
      // console.log(routes);
    }
  }
  // console.log(mappingAndTables);
  return mappingAndTables;
}

function writeMappingToTables() {
  function getBranch(depth: number) {
    if (depth === 0) return '';
    // return `|---${'-'.repeat((depth - 1) * 4)}`;
    return `${' '.repeat((depth - 1) * 4)}+-- `;
  }

  const { finds: findsDependency, xmls: xmlsDependency } = getDependency();

  for (let i = 0; i < config.path.main.length; i++) {
    const { controllers, service, xml, filePostfix } = config.path.main[i];

    let findsController = controllers.map(({ directory, file }) => getMethodInfoFinds(directory, file)).flat();
    const findsService = getMethodInfoFinds(service.directory, service.file);

    const xmls = getXmlNodeInfoFinds(xml, '*.xml');

    const mapToTables: string[] = [];
    const routeLogs: string[] = [];

    const mappingToTables = getMappingToTables(findsController, findsService, xmls, findsDependency, xmlsDependency);
    let headerMapToTables = '';
    let headerRoutes = '';
    let lineSepRoutes = '';
    let extension = '';

    if (config.outputType === 'txt') {
      lineSepRoutes = '\n\n';
      extension = '.txt';

      for (const { mappingValue, tables, routes } of mappingToTables) {
        const tablesComma = [...tables].sort().join(',');

        mapToTables.push(`${mappingValue}: ${tablesComma}`);
        routeLogs.push(
          routes
            .map(({ routeType, value, depth }) => `${routeType.padStart(9, ' ')}: ${getBranch(depth)}${value}`)
            .join('\n')
        );
      }
    } else if (config.outputType === 'csv') {
      headerMapToTables = 'Mapping,Table\n';
      headerRoutes = 'Name,Depth,Value\n';
      lineSepRoutes = '\n';
      extension = '.csv';

      for (const { mappingValue, tables, routes } of mappingToTables) {
        const tablesComma = `"${[...tables].sort().join(',')}"`;

        mapToTables.push(`${mappingValue},${tablesComma}`);
        routeLogs.push(routes.map(({ routeType, value, depth }) => `${routeType},${depth},"${value}"`).join('\n'));
      }
    }

    writeFileSync(
      `${config.path.outputDirectory}\\mapToTables${filePostfix}${extension}`,
      `${headerMapToTables}${mapToTables.join('\n')}`,
      'utf-8'
    );
    writeFileSync(
      `${config.path.outputDirectory}\\routes${filePostfix}${extension}`,
      `${headerRoutes}${routeLogs.join(lineSepRoutes)}`,
      'utf-8'
    );
  }
}
writeMappingToTables();

function doTest() {
  // const methodsInControllers = getMethodInfoFinds('./test', 'OverloadTestServiceImpl.java');
  // for (let nMethod = 0; nMethod < methodsInControllers.length; nMethod++) {
  //   const methodInControllers = methodsInControllers[nMethod];
  //   const { callers } = methodInControllers;
  //   console.log(callers);
  // }

  // const methodsInControllers = getMethodInfoFinds(
  //   config.path.test,
  //   'AnnotationTestController.java',
  //   'controller'
  // );
  // for (let nMethod = 0; nMethod < methodsInControllers.length; nMethod++) {
  //   const methodInControllers = methodsInControllers[nMethod];
  //   const { mappingValues } = methodInControllers;
  //   console.log(mappingValues);
  // }

  const xmls = getXmlNodeInfoFinds('./test', 'IncludeTest.xml');
  for (let i = 0; i < xmls.length; i++) {
    const { namespace, id, tagName, params, tables } = xmls[i];
    console.log(namespace, id, tagName, params, tables);
  }

  // const viewSql = readFileSync(`${config.path.test}/viewTest.sql`, 'utf-8');
  // const tables = new Set<string>(['TAB1', 'TAB2', 'TAB3', 'TAB4', 'TAB5', 'TAB6', 'TAB7', 'TAB8', 'TAB9']);
  // const objectAndTables = getObjectAndTables(viewSql, tables);
  // const tablesUsed = objectAndTables.map(({ tables }) => [...tables]).flat();
  // // ['TAB1', 'TAB2', 'TAB3', 'TAB4', 'TAB6', 'TAB7', 'TAB8']
  // console.log(tablesUsed);
}
// doTest();

// getControllerInfo(
//   'D:\\Temp\\kbbizmicro-sb\\bz-manual-api-common\\src\\main\\java\\biz\\micro\\portal\\manual\\api\\common\\controller',
//   'ManualEditorController.java'
// );
// getServiceImplInfo(
//   'D:\\Temp\\kbbizmicro-sb\\bz-manual-api-common\\src\\main\\java\\biz\\micro\\portal\\manual\\api\\common\\spring\\service',
//   'ManualServiceImpl.java'
// );
// getXmlIds('D:\\Temp\\kbbizmicro-sb\\bz-manual-api-common\\src\\main\\resources\\sql\\oracle', 'manual_common.xml');
