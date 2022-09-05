import { ObjectType, ObjectAndTables } from '../common/sqlHelper';

export type OutputType = 'txt' | 'csv';
export type StartingPoint = 'map' | 'publicMethod';

export type DirectoryAndFilePattern = { directory: string; file: string | RegExp };

export type Config = {
  path: {
    source: {
      rootDir: string;
      main: {
        startings: DirectoryAndFilePattern[];
        serviceAndXmls: {
          service: DirectoryAndFilePattern;
          xml: string;
        }[];
        filePostfix: string;
      }[];
      dependency: {
        service: DirectoryAndFilePattern;
        xml: string;
      }[];
    };
    data: {
      tables: string;
      views: string;
      functions: string;
      procedures: string;
    };
    database: string;
    outputDirectory: string;
  };
  outputType: OutputType;
  startingPoint: StartingPoint;
};
