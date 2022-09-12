import { all, exec, get, run } from '../common/sqliteHelper';
import { escapeDollar } from '../common/util';
import { SqlTemplate } from '../common/sqliteHelper';
import { configReader } from '../config/config';
import { HeaderInfo, MethodInfo, MethodInfoFind } from '../common/classHelper';
import betterSqlite3 from 'better-sqlite3';

class TClassInfo {
  selectClassInfo(classPath: string): any {
    const sql = `
select  classPath
from    ClassInfo
where   classPath = @classPath
`;
    return get(sql, { classPath });
  }

  selectHeaderInfo(classPath: string): any {
    const sql = `
select  name, implementsName, extendsName, mapping
from    HeaderInfo
where   classPath = @classPath
`;
    return get(sql, { classPath });
  }

  selectMethodInfo(classPath: string): any[] {
    const sql = `
select  mapping, isPublic, name, callers, parameterCount
from    MethodInfo
where   classPath = @classPath
`;
    return all(sql, { classPath });
  }

  selectMethodInfoFindByKeyName(keyName: string): any[] {
    const sql = `
select  classPath, className, implementsName, extendsName, mappingMethod, mappingValues, isPublic, name, parameterCount, callers
from    MethodInfoFind
where   keyName = @keyName
`;
    return all(sql, { keyName });
  }

  selectMethodInfoFindByClassPathClassName(
    keyName: string,
    classPathLike: string,
    fileNameWildcard: string,
    fileNamePattern: string
  ): any[] {
    const sql = `
select  classPath, className, implementsName, extendsName, mappingMethod, mappingValues, isPublic, name, parameterCount, callers
from    MethodInfoFind
where   keyName = @keyName
        and classPath like @classPathLike || '%'
        ${fileNameWildcard && `and testWildcardFileName(@fileNameWildcard, className || '.java', 1) = 1`}
        ${fileNamePattern && `and className || '.java' regexp @fileNamePattern`}
`;
    return all(sql, {
      keyName,
      classPathLike,
      ...(fileNameWildcard ? { fileNameWildcard } : {}),
      ...(fileNamePattern ? { fileNamePattern } : {}),
    });
  }

  selectMethodInfoFindByNameParameterCount(
    keyName: string,
    methodName: string,
    callerParameterCount: number,
    classPathsLike: string[],
    typeName: string,
    classNameThis: string
  ): any[] {
    const sql = `
select  classPath, className, implementsName, extendsName, mappingMethod, mappingValues, isPublic, name, parameterCount, callers
from    MethodInfoFind
where   keyName = @keyName
        and name = @methodName
        and parameterCount = @callerParameterCount
        and
        (${classPathsLike.map((classPathLike) => `classPath like '${classPathLike}' || '%'`).join(' or ')})
        ${typeName ? `and (className = @typeName or implementsName = @typeName)` : `and className = @classNameThis`}
`;
    return all(sql, { keyName, methodName, callerParameterCount, ...(typeName ? { typeName } : { classNameThis }) });
  }

  insertClassInfo(classPath: string, header: HeaderInfo, methods: MethodInfo[]): betterSqlite3.Database {
    const headerJson = {
      classPath,
      name: header.name,
      implementsName: header.implementsName,
      extendsName: header.extendsName,
      mapping: JSON.stringify(header.mapping),
    };
    const methodsJson = methods.map((method) => ({
      classPath,
      mapping: JSON.stringify(method.mapping),
      isPublic: method.isPublic,
      name: method.name,
      callers: JSON.stringify(method.callers),
      parameterCount: method.parameterCount,
    }));

    const sqlTmpClass = `
insert into ClassInfo
  (classPath)
values
  ({classPath})`;
    const sqlClass = new SqlTemplate(sqlTmpClass).replace('{classPath}', classPath).toString();

    const sqlTmpHeader = `
insert into HeaderInfo
  (classPath, name, implementsName, extendsName, mapping)
values
  ({classPath}, {name}, {implementsName}, {extendsName}, {mapping})`;
    const sqlHeader = new SqlTemplate(sqlTmpHeader).replaceAll(headerJson);

    let sqlMethod = '';
    if (methods.length) {
      const sqlTmpMethod = `
insert into MethodInfo
  (classPath, mapping, isPublic, name, callers, parameterCount)
values
  {values}`;
      const sqlTmpValues = `({classPath}, {mapping}, {isPublic}, {name}, {callers}, {parameterCount})`;
      const sqlValues = new SqlTemplate(sqlTmpValues).replaceAlls(
        methodsJson.map((method) => method),
        ',\n'
      );
      sqlMethod = sqlTmpMethod.replace('{values}', escapeDollar(sqlValues));
    }

    const sql = `
${sqlClass};
${sqlHeader};
${sqlMethod};
`;
    return exec(sql);
  }

  insertMethodInfoFindKeyName(keyName: string, finds: MethodInfoFind[]): betterSqlite3.RunResult {
    if (!finds.length) return { changes: 0, lastInsertRowid: 0 };

    const findsJson = finds.map((find) => ({
      keyName,
      classPath: find.classPath,
      className: find.className,
      implementsName: find.implementsName,
      extendsName: find.extendsName,
      mappingMethod: find.mappingMethod,
      mappingValues: JSON.stringify(find.mappingValues),
      isPublic: find.isPublic,
      name: find.name,
      parameterCount: find.parameterCount,
      callers: JSON.stringify(find.callers),
    }));

    const sqlTmp = `
insert into MethodInfoFind
  (keyName, classPath, className, implementsName, extendsName, mappingMethod, mappingValues, isPublic, name, parameterCount, callers)
values
  {values}`;
    const sqlTmpValues = `({keyName}, {classPath}, {className}, {implementsName}, {extendsName}, {mappingMethod}, {mappingValues}, {isPublic}, {name}, {parameterCount}, {callers})`;
    const sqlValues = new SqlTemplate(sqlTmpValues).replaceAlls(findsJson, ',\n');
    const sql = sqlTmp.replace('{values}', escapeDollar(sqlValues));

    return run(sql);
  }
}
export default new TClassInfo();
