import { Config } from './configTypes';

export const configComposite: Config = {
  path: {
    main: [
      {
        controllers: [
          {
            directory:
              'D:/Temp/kbbizmicro-sb/bz-manual-api-common/src/main/java/biz/micro/portal/manual/api/common/controller',
            file: '*Controller.java',
          },
        ],
        service: {
          directory:
            'D:/Temp/kbbizmicro-sb/bz-manual-api-common/src/main/java/biz/micro/portal/manual/api/common/spring/service',
          file: /.+Impl\.java|.+DAO\.java/,
        },
        xml: 'D:/Temp/kbbizmicro-sb/bz-manual-api-common/src/main/resources/sql/oracle',
        filePostfix: '-bz-manual-api-common2',
      },
      {
        controllers: [
          {
            directory:
              'D:\\Temp\\kbbizmicro-sb\\bz-store-api-bizgroup\\src\\main\\java\\biz\\micro\\portal\\store\\api\\bizgroup\\controller',
            file: '*Controller.java',
          },
        ],
        service: {
          directory:
            'D:\\Temp\\kbbizmicro-sb\\bz-store-api-bizgroup\\src\\main\\java\\biz\\micro\\portal\\store\\api\\bizgroup\\spring\\service',
          file: /.+Impl\.java|.+DAO\.java/,
        },
        xml: 'D:\\Temp\\kbbizmicro-sb\\bz-store-api-bizgroup\\src\\main\\resources\\sql\\oracle',
        filePostfix: '-bz-store-api-bizgroup2',
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
};
