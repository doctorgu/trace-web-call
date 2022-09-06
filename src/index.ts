// @RequestMapping(value="/coe/cs"+ACTION_NAME)
// * Two class case
// * Add current className, methodName, parameterCount to routes !!! to check: routeTypePrev === 'method' && valuePrev === value && depthPrev <= depth
// * Selecting user_name.tables support
// * extends support
// * dependency support
// * Remove quoted text from sql
// * Starting point is not mapping

import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { config } from './config/config';
import { getMethodInfoFinds } from './common/classHelper';
import { getXmlNodeInfoFinds, getStartToTables, getDependency } from './common/traceHelper';
import { readFileSyncUtf16le, removeCommentLiteralSql } from './common/util';
import { saveToDb } from './run/saveToDb';

function writeStartToTables() {
  function getBranch(depth: number) {
    if (depth === 0) return '';
    // return `|---${'-'.repeat((depth - 1) * 4)}`;
    return `${' '.repeat((depth - 1) * 4)}+-- `;
  }

  const { xmls: xmlsDependency } = getDependency();

  const { rootDir } = config.path.source;
  for (let i = 0; i < config.path.source.main.length; i++) {
    const { startings, serviceAndXmls, filePostfix } = config.path.source.main[i];

    const findsController = startings.map(({ directory, file }) => getMethodInfoFinds(directory, file)).flat();
    const xmls = serviceAndXmls.map(({ xml }) => getXmlNodeInfoFinds(rootDir, xml, '*.xml')).flat();

    const startToTablesAll: string[] = [];
    const routesAll: string[] = [];

    console.log(`Get starting to tables...`);
    const startToTables = getStartToTables(findsController, xmls, xmlsDependency, config.startingPoint);
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
  // const methodsInStartings = getMethodInfoFinds('./test', 'OverloadTestServiceImpl');
  // for (let nMethod = 0; nMethod < methodsInStartings.length; nMethod++) {
  //   const methodInStartings = methodsInStartings[nMethod];
  //   const { callers } = methodInStartings;
  //   console.log(callers);
  // }
  // const methodsInStartings = getMethodInfoFinds(
  //   config.path.test,
  //   'AnnotationTestController',
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
  // const viewSql = readFileSyncUtf16le(`${config.path.test}/viewTest.sql`);
  // const tables = new Set<string>(['TAB1', 'TAB2', 'TAB3', 'TAB4', 'TAB5', 'TAB6', 'TAB7', 'TAB8', 'TAB9']);
  // const objectAndTables = getObjectAndTables(viewSql, tables);
  // const tablesUsed = objectAndTables.map(({ tables }) => [...tables]).flat();
  // // ['TAB1', 'TAB2', 'TAB3', 'TAB4', 'TAB6', 'TAB7', 'TAB8']
  // console.log(tablesUsed);
  // saveToDb();
}
// doTest();
