import { writeFileSync } from 'fs';
import { config } from './config/config';
import {
  RouteInfo,
  MappingToTables,
  getMethodInfoFinds,
  getXmlNodeInfoFinds,
  getTableNamesByMethod,
} from './common/traceHelper';

async function getMappingToTables(): Promise<MappingToTables[]> {
  const methodsInControllers = await getMethodInfoFinds(config.path.controller, '*Controller.java', 'controller');
  const methodsInServiceImpls = await getMethodInfoFinds(config.path.service, '*Impl.java', 'serviceImpl');
  // const methodsInServiceImpls = await getMethodInfoFinds(
  //   config.path.service,
  //   'CSManualServiceImpl.java',
  //   'serviceImpl'
  // );
  const methods = methodsInControllers.concat(methodsInServiceImpls);

  const xmls = await getXmlNodeInfoFinds(config.path.xml, '*.xml');

  const mappingAndTables: MappingToTables[] = [];

  for (let nMethod = 0; nMethod < methodsInControllers.length; nMethod++) {
    const methodInControllers = methodsInControllers[nMethod];
    const { className, mappingValues, name: methodName } = methodInControllers;
    if (!mappingValues.length) continue;

    const routes: RouteInfo[] = [];

    for (let nValue = 0; nValue < mappingValues.length; nValue++) {
      const mappingValue = mappingValues[nValue];

      let depth = -1;
      routes.push({ routeType: 'mapping', value: `${mappingValue}`, depth: ++depth });
      routes.push({ routeType: 'method', value: `${className}.${methodName}`, depth: ++depth });

      const tables = getTableNamesByMethod(methodInControllers, methods, xmls, routes, depth + 1);
      mappingAndTables.push({ mappingValue, tables, routes });
      // console.log(routes);
    }
  }
  // console.log(mappingAndTables);
  return mappingAndTables;
}

async function writeMappingToTables() {
  function getBranch(depth: number) {
    if (depth === 0) return '';
    return `${' '.repeat((depth - 1) * 4)}+-- `;
  }

  const mapToTables: string[] = [];
  const routeLogs: string[] = [];
  const mappingToTables = await getMappingToTables();
  for (const { mappingValue, tables, routes } of mappingToTables) {
    mapToTables.push(`${mappingValue}: ${[...tables].join(',')}`);
    routeLogs.push(
      routes
        .map(({ routeType, value, depth }) => `${routeType.padStart(7, ' ')}: ${getBranch(depth)}${value}`)
        .join('\n')
    );
  }

  writeFileSync(config.path.output.mapToTables, mapToTables.join('\n'), 'utf-8');
  writeFileSync(config.path.output.routes, routeLogs.join('\n\n'), 'utf-8');
}
writeMappingToTables();

async function doTest() {
  console.log(config.path.test);
  // const methodsInControllers = await getMethodInfoFinds(
  //   config.path.test,
  //   'AnnotationTestController.java',
  //   'controller'
  // );
  // for (let nMethod = 0; nMethod < methodsInControllers.length; nMethod++) {
  //   const methodInControllers = methodsInControllers[nMethod];
  //   const { mappingValues } = methodInControllers;
  //   console.log(mappingValues);
  // }
  const xmls = await getXmlNodeInfoFinds(config.path.test, 'IncludeTest.xml');
  for (let i = 0; i < xmls.length; i++) {
    const { namespace, id, tagName, params, tables } = xmls[i];
    console.log(namespace, id, tagName, params, tables);
  }
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
