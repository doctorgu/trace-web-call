import { Config } from './configTypes';

export const configJspTest2: Config = {
  name: 'JspTest2',
  path: {
    source: {
      rootDir: 'C:/source/trace-web-call/test',
      dependency: [],
      main: [
        {
          startings: { directory: `jspTest2`, file: 'ReturnTraceTestController.java' },
          serviceXmlJspDirs: {
            service: {
              directory: 'jspTest2',
              file: 'Util.java',
            },
            xml: '',
            jspDirectory: '',
          },
          keyName: 'jspTest2',
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
