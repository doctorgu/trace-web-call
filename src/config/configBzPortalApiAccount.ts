import { Config } from './configTypes';

export const configBzPortalApiAccount: Config = {
  path: {
    main: [
      {
        startings: [
          {
            directory:
              'D:/Temp/kbbizmicro-sb/bz-portal-api-account/src/main/java/biz/micro/portal/common/api/account/service',
            file: '*Impl.java',
          },
        ],
        service: {
          directory:
            'D:/Temp/kbbizmicro-sb/bz-portal-api-account/src/main/java/biz/micro/portal/common/api/account/service',
          file: /.+Impl\.java|.+DAO\.java/,
        },
        xml: 'D:/Temp/kbbizmicro-sb/bz-portal-api-account/src/main/resources/sql/oracle',
        filePostfix: '-bz-portal-api-account2',
      },
    ],
    dependency: [],
    data: {
      tables: './data/tables',
      views: './data/views',
      functions: './data/functions',
      procedures: './data/procedures',
    },
    outputDirectory: './output',
  },
  startingPoint: 'publicMethod',
  outputType: 'txt',
};
