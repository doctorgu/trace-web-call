import { ConfigType } from '../ConfigType';

export const configOtherUserTable: ConfigType = {
  name: 'OtherUserTable2',
  path: {
    source: {
      rootDir: 'C:/source/trace-web-call',
      dependency: [
        {
          keyName: 'OtherDep',
          service: { directory: `test/`, file: 'OtherUserTablesDependency.java' },
          xml: 'test/OtherUserTablesDependency.xml',
        },
      ],
      main: [
        {
          startings: { directory: `test/`, file: 'OtherUserTablesController.java' },
          keyName: 'OtherUserTables',
          service: {
            directory: 'test',
            file: 'OtherUserTablesBase.java',
          },
          xml: 'test/OtherUserTables.xml',
          jspDirectory: '',
        },
      ],
    },
    data: {
      users: './data/users.txt',
      tables: './test/OtherUserTables.txt',
      views: '',
      functions: '',
      procedures: '',
      packages: '',
    },
    databaseDirectory: './data/databases',
    outputDirectory: './test/output',
    logDirectory: './test/output',
  },
  startingPoint: 'map',
  defaultOwner: '',
};
