import { ConfigType } from '../ConfigType';

export const configJspModelAndView: ConfigType = {
  name: 'JspModelAndView2',
  path: {
    source: {
      rootDir: 'C:/source/trace-web-call/test',
      dependency: [],
      main: [
        {
          startings: { directory: `jspModelAndView`, file: 'ModelAndViewTestController.java' },
          keyName: 'jspModelAndView',
          service: {
            directory: 'jspModelAndView',
            file: 'ModelAndViewTestController.java',
          },
          xmlDirectory: '',
          jspDirectory: 'jspModelAndView',
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
  startingPoint: 'mapping',
  defaultOwner: '',
};
