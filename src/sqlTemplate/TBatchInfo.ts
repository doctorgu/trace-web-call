import { XmlInfo, XmlNodeInfo, XmlNodeInfoFind } from '../common/sqlMapperHelper';
import { all, DbRow, exec, get, run } from '../common/sqliteHelper';
import { escapeDollar } from '../common/util';
import { SqlTemplate } from '../common/sqliteHelper';
import { configReader } from '../config/configReader';
import betterSqlite3 from 'better-sqlite3';
import { BatchJob, BeanTargetObject, BeanSql } from '../common/batchHelper';

class TBatchInfo {
  //   selectBatchJob(batchPath: string): DbRow[] {
  //     const sql = `
  // select  batchPath, id, restartable
  // from    BatchJob
  // where   batchPath = @batchPath
  // `;
  //     return all(configReader.db(), sql, { batchPath });
  //   }

  selectBatchJob(keyName: string): DbRow[] {
    const sql = `
select  job.batchPath, job.jobId, job.restartable,

        step.beanId,
        step.next, step.ref,
        step.reader, step.writer, step.processor,
        step.commitInterval

from    BatchJob job

        inner join BatchStep step
        on step.batchPath = job.batchPath
        and step.jobId = job.jobId

where   job.keyName = @keyName
`;
    return all(configReader.db(), sql, { keyName });
  }

  selectBeanTargetObject(keyName: string): DbRow[] {
    const sql = `
select  tgt.batchPath, tgt.beanId, tgt.className, tgt.properties, tgt.targetMethod
from    BeanTargetObject tgt
where   tgt.batchPath in
        (select batchPath from BatchJob where keyName = @keyName)
`;
    return all(configReader.db(), sql, { keyName });
  }

  selectBeanSql(keyName: string): DbRow[] {
    const sql = `
select  sql.batchPath, sql.beanId,
        sql.dataSource,
        sql.objects, sql.tablesInsert, sql.tablesUpdate, sql.tablesDelete, sql.tablesOther, sql.selectExists
from    BeanSql sql
where   sql.batchPath in
        (select batchPath from BatchJob where keyName = @keyName)
`;
    return all(configReader.db(), sql, { keyName });
  }

  insertBatch(
    keyName: string,
    jobs: BatchJob[],
    beanTargetObjects: BeanTargetObject[],
    beanSqls: BeanSql[]
  ): betterSqlite3.Database {
    const batchJobJson = jobs.map((job) => ({
      keyName,
      batchPath: job.batchPath,
      jobId: job.id,
      restartable: job.restartable ? 1 : 0,
    }));

    const batchStepJson = jobs
      .map((job) => {
        return job.steps.map((step) => ({
          keyName,
          batchPath: job.batchPath,
          jobId: job.id,
          beanId: step.beanId,
          next: step.next,

          ref: step.tasklet.ref,
          reader: step.tasklet.reader,
          writer: step.tasklet.writer,
          processor: step.tasklet.processor,
          commitInterval: step.tasklet.commitInterval,
        }));
      })
      .flat();

    const beanTargetObjectJson = beanTargetObjects.map((targetObject) => ({
      batchPath: targetObject.batchPath,
      beanId: targetObject.beanId,

      className: targetObject.className,
      properties: JSON.stringify(targetObject.properties),
      targetMethod: targetObject.targetMethod,
    }));

    const beanSqlJson = beanSqls.map((sql) => ({
      batchPath: sql.batchPath,
      beanId: sql.beanId,

      dataSource: sql.dataSource,

      objects: JSON.stringify([...sql.objects]),
      tablesInsert: JSON.stringify([...sql.tablesInsert]),
      tablesUpdate: JSON.stringify([...sql.tablesUpdate]),
      tablesDelete: JSON.stringify([...sql.tablesDelete]),
      tablesOther: JSON.stringify([...sql.tablesOther]),
      selectExists: sql.selectExists ? 1 : 0,
    }));

    let sqlBatchJob = '';
    if (batchJobJson.length) {
      const sqlTmpBatchJob = `
insert into BatchJob
  (keyName, batchPath, jobId, restartable)
values
  {values}
`;
      const sqlTmpValues = `({keyName}, {batchPath}, {jobId}, {restartable})`;
      const sqlValues = new SqlTemplate(sqlTmpValues).replaceAlls(batchJobJson, ',\n');
      sqlBatchJob = sqlTmpBatchJob.replace('{values}', escapeDollar(sqlValues));
    }

    let sqlBatchStep = '';
    if (batchStepJson.length) {
      const sqlTmpBatchStep = `
insert into BatchStep
  (batchPath, jobId, beanId, next, ref, reader, writer, processor, commitInterval)
values
  {values}
`;
      const sqlTmpValues = `({batchPath}, {jobId}, {beanId}, {next}, {ref}, {reader}, {writer}, {processor}, {commitInterval})`;
      const sqlValues = new SqlTemplate(sqlTmpValues).replaceAlls(batchStepJson, ',\n');
      sqlBatchStep = sqlTmpBatchStep.replace('{values}', escapeDollar(sqlValues));
    }

    let sqlBeanTargetObject = '';
    if (beanTargetObjectJson.length) {
      const sqlTmpBeanTargetObject = `
insert into BeanTargetObject
  (batchPath, beanId, className, properties, targetMethod)
values
  {values}
`;
      const sqlTmpValues = `({batchPath}, {beanId}, {className}, {properties}, {targetMethod})`;
      const sqlValues = new SqlTemplate(sqlTmpValues).replaceAlls(beanTargetObjectJson, ',\n');
      sqlBeanTargetObject = sqlTmpBeanTargetObject.replace('{values}', escapeDollar(sqlValues));
    }

    let sqlBeanSql = '';
    if (beanSqlJson.length) {
      const sqlTmpBeanSql = `
insert into BeanSql
  (batchPath, beanId, dataSource, objects, tablesInsert, tablesUpdate, tablesDelete, tablesOther, selectExists)
values
  {values}
`;
      const sqlTmpValues = `({batchPath}, {beanId}, {dataSource}, {objects}, {tablesInsert}, {tablesUpdate}, {tablesDelete}, {tablesOther}, {selectExists})`;
      const sqlValues = new SqlTemplate(sqlTmpValues).replaceAlls(beanSqlJson, ',\n');
      sqlBeanSql = sqlTmpBeanSql.replace('{values}', escapeDollar(sqlValues));
    }

    const sql = `
${sqlBatchJob};
${sqlBatchStep};
${sqlBeanTargetObject};
${sqlBeanSql};
  `;
    return exec(configReader.db(), sql);
  }

  //   insertXmlInfoFindKeyName(keyName: string, finds: XmlNodeInfoFind[]): betterSqlite3.RunResult {
  //     if (!finds.length) return { changes: 0, lastInsertRowid: 0 };

  //     const findsJson = finds
  //       .map(
  //         ({
  //           xmlPath,
  //           namespaceId,
  //           id,
  //           tagName,
  //           params,
  //           objects,
  //           tablesInsert,
  //           tablesUpdate,
  //           tablesDelete,
  //           tablesOther,
  //           selectExists,
  //         }) => ({
  //           keyName,
  //           xmlPath,
  //           namespaceId,
  //           id,
  //           tagName,
  //           params: JSON.stringify([...params]),
  //           objects: JSON.stringify([...objects]),
  //           tablesInsert: JSON.stringify([...tablesInsert]),
  //           tablesUpdate: JSON.stringify([...tablesUpdate]),
  //           tablesDelete: JSON.stringify([...tablesDelete]),
  //           tablesOther: JSON.stringify([...tablesOther]),
  //           selectExists: selectExists ? 1 : 0,
  //         })
  //       )
  //       .flat();

  //     const sqlTmp = `
  // insert into XmlNodeInfoFind
  //   (
  //     keyName, xmlPath, namespaceId, id, tagName, params,
  //     objects, tablesInsert, tablesUpdate, tablesDelete, tablesOther, selectExists
  //   )
  // values
  //   {values}`;
  //     const sqlTmpValues = `
  //   (
  //     {keyName}, {xmlPath}, {namespaceId}, {id}, {tagName}, {params},
  //     {objects}, {tablesInsert}, {tablesUpdate}, {tablesDelete}, {tablesOther}, {selectExists}
  //   )`;
  //     const sqlValues = new SqlTemplate(sqlTmpValues).replaceAlls(findsJson, ',\n');
  //     const sql = sqlTmp.replace('{values}', escapeDollar(sqlValues));

  //     return run(configReader.db(), sql);
  //   }
}
export default new TBatchInfo();
