import { ConfigType } from '../ConfigType';

export const configFO: ConfigType = {
  name: 'FO2',
  path: {
    source: {
      rootDir: 'C:/source/hmall',
      dependency: [
        {
          service: {
            directory: 'hdhs_core/hshop_core/src/main/java/hshop/core',
            file: /.+Impl\.java|.+DAO\.java/,
          },
          xmlDirectory: 'hdhs_core/hshop_core/src/main/resources/hshop/sqlmap/hshop/core',
          keyName: 'hshop_core',
        },
        {
          service: {
            directory: 'hdhs_core/hshop_order/src/main/java/hshop/order',
            file: /.+Impl\.java|.+DAO\.java/,
          },
          xmlDirectory: 'hdhs_core/hshop_order/src/main/resources/hshop/order/sqlmap/hshop/order',
          keyName: 'hshop_order',
        },
        {
          service: {
            directory: 'hdhs_core/hshop_prmo/src/main/java/hshop/prmo/service',
            file: /.+Impl\.java|.+DAO\.java/,
          },
          xmlDirectory: 'hdhs_core/hshop_prmo/src/main/resources/hshop/sqlmap/prmo',
          keyName: 'hshop_prmo',
        },
      ],
      main: [
        {
          startings: {
            directory: 'hdhs_hmall/hmall_pc_was/src/main/java/hmall',
            file: '*Cont*oller.java',
          },

          service: {
            directory: 'hdhs_hmall/hmall_pc_was/src/main/java/hmall',
            file: /.+Impl\.java|.+DAO\.java/,
          },
          xmlDirectory: 'hdhs_hmall/hmall_pc_was/src/main/resources/hmall/sqlmap/hmall',
          jspDirectory: 'hdhs_hmall/hmall_pc_was/src/main/webapp/WEB-INF/jsp',
          keyName: 'hmall_pc_was',
        },
        {
          startings: {
            directory: 'hdhs_hmall/hmall_mobile_was/src/main/java/smart',
            file: '*Cont*oller.java',
          },

          service: {
            directory: 'hdhs_hmall/hmall_mobile_was/src/main/java/smart',
            file: /.+Impl\.java|.+DAO\.java/,
          },
          xmlDirectory: 'hdhs_hmall/hmall_mobile_was/src/main/resources/smart/sqlmap/smart',
          jspDirectory: 'hdhs_hmall/hmall_mobile_was/src/main/webapp/jsp',
          keyName: 'hmall_mobile_was',
        },
        {
          startings: {
            directory: 'hdhs_hmall/hmall_pc_event_was/src/main/java',
            file: '*Cont*oller.java',
          },

          service: {
            directory: 'hdhs_hmall/hmall_pc_event_was/src/main/java',
            file: /.+Impl\.java|.+DAO\.java/,
          },
          xmlDirectory: 'hdhs_hmall/hmall_pc_event_was/src/main/resources/event/sqlmap',
          jspDirectory: 'hdhs_hmall/hmall_pc_event_was/src/main/webapp/WEB-INF/jsp',
          keyName: 'hmall_pc_event_was',
        },
        {
          startings: {
            directory: 'hdhs_hmall/hmall_mobile_event_was/src/main/java/smart',
            file: '*Cont*oller.java',
          },

          service: {
            directory: 'hdhs_hmall/hmall_mobile_event_was/src/main/java/smart',
            file: /.+Impl\.java|.+DAO\.java/,
          },
          xmlDirectory: 'hdhs_hmall/hmall_mobile_event_was/src/main/resources/smart/sqlmap',
          jspDirectory: 'hdhs_hmall/hmall_mobile_event_was/src/main/webapp/jsp',
          keyName: 'hmall_mobile_event_was',
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
