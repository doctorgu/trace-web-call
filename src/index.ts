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
  const methods = methodsInControllers.concat(methodsInServiceImpls);

  const xmls = await getXmlNodeInfoFinds(config.path.xml, '*.xml');

  const mappingAndTables: MappingToTables[] = [];

  for (let nMethod = 0; nMethod < methodsInControllers.length; nMethod++) {
    const methodInControllers = methodsInControllers[nMethod];
    const { className, annotations, name: methodName } = methodInControllers;
    const mappingHasValue = annotations.find(({ name, values }) => name.endsWith('Mapping') && values.length);
    if (!mappingHasValue) continue;

    const routes: RouteInfo[] = [];
    const { name: mappingName, values } = mappingHasValue;

    for (let nValue = 0; nValue < values.length; nValue++) {
      const value = values[nValue];
      routes.push({ routeType: 'mapping', value: `${mappingName}(${value})` });
      routes.push({ routeType: 'method', value: `${className}.${methodName}` });

      const tables = getTableNamesByMethod(methodInControllers, methods, xmls, routes);
      mappingAndTables.push({ mapping: mappingHasValue, tables, routes });
      // console.log(routes);
    }
  }
  // console.log(mappingAndTables);
  return mappingAndTables;
}

async function writeMappingToTables() {
  const mapToTables: string[] = [];
  const routeLogs: string[] = [];
  const mappingToTables = await getMappingToTables();
  for (const { mapping, tables, routes } of mappingToTables) {
    for (let nValue = 0; nValue < mapping.values.length; nValue++) {
      const value = mapping.values[nValue];
      mapToTables.push(`${value}: ${[...tables].join(',')}`);
      routeLogs.push(routes.map(({ routeType, value }) => `${routeType.padStart(7, ' ')}: ${value}`).join('\n'));
    }
  }

  writeFileSync(config.path.output.mapToTables, mapToTables.join('\n'), 'utf-8');
  writeFileSync(config.path.output.routes, routeLogs.join('\n\n'), 'utf-8');
}
// writeMappingToTables();

async function doTest() {
  console.log(config.path.test);
  const methodsInControllers = await getMethodInfoFinds(
    config.path.test,
    'AnnotationTestController.java',
    'controller'
  );
  for (let nMethod = 0; nMethod < methodsInControllers.length; nMethod++) {
    const methodInControllers = methodsInControllers[nMethod];
    const { annotations } = methodInControllers;
    console.log(annotations);
  }
}
doTest();

// getControllerInfo(
//   'D:\\Temp\\kbbizmicro-sb\\bz-manual-api-common\\src\\main\\java\\biz\\micro\\portal\\manual\\api\\common\\controller',
//   'ManualEditorController.java'
// );
// getServiceImplInfo(
//   'D:\\Temp\\kbbizmicro-sb\\bz-manual-api-common\\src\\main\\java\\biz\\micro\\portal\\manual\\api\\common\\spring\\service',
//   'ManualServiceImpl.java'
// );
// getXmlIds('D:\\Temp\\kbbizmicro-sb\\bz-manual-api-common\\src\\main\\resources\\sql\\oracle', 'manual_common.xml');
