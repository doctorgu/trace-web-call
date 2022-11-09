import { ConfigType } from '../ConfigType';

export const configWellness: ConfigType = {
  name: 'Wellness2',
  path: {
    source: {
      rootDir: 'C:/source/Wellness',
      dependency: [],
      main: [
        {
          startings: {
            directory: 'src/main/java/com/wellness',
            file: '*Controller.java',
          },
          keyName: 'wellness',
          service: {
            directory: 'src/main/java/com/wellness',
            file: '*Svc.java',
          },
          xmlDirectory: 'src/main/resources/sql',
          jspDirectory: '',
        },
      ],
    },
    data: {
      users: '',
      tables: './test/Wellness/data/tables.txt',
      views: '',
      functions: '',
      procedures: '',
      packages: '',
    },
    databaseDirectory: './data/databases',
    outputDirectory: './output',
    logDirectory: './output/log',
  },
  startingPoint: 'mapping',
  defaultOwner: '',
};
