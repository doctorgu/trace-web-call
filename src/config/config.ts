import { readFileSync } from 'fs';

type Config = {
  path: {
    controller: string;
    service: string;
    xml: string;
    data: {
      tables: string;
    };
    output: {
      mapToTables: string;
      routes: string;
    };
    test: string;
  };
  tables: () => Set<string>;
};

export const config: Config = {
  path: {
    controller:
      'D:\\Temp\\kbbizmicro-sb\\bz-store-api-bizgroup\\src\\main\\java\\biz\\micro\\portal\\store\\api\\bizgroup\\controller',
    //'D:\\Temp\\kbbizmicro-sb\\bz-manual-api-common\\src\\main\\java\\biz\\micro\\portal\\manual\\api\\common\\controller',
    service:
      'D:\\Temp\\kbbizmicro-sb\\bz-store-api-bizgroup\\src\\main\\java\\biz\\micro\\portal\\store\\api\\bizgroup\\spring\\service',
    //'D:\\Temp\\kbbizmicro-sb\\bz-manual-api-common\\src\\main\\java\\biz\\micro\\portal\\manual\\api\\common\\spring\\service',
    xml: 'D:\\Temp\\kbbizmicro-sb\\bz-store-api-bizgroup\\src\\main\\resources\\sql\\oracle',
    //'D:\\Temp\\kbbizmicro-sb\\bz-manual-api-common\\src\\main\\resources\\sql\\oracle',
    data: {
      tables: './data/tables.txt',
    },
    output: {
      mapToTables: './output/mapToTables.txt',
      routes: './output/routes.txt',
    },
    test: './test',
  },
  tables: () => {
    const value = readFileSync(config.path.data.tables, 'utf-8');
    return new Set(value.split(/\r*\n/));
  },
};
