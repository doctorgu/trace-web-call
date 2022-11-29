import { ConfigType } from '../ConfigType';

export const configBatch: ConfigType = {
  name: 'Batch2',
  path: {
    source: {
      rootDir: 'C:/source/hmall',
      dependency: [
        {
          service: {
            directory: 'hdhs_core/hshop_batch_core/src/main/java/hshop/batch/core',
            file: '*.java',
          },
          xmlDirectory: 'hdhs_core/hshop_batch_core/src/main/resources/hshop/sqlmap/core',
          keyName: 'hshop_batch_core',
        },
      ],
      main: [
        {
          keyName: 'acnc_batch',
          startings: {
            directory: 'hshop_batch/acnc_batch/src/main/resources/hsis/job/hsis/batch',
            file: '*.xml',
          },
          service: {
            directory: 'hshop_batch/acnc_batch/src/main',
            file: '*.java',
          },
          xmlDirectory: 'hshop_batch/acnc_batch/src/main/resources/hsis/sqlmap/hsis/batch',
          jspDirectory: '',
        },
        {
          keyName: 'alml_batch',
          startings: {
            directory: 'hshop_batch/alml_batch/src/main/resources/hsis/job/hsis/batch',
            file: '*.xml',
          },
          service: {
            directory: 'hshop_batch/alml_batch/src/main',
            file: '*.java',
          },
          xmlDirectory: 'hshop_batch/alml_batch/src/main/resources/hsis/sqlmap/hsis/batch',
          jspDirectory: '',
        },
        {
          keyName: 'comm_batch',
          startings: {
            directory: 'hshop_batch/comm_batch/src/main/resources/hsis/job/hsis/batch',
            file: '*.xml',
          },
          service: {
            directory: 'hshop_batch/comm_batch/src/main',
            file: '*.java',
          },
          xmlDirectory: 'hshop_batch/comm_batch/src/main/resources/hsis/sqlmap/hsis/batch',
          jspDirectory: '',
        },
        {
          keyName: 'hb2e_batch_new',
          startings: {
            directory: 'hshop_batch/hb2e_batch_new/src/main/resources/hsis/job/hsis/batch',
            file: '*.xml',
          },
          service: {
            directory: 'hshop_batch/hb2e_batch_new/src/main',
            file: '*.java',
          },
          xmlDirectory: 'hshop_batch/hb2e_batch_new/src/main/resources/hsis/sqlmap/hsis/batch',
          jspDirectory: '',
        },
        {
          keyName: 'hdni_batch',
          startings: {
            directory: 'hshop_batch/hdni_batch/src/main/resources/hsis/job/hsis/batch',
            file: '*.xml',
          },
          service: {
            directory: 'hshop_batch/hdni_batch/src/main',
            file: '*.java',
          },
          xmlDirectory: 'hshop_batch/hdni_batch/src/main/resources/hsis/sqlmap/hsis/batch',
          jspDirectory: '',
        },
        {
          keyName: 'hitm_batch',
          startings: {
            directory: 'hshop_batch/hitm_batch/src/main/resources/hsis/job/hsis/batch',
            file: '*.xml',
          },
          service: {
            directory: 'hshop_batch/hitm_batch/src/main',
            file: '*.java',
          },
          xmlDirectory: 'hshop_batch/hitm_batch/src/main/resources/hsis/sqlmap/hsis/batch',
          jspDirectory: '',
        },
        {
          keyName: 'hmall_batch',
          startings: {
            directory: 'hshop_batch/hmall_batch/src/main/resources/hmall/job/hmall/batch',
            directoryIgnore: 'cot',
            file: '*.xml',
          },
          service: {
            directory: 'hshop_batch/hmall_batch/src/main/java',
            file: '*.java',
          },
          xmlDirectory: 'hshop_batch/hmall_batch/src/main/resources/hmall/sqlmap/hmall/batch',
          jspDirectory: '',
        },
        {
          keyName: 'hmall_batch_new',
          startings: {
            directory: 'hshop_batch/hmall_batch_new/src/main/resources/hsis/job/hsis/batch',
            file: '*.xml',
          },
          service: {
            directory: 'hshop_batch/hmall_batch_new/src/main/java',
            file: '*.java',
          },
          xmlDirectory: 'hshop_batch/hmall_batch_new/src/main/resources/hsis/sqlmap/hsis/batch',
          jspDirectory: '',
        },
        {
          keyName: 'homs_batch',
          startings: {
            directory: 'hshop_batch/homs_batch/src/main/resources/hsis/job/hsis/batch',
            directoryIgnore: 'cot',
            file: '*.xml',
          },
          service: {
            directory: 'hshop_batch/homs_batch/src/main/java',
            file: '*.java',
          },
          xmlDirectory: 'hshop_batch/homs_batch/src/main/resources/hsis/sqlmap/hsis/batch',
          jspDirectory: '',
        },
        {
          keyName: 'hscm_batch',
          startings: {
            directory: 'hshop_batch/hscm_batch/src/main/resources/hsis/job/hsis/batch',
            file: '*.xml',
          },
          service: {
            directory: 'hshop_batch/hscm_batch/src/main',
            file: '*.java',
          },
          xmlDirectory: 'hshop_batch/hscm_batch/src/main/resources/hsis/sqlmap/hsis/batch',
          jspDirectory: '',
        },
        {
          keyName: 'hscs_batch',
          startings: {
            directory: 'hshop_batch/hscs_batch/src/main/resources/hscs/job/hscs/batch',
            directoryIgnore: 'cot',
            file: '*.xml',
          },
          service: {
            directory: 'hshop_batch/hscs_batch/src/main',
            file: '*.java',
          },
          xmlDirectory: 'hshop_batch/hscs_batch/src/main/resources/hscs/sqlmap/hscs/batch',
          jspDirectory: '',
        },
        {
          keyName: 'hsis_batch_hmall',
          startings: {
            directory: 'hshop_batch/hsis_batch_hmall/src/main/resources/hsis/job/hsis/batch',
            file: '*.xml',
          },
          service: {
            directory: 'hshop_batch/hsis_batch_hmall/src/main/java',
            file: '*.java',
          },
          xmlDirectory: 'hshop_batch/hsis_batch_hmall/src/main/resources/hsis/sqlmap/hsis/batch',
          jspDirectory: '',
        },
        {
          keyName: 'podw_batch',
          startings: {
            directory: 'hshop_batch/podw_batch/src/main/resources/hsis/job/hsis/batch',
            file: '*.xml',
          },
          service: {
            directory: 'hshop_batch/podw_batch/src/main',
            file: '*.java',
          },
          xmlDirectory: 'hshop_batch/podw_batch/src/main/resources/hsis/sqlmap/hsis/batch',
          jspDirectory: '',
        },
      ],
    },
    data: {
      users: './data/users.txt',
      tables: './data/tables.txt',
      views: './data/views.txt',
      functions: './data/functions',
      procedures: './data/procedures',
      packages: './data/packages',
    },
    databaseDirectory: './data/databases',
    outputDirectory: './output',
    logDirectory: './output/log',
  },
  startingPoint: 'springBatch',
  defaultOwner: 'HDHS', // 'HB2E',
};
