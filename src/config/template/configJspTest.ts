import { ConfigType } from '../ConfigType';

export const configJspTest: ConfigType = {
  name: 'JspTest2',
  path: {
    source: {
      rootDir: 'C:/source/trace-web-call/test',
      dependency: [],
      main: [
        {
          startings: { directory: `jspTest`, file: 'JspTestController.java' },
          serviceXmlJspDirs: {
            service: {
              directory: 'jspTest',
              file: 'JspTestController.java',
            },
            xml: '',
            jspDirectory: 'jspTest/jsp',
          },

          keyName: 'jspTest',
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
