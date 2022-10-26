import { ConfigType } from '../ConfigType';

export const configBatchTest: ConfigType = {
  name: 'BatchTest2',
  path: {
    source: {
      rootDir: 'C:/source/trace-web-call/test',
      dependency: [],
      main: [
        {
          keyName: 'batchTest',
          startings: { directory: `batchTest`, file: 'AlrimiDayJob.xml' },
          service: {
            directory: 'batchTest',
            file: '*DAO.java',
          },
          xmlDirectory: 'batchTest',
          jspDirectory: '',
        },
      ],
    },
    data: {
      users: './data/users.txt',
      tables: './data/tables',
      views: '',
      functions: '',
      procedures: '',
      packages: '',
    },
    databaseDirectory: './data/databases',
    outputDirectory: './test/output',
    logDirectory: './test/output',
  },
  startingPoint: 'springBatch',
  defaultOwner: '',
};
