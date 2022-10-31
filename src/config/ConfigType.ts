export type OutputType = 'txt' | 'csv';
export type StartingPoint = 'mapping' | 'publicMethod' | 'springBatch';

export type DirectoryAndFilePattern = { directory: string; directoryIgnore?: string; file: string | RegExp };

export type ConfigType = {
  name: string;
  path: {
    source: {
      rootDir: string;
      dependency: {
        keyName: string;
        service: DirectoryAndFilePattern;
        xmlDirectory: string;
      }[];
      main: {
        keyName: string;
        startings: DirectoryAndFilePattern;
        service: DirectoryAndFilePattern;
        xmlDirectory: string;
        jspDirectory: string;
      }[];
    };
    data: {
      users: string;
      tables: string;
      views: string;
      functions: string;
      procedures: string;
      packages: string;
    };
    databaseDirectory: string;
    outputDirectory: string;
    logDirectory: string;
  };
  startingPoint: StartingPoint;
  defaultOwner: string;
};
