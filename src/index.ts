// @RequestMapping(value="/coe/cs"+ACTION_NAME)
// * Two class case
// * Add current className, methodName, parameterCount to routes !!! to check: routeTypePrev === 'method' && valuePrev === value && depthPrev <= depth
// * Selecting user_name.tables support
// * extends support
// * dependency support
// * Remove quoted text from sql
// * Starting point is not mapping

import { writeFileSync } from 'fs';
import { config } from './config/config';
import { getMethodInfoFinds, getXmlNodeInfoFinds, getStartToTables, getDependency } from './common/traceHelper';

function writeStartToTables() {
  function getBranch(depth: number) {
    if (depth === 0) return '';
    // return `|---${'-'.repeat((depth - 1) * 4)}`;
    return `${' '.repeat((depth - 1) * 4)}+-- `;
  }

  const { finds: findsDependency, xmls: xmlsDependency } = getDependency();

  for (let i = 0; i < config.path.main.length; i++) {
    const { startings, service, xml, filePostfix } = config.path.main[i];

    console.log(`Parsing ${startings.map((c) => c.directory).join(',')}`);
    let findsController = startings.map(({ directory, file }) => getMethodInfoFinds(directory, file)).flat();
    console.log(`Parsing ${service.directory}`);
    const findsService = getMethodInfoFinds(service.directory, service.file);

    const xmls = getXmlNodeInfoFinds(xml, '*.xml');

    const startToTablesAll: string[] = [];
    const routesAll: string[] = [];

    console.log(`Get starting to table...`);
    const startToTables = getStartToTables(
      findsController,
      findsService,
      xmls,
      findsDependency,
      xmlsDependency,
      config.startingPoint
    );
    let headerStartToTables = '';
    let headerRoutes = '';
    let lineSepRoutes = '';

    if (config.outputType === 'txt') {
      lineSepRoutes = '\n\n';

      for (const { mappingOrMethod, tables, routes } of startToTables) {
        const tablesComma = [...tables].sort().join(',');

        startToTablesAll.push(`${mappingOrMethod}: ${tablesComma}`);
        routesAll.push(
          routes
            .map(({ routeType, value, depth }) => `${routeType.padStart(9, ' ')}: ${getBranch(depth)}${value}`)
            .join('\n')
        );
      }
    } else if (config.outputType === 'csv') {
      headerStartToTables = 'Mapping,Table\n';
      headerRoutes = 'Name,Depth,Value\n';
      lineSepRoutes = '\n';

      for (const { mappingOrMethod, tables, routes } of startToTables) {
        const tablesComma = `"${[...tables].sort().join(',')}"`;

        startToTablesAll.push(`${mappingOrMethod},${tablesComma}`);
        routesAll.push(routes.map(({ routeType, value, depth }) => `${routeType},${depth},"${value}"`).join('\n'));
      }
    }

    const pathStartToTable = `${config.path.outputDirectory}/${config.startingPoint}ToTables${filePostfix}.${config.outputType}`;
    console.log(`Writing to ${pathStartToTable}`);
    writeFileSync(pathStartToTable, `${headerStartToTables}${startToTablesAll.join('\n')}`, 'utf-8');

    const pathRoute = `${config.path.outputDirectory}/routes${filePostfix}.${config.outputType}`;
    console.log(`Writing to ${pathRoute}`);
    writeFileSync(pathRoute, `${headerRoutes}${routesAll.join(lineSepRoutes)}`, 'utf-8');
  }
}
writeStartToTables();

function doTest() {
  // const methodsInStartings = getMethodInfoFinds('./test', 'OverloadTestServiceImpl.java');
  // for (let nMethod = 0; nMethod < methodsInStartings.length; nMethod++) {
  //   const methodInStartings = methodsInStartings[nMethod];
  //   const { callers } = methodInStartings;
  //   console.log(callers);
  // }
  // const methodsInStartings = getMethodInfoFinds(
  //   config.path.test,
  //   'AnnotationTestController.java',
  //   'controller'
  // );
  // for (let nMethod = 0; nMethod < methodsInStartings.length; nMethod++) {
  //   const methodInStartings = methodsInStartings[nMethod];
  //   const { mappingValues } = methodInStartings;
  //   console.log(mappingValues);
  // }
  // const xmls = getXmlNodeInfoFinds('./test', 'IncludeTest.xml');
  // for (let i = 0; i < xmls.length; i++) {
  //   const { namespace, id, tagName, params, tables } = xmls[i];
  //   console.log(namespace, id, tagName, params, tables);
  // }
  // const viewSql = readFileSync(`${config.path.test}/viewTest.sql`, 'utf-8');
  // const tables = new Set<string>(['TAB1', 'TAB2', 'TAB3', 'TAB4', 'TAB5', 'TAB6', 'TAB7', 'TAB8', 'TAB9']);
  // const objectAndTables = getObjectAndTables(viewSql, tables);
  // const tablesUsed = objectAndTables.map(({ tables }) => [...tables]).flat();
  // // ['TAB1', 'TAB2', 'TAB3', 'TAB4', 'TAB6', 'TAB7', 'TAB8']
  // console.log(tablesUsed);
}
// doTest();
