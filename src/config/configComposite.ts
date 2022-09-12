import { Config } from './configTypes';

export const configComposite: Config = {
  path: {
    source: {
      rootDir: 'D:/Temp/kbbizmicro-sb',
      main: [
        {
          startings: {
            directory: 'bz-manual-api-common/src/main/java/biz/micro/portal/manual/api/common/controller',
            file: '*Controller.java',
          },
          serviceAndXmls: [
            {
              service: {
                directory: 'bz-manual-api-common/src/main/java/biz/micro/portal/manual/api/common/spring/service',
                file: /.+Impl\.java|.+DAO\.java/,
              },
              xml: 'bz-manual-api-common/src/main/resources/sql/oracle',
            },
          ],
          keyName: '-bz-manual-api-common2',
        },
        {
          startings: {
            directory: 'bz-store-api-bizgroup/src/main/java/biz/micro/portal/store/api/bizgroup/controller',
            file: '*Controller.java',
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
          keyName: '-bz-store-api-bizgroup2',
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
    database: './data/databases/Composite.db',
    outputDirectory: './output',
    logDirectory: './output/log',
  },
  outputType: 'txt',
  startingPoint: 'map',
};
