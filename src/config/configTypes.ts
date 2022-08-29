import { ObjectType, ObjectAndTables } from '../common/sqlHelper';

export type OutputType = 'txt' | 'csv';

export type DirectoryAndFilePattern = { directory: string; file: string | RegExp };

export type Config = {
  path: {
    main: {
      controllers: DirectoryAndFilePattern[];
      service: DirectoryAndFilePattern;
      xml: string;
      filePostfix: string;
    }[];
    dependency: {
      service: DirectoryAndFilePattern;
      xml: string;
    }[];
    data: {
      tables: string;
      views: string;
      functions: string;
      procedures: string;
    };
    outputDirectory: string;
  };
  outputType: OutputType;
};
