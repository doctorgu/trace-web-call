import { Config } from './configTypes';

export const configOtherUserTable: Config = {
  path: {
    main: [
      {
        controllers: [{ directory: `./test/`, file: 'OtherUserTablesController.java' }],
        service: {
          directory: './test',
          file: 'OtherUserTablesBase.java',
        },
        xml: './test/OtherUserTables.xml',
        filePostfix: 'OtherUserTables',
      },
    ],
    dependency: [
      {
        service: { directory: `./test/`, file: 'OtherUserTablesDependency.java' },
        xml: './test/OtherUserTablesDependency.xml',
      },
    ],
    data: {
      tables: './test/OtherUserTables.txt',
      views: '',
      functions: '',
      procedures: '',
    },
    outputDirectory: './test/output',
  },
  outputType: 'txt',
};
