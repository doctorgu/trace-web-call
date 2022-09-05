import { Config } from './configTypes';

export const configOtherUserTable: Config = {
  path: {
    source: {
      rootDir: '.',
      main: [
        {
          startings: [{ directory: `/test/`, file: 'OtherUserTablesController.java' }],
          serviceAndXmls: [
            {
              service: {
                directory: 'test',
                file: 'OtherUserTablesBase.java',
              },
              xml: 'test/OtherUserTables.xml',
            },
          ],
          filePostfix: 'OtherUserTables',
        },
      ],
      dependency: [
        {
          service: { directory: `/test/`, file: 'OtherUserTablesDependency.java' },
          xml: 'test/OtherUserTablesDependency.xml',
        },
      ],
    },
    data: {
      tables: './test/OtherUserTables.txt',
      views: '',
      functions: '',
      procedures: '',
    },
    database: './data/databases/OtherUserTable.db',
    outputDirectory: './test/output',
    logDirectory: './test/output',
  },
  outputType: 'txt',
  startingPoint: 'map',
};
