import { Config } from './configTypes';

export const configBzManualApiCommon: Config = {
  path: {
    source: {
      rootDir: 'D:/Temp/kbbizmicro-sb',
      main: [
        {
          startings: [
            {
              directory: 'bz-manual-api-common/src/main/java/biz/micro/portal/manual/api/common/controller',
              file: '*Controller.java',
            },
          ],
          serviceAndXmls: [
            {
              service: {
                directory: 'bz-manual-api-common/src/main/java/biz/micro/portal/manual/api/common/spring/service',
                file: /.+Impl\.java|.+DAO\.java/,
              },
              xml: 'bz-manual-api-common/src/main/resources/sql/oracle',
            },
          ],
          filePostfix: '-bz-manual-api-common2',
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
