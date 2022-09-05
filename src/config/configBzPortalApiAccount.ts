import { Config } from './configTypes';

export const configBzPortalApiAccount: Config = {
  path: {
    source: {
      rootDir: 'D:/Temp/kbbizmicro-sb',
      main: [
        {
          startings: [
            {
              directory: 'bz-portal-api-account/src/main/java/biz/micro/portal/common/api/account/service',
              file: '*Impl.java',
            },
          ],
          serviceAndXmls: [
            {
              service: {
                directory: 'bz-portal-api-account/src/main/java/biz/micro/portal/common/api/account/service',
                file: /.+Impl\.java|.+DAO\.java/,
              },
              xml: 'bz-portal-api-account/src/main/resources/sql/oracle',
            },
          ],
          filePostfix: '-bz-portal-api-account2',
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
  startingPoint: 'publicMethod',
  outputType: 'txt',
};
