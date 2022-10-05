import { ConfigType } from '../ConfigType';

export const configComposite: ConfigType = {
  name: 'Composite2',
  path: {
    source: {
      rootDir: 'D:/Temp/kbbizmicro-sb',
      dependency: [],
      main: [
        {
          startings: {
            directory: 'bz-manual-api-common/src/main/java/biz/micro/portal/manual/api/common/controller',
            file: '*Controller.java',
          },
          serviceXmlJspDirs: {
            service: {
              directory: 'bz-manual-api-common/src/main/java/biz/micro/portal/manual/api/common/spring/service',
              file: /.+Impl\.java|.+DAO\.java/,
            },
            xml: 'bz-manual-api-common/src/main/resources/sql/oracle',
            jspDirectory: '',
          },

          keyName: 'bz-manual-api-common',
        },
        {
          startings: {
            directory: 'bz-store-api-bizgroup/src/main/java/biz/micro/portal/store/api/bizgroup/controller',
            file: '*Controller.java',
          },
          serviceXmlJspDirs: {
            service: {
              directory: 'bz-store-api-bizgroup/src/main/java/biz/micro/portal/store/api/bizgroup/spring/service',
              file: /.+Impl\.java|.+DAO\.java/,
            },
            xml: 'bz-store-api-bizgroup/src/main/resources/sql/oracle',
            jspDirectory: '',
          },

          keyName: 'bz-store-api-bizgroup',
        },
        {
          startings: {
            directory: 'bz-portal-api-account/src/main/java/biz/micro/portal/common/api/account/service',
            file: '*Impl.java',
          },
          serviceXmlJspDirs: {
            service: {
              directory: 'bz-portal-api-account/src/main/java/biz/micro/portal/common/api/account/service',
              file: /.+Impl\.java|.+DAO\.java/,
            },
            xml: 'bz-portal-api-account/src/main/resources/sql/oracle',
            jspDirectory: '',
          },

          keyName: 'bz-portal-api-account',
        },
      ],
    },
    data: {
      users: './data/users.txt',
      tables: './data/tables',
      views: './data/views',
      functions: './data/functions',
      procedures: './data/procedures',
      packages: './data/packages',
    },
    databaseDirectory: './data/databases',
    outputDirectory: './output',
    logDirectory: './output/log',
  },
  startingPoint: 'map',
};
