import { ConfigType } from '../ConfigType';

export const configBO: ConfigType = {
  name: 'BO2',
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
            directory: 'hshop/homs/src/main/java/hsis',
            file: '*Controller.java',
          },
          service: {
            directory: 'hshop/homs/src/main/java/hsis',
            file: /.+Impl\.java|.+DAO\.java/,
          },
          xmlDirectory: 'hshop/homs/src/main/resources/hsis/sqlmap/hsis',
          jspDirectory: '',
          keyName: 'homs',
        },
        {
          startings: {
            directory: 'hshop/hsas/src/main/java/hsas',
            file: '*Controller.java',
          },
          service: {
            directory: 'hshop/hsas/src/main/java/hsas',
            file: /.+Impl\.java|.+DAO\.java/,
          },
          xmlDirectory: 'hshop/hsas/src/main/resources/hsas/sqlmap/hsas',
          jspDirectory: '',
          keyName: 'hsas',
        },
        {
          startings: {
            directory: 'hshop/hscs/src/main/java/hscs',
            file: '*Controller.java',
          },
          service: {
            directory: 'hshop/hscs/src/main/java/hscs',
            file: /.+Impl\.java|.+DAO\.java/,
          },
          xmlDirectory: 'hshop/hscs/src/main/resources/hscs/sqlmap/hscs',
          jspDirectory: '',
          keyName: 'hscs',
        },
        {
          startings: {
            directory: 'hshop/hsds/src/main/java/hsds',
            file: '*Controller.java',
          },
          service: {
            directory: 'hshop/hsds/src/main/java/hsds',
            file: /.+Impl\.java|.+DAO\.java/,
          },
          xmlDirectory: 'hshop/hsds/src/main/resources/hsds/sqlmap/hsds',
          jspDirectory: '',
          keyName: 'hsds',
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
