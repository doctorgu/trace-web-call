export type OutputType = 'txt' | 'csv';
export type StartingPoint = 'map' | 'publicMethod';

export type DirectoryAndFilePattern = { directory: string; file: string | RegExp };

export type ConfigType = {
  name: string;
  path: {
    source: {
      rootDir: string;
      dependency: {
        service: DirectoryAndFilePattern;
        xml: string;
        jspDirectory: string;
      }[];
      main: {
        startings: DirectoryAndFilePattern;
        serviceXmlJspDirs: {
          service: DirectoryAndFilePattern;
          xml: string;
          jspDirectory: string;
        };
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
