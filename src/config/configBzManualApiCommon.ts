import { Config } from './configTypes';

export const configBzManualApiCommon: Config = {
  path: {
    main: [
      {
        startings: [
          {
            directory:
              'D:/Temp/kbbizmicro-sb/bz-manual-api-common/src/main/java/biz/micro/portal/manual/api/common/controller',
            file: '*Controller.java',
          },
        ],
        serviceAndXmls: [
          {
            service: {
              directory:
                'D:/Temp/kbbizmicro-sb/bz-manual-api-common/src/main/java/biz/micro/portal/manual/api/common/spring/service',
              file: /.+Impl\.java|.+DAO\.java/,
            },
            xml: 'D:/Temp/kbbizmicro-sb/bz-manual-api-common/src/main/resources/sql/oracle',
          },
        ],
        filePostfix: '-bz-manual-api-common2',
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
  outputType: 'txt',
  startingPoint: 'map',
};
