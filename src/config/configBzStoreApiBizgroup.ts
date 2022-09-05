import { Config } from './configTypes';

export const configBzStoreApiBizgroup: Config = {
  path: {
    source: {
      rootDir: 'D:/Temp/kbbizmicro-sb',
      main: [
        {
          startings: [
            {
              directory: 'bz-store-api-bizgroup/src/main/java/biz/micro/portal/store/api/bizgroup/controller',
              file: '*Controller.java',
            },
          ],
          serviceAndXmls: [
            {
              service: {
                directory: 'bz-store-api-bizgroup/src/main/java/biz/micro/portal/store/api/bizgroup/spring/service',
                file: /.+Impl\.java|.+DAO\.java/,
              },
              xml: 'bz-store-api-bizgroup/src/main/resources/sql/oracle',
            },
          ],
          filePostfix: '-bz-store-api-bizgroup2',
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
    outputDirectory: './output',
    database: './data/databases/traceWebCall.db',
  },
  outputType: 'txt',
  startingPoint: 'map',
};
