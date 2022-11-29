import { ConfigType } from '../ConfigType';

export const configFOTest: ConfigType = {
  name: 'FO2',
  path: {
    source: {
      rootDir: 'C:/source/hmall',
      dependency: [],
      main: [
        {
          startings: {
            directory: 'hdhs_hmall/hmall_pc_was/src/main/java/hmall',
            file: 'CCDCnslController.java',
          },

          service: {
            directory: 'hdhs_hmall/hmall_pc_was/src/main/java/hmall',
            file: /.+Impl\.java|.+DAO\.java/,
          },
          xmlDirectory: 'hdhs_hmall/hmall_pc_was/src/main/resources/hmall/sqlmap/hmall',
          jspDirectory: 'hdhs_hmall/hmall_pc_was/src/main/webapp/WEB-INF/jsp',
          keyName: 'hmall_pc_was',
        },
      ],
    },
    data: {
      users: './data/users.txt',
      tables: './data/tables.txt',
      views: './data/views.txt',
      functions: './data/functions',
      procedures: './data/procedures',
      packages: './data/packages',
    },
    databaseDirectory: './data/databases',
    outputDirectory: './output',
    logDirectory: './output/log',
  },
  startingPoint: 'mapping',
  defaultOwner: 'HDHS',
};
