import { Config } from './configTypes';

export const configCompositeTest: Config = {
  path: {
    source: {
      rootDir: 'D:/Temp/kbbizmicro-sb',
      main: [
        {
          startings: {
            directory: 'bz-store-api-bizgroup/src/main/java/biz/micro/portal/store/api/bizgroup/controller',
            file: 'BizBuilderController.java',
          },
          serviceAndXmls: [
            {
              service: {
                directory: 'bz-store-api-bizgroup/src/main/java/biz/micro/portal/store/api/bizgroup/spring/service',
                file: /.+Impl\.java|.+DAO\.java/,
              },
              xml: 'bz-store-api-bizgroup/src/main/resources/sql/oracle',
            },
          ],
          keyName: '-bz-store-api-bizgroupTest2',
        },
      ],
      dependency: [],
    },
    data: {
      tables: './data/tables',
      views: './data/views',
      functions: './data/functions',
      procedures: './data/procedures',
    },
    database: './data/databases/CompositeTest.db',
    outputDirectory: './output',
    logDirectory: './output/log',
  },
  outputType: 'txt',
  startingPoint: 'map',
};
