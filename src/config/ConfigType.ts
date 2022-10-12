export type OutputType = 'txt' | 'csv';
export type StartingPoint = 'map' | 'publicMethod';

export type DirectoryAndFilePattern = { directory: string; file: string | RegExp };

export type ConfigType = {
  name: string;
  path: {
    source: {
      rootDir: string;
      dependency: {
        keyName: string;
        service: DirectoryAndFilePattern;
        xml: string;
      }[];
      main: {
        startings: DirectoryAndFilePattern;
        keyName: string;
        service: DirectoryAndFilePattern;
        xml: string;
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
