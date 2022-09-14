import { ObjectType, ObjectAndTables } from '../common/sqlHelper';

export type OutputType = 'txt' | 'csv';
export type StartingPoint = 'map' | 'publicMethod';

export type DirectoryAndFilePattern = { directory: string; file: string | RegExp };

export type Config = {
  name: string;
  path: {
    source: {
      rootDir: string;
      dependency: {
        service: DirectoryAndFilePattern;
        xml: string;
      }[];
      main: {
        startings: DirectoryAndFilePattern;
        serviceAndXmls: {
          service: DirectoryAndFilePattern;
          xml: string;
        }[];
        keyName: string;
      }[];
    };
    data: {
      tables: string;
      views: string;
      functions: string;
      procedures: string;
    };
    databaseDirectory: string;
    outputDirectory: string;
    logDirectory: string;
  };
  startingPoint: StartingPoint;
};
