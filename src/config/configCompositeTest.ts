import { Config } from './configTypes';

export const configCompositeTest: Config = {
  name: 'CompositeTest2',
  path: {
    source: {
      rootDir: 'D:/Temp/kbbizmicro-sb',
      dependency: [],
      main: [
        {
          startings: {
            directory: 'bz-store-api-bizgroup/src/main/java/biz/micro/portal/store/api/bizgroup/controller',
            file: 'BizBuilderController.java',
          },
          serviceXmlJspDirs: {
            service: {
              directory: 'bz-store-api-bizgroup/src/main/java/biz/micro/portal/store/api/bizgroup/spring/service',
              file: /.+Impl\.java|.+DAO\.java/,
            },
            xml: 'bz-store-api-bizgroup/src/main/resources/sql/oracle',
            jspDirectory: '',
          },

          keyName: 'bz-store-api-bizgroupTest',
        },
      ],
    },
    data: {
      tables: './data/tables',
      views: './data/views',
      functions: './data/functions',
      procedures: './data/procedures',
    },
    databaseDirectory: './data/databases',
    outputDirectory: './output',
    logDirectory: './output/log',
  },

  startingPoint: 'map',
};
