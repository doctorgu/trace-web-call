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
          keyName: 'jspTest',
          service: {
            directory: 'jspTest',
            file: 'JspTestController.java',
          },
          xml: '',
          jspDirectory: 'jspTest/jsp',
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
