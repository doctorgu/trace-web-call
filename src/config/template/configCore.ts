import { ConfigType } from '../ConfigType';

export const configCore: ConfigType = {
  name: 'Core2',
  path: {
    source: {
      rootDir: 'C:/source/hmall',
      dependency: [
        {
          service: {
            directory: 'hdhs_core/hshop_batch_core/src/main/java/hshop/batch/core',
            file: /.+Impl\.java|.+DAO\.java/,
          },
          xmlDirectory: 'hdhs_core/hshop_batch_core/src/main/resources/hshop/sqlmap/core',
          keyName: 'hshop_batch_core',
        },
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
            directory: 'hdhs_core/hshop_core_hscs/src/main/java/hshop/core',
            file: /.+Impl\.java|.+DAO\.java/,
          },
          xmlDirectory: 'hdhs_core/hshop_core_hscs/src/main/resources/hshop/sqlmap/hshop/core',
          keyName: 'hshop_core_hscs',
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
            directory: 'hdhs_core/hshop_batch_core/src/main/java/hshop/batch/core',
            file: '*Impl.java',
          },
          service: { directory: '', file: '' },
          xmlDirectory: '',
          jspDirectory: '',
          keyName: 'hshop_batch_core',
        },
        {
          startings: {
            directory: 'hdhs_core/hshop_core/src/main/java/hshop/core',
            file: '*Impl.java',
          },
          service: { directory: '', file: '' },
          xmlDirectory: '',
          jspDirectory: '',
          keyName: 'hshop_core',
        },
        {
          startings: {
            directory: 'hdhs_core/hshop_core/src/main/java/hshop/core',
            file: '*Impl.java',
          },
          service: { directory: '', file: '' },
          xmlDirectory: '',
          jspDirectory: '',
          keyName: 'hshop_core_hscs',
        },
        {
          startings: {
            directory: 'hdhs_core/hshop_order/src/main/java/hshop/order',
            file: '*Impl.java',
          },
          service: { directory: '', file: '' },
          xmlDirectory: '',
          jspDirectory: '',
          keyName: 'hshop_order',
        },
        {
          startings: {
            directory: 'hdhs_core/hshop_prmo/src/main/java/hshop/prmo/service',
            file: '*Impl.java',
          },
          service: { directory: '', file: '' },
          xmlDirectory: '',
          jspDirectory: '',
          keyName: 'hshop_prmo',
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
  startingPoint: 'publicMethod',
  defaultOwner: 'HDHS',
};
