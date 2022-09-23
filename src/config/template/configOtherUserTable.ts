import { ConfigType } from '../ConfigType';

export const configOtherUserTable: ConfigType = {
  name: 'OtherUserTable2',
  path: {
    source: {
      rootDir: 'C:/source/trace-web-call',
      dependency: [
        {
          service: { directory: `test/`, file: 'OtherUserTablesDependency.java' },
          xml: 'test/OtherUserTablesDependency.xml',
          jspDirectory: '',
        },
      ],
      main: [
        {
          startings: { directory: `test/`, file: 'OtherUserTablesController.java' },
          serviceXmlJspDirs: {
            service: {
              directory: 'test',
              file: 'OtherUserTablesBase.java',
            },
            xml: 'test/OtherUserTables.xml',
            jspDirectory: '',
          },

          keyName: 'OtherUserTables',
        },
      ],
    },
    data: {
      tables: './test/OtherUserTables.txt',
      views: '',
      functions: '',
      procedures: '',
    },
    databaseDirectory: './data/databases',
    outputDirectory: './test/output',
    logDirectory: './test/output',
  },

  startingPoint: 'map',
};
