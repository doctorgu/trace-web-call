import { xml2js, Element } from 'xml-js';
import { config } from '../config/config';
import tCommon from '../sqlTemplate/TCommon';
import tBatchInfo from '../sqlTemplate/TBatchInfo';
import { getObjectChild, getTablesIudFromSql, getTextCdataFromElement, ObjectChild, ObjectInfo } from './batisHelper';
import { getDbPath } from './common';
import { getBatchToObjects } from './traceHelper';
import { includesPath, readFileSyncUtf16le, removeCommentLiteralSql } from './util';

type BatchTasklet = {
  ref: string;
  reader: string;
  writer: string;
  processor: string;
  commitInterval: number;
};
type BatchStep = {
  id: string;
  next: string;
  tasklet: BatchTasklet;
};
export type BatchJob = {
  batchPath: string;
  id: string;
  restartable: boolean;
  steps: BatchStep[];
};

export type BeanTargetObject = {
  batchPath: string;
  beanId: string;
  className: string;
  properties: { name: string; value: string }[];
  targetMethod: string;
};
export type BeanSql = {
  batchPath: string;
  beanId: string;
  dataSource: string;
  params: string;
} & ObjectChild;

/*
<beans>
  <job id="AlrimiDayJob" restartable="true">
    <step id="AlrimiDayStep" next="AlrimiDayStep2">
      <tasklet ref="AlrimiDay"></tasklet>
    </step>

    <step id="AlrimiDayStep2">
      <tasklet>
        <chunk reader="Reader1" writer="Writer1" processor="Processor1" commit-interval="10" />
      </tasklet>
    </step>
  </job>

  <bean id="AlrimiDay" class="org.springframework.batch.core.step.tasklet.MethodInvokingTaskletAdapter" scope="step">
    <property name="targetObject">
      <bean class="batchTest.AlrimiDAO">
        <property name="jobName" value="AlrimiDayJob" />
        <property name="stepName" value="AlrimiDayStep" />
        <property name="today" value="#{jobParameters['today']}" />
      </bean>
    </property>
    <property name="targetMethod" value="executeDayBatch" />
  </bean>

  <bean id="Reader1" class="org.springframework.batch.item.database.JdbcCursorItemReader">
    <property name="dataSource" ref="dsHshopBatchNonXa" />
    <property name="sql">
      <value>
        <![CDATA[
        select SEND_TIME from FR_AUTH_SMS
        ]]>
      </value>
    </property>
    <property name="rowMapper">
      <bean class="AlrimiSmsSendRowMapper" />
    </property>
  </bean>

  <bean id="Processor1" class="batchTest.AlrimiProcessor"></bean>

  <bean id="Writer1" class="egovframework.brte.core.item.database.EgovJdbcBatchItemWriter">
    <property name="itemPreparedStatementSetter">
      <bean class="egovframework.brte.core.item.database.support.EgovMethodMapItemPreparedStatementSetter" />
    </property>
    <property name="sql">
      <value>
        <![CDATA[
        insert into FR_AUTH_SMS (SEND_TIME) values (:sendTime)
        ]]>
      </value>
    </property>
    <property name="params" value="sendTime" />
    <property name="dataSource" ref="dsHshopBatchNonXa" />
  </bean>
</beans>
*/
function getBeanType(elemBean: Element): {
  id: string;
  className: string;
  type: 'targetObject' | 'noOrUnknownProperty' | 'sqlInValue' | 'locations' | 'resource';
} {
  const id = elemBean.attributes?.id as string;
  const className = elemBean.attributes?.class as string;

  const elemProps = elemBean.elements;
  if (id && className && !elemProps) {
    return { id, className, type: 'noOrUnknownProperty' };
  }

  if (!elemProps) {
    throw new Error(`No elements, id: ${id}, className: ${className}`);
  }

  if (elemProps.some((prop) => prop.attributes?.name === 'locations')) {
    /*
    <bean class="org.springframework.beans.factory.config.PropertyPlaceholderConfigurer">
      <property name="locations">
        <list>
          <value>classpath:/hmall/property/globals.properties</value>
        </list>
      </property>
    </bean>
    */
    return { id, className, type: 'locations' };
  }

  if (elemProps.some((prop) => prop.attributes?.name === 'resource')) {
    /*
    <bean id="Reader1" class="org.springframework.batch.item.file.FlatFileItemReader" scope="step">
      <property name="resource" value="#{jobParameters[filePath]}" />
    </bean>
    */
    return { id, className, type: 'resource' };
  }

  if (elemProps.some((prop) => prop.attributes?.name === 'targetObject')) {
    return { id, className, type: 'targetObject' };
  }
  if (elemProps.some((prop) => prop.attributes?.name === 'sql')) {
    return { id, className, type: 'sqlInValue' };
  }

  return { id, className, type: 'noOrUnknownProperty' };
}
function getBeanProperties(elemBean: Element) {
  const properties: { name: string; value: string }[] = [];

  const children = elemBean.elements;
  if (!children) {
    return properties;
  }

  const elemProps = children.filter((prop) => prop.name === 'property');
  if (elemProps) {
    for (const elemProp of elemProps) {
      const name = (elemProp.attributes?.name as string) || '';
      const value = (elemProp.attributes?.value as string) || '';
      properties.push({ name, value });
    }
  }

  return properties;
}
function getBeanTargetObject(batchPath: string, beanId: string, elemBean: Element): BeanTargetObject {
  const elemProps = elemBean.elements;
  if (!elemProps) {
    throw new Error(`No elements in bean tag`);
  }

  const elemTargetObject = elemProps.find((prop) => prop.attributes?.name === 'targetObject');
  if (!elemTargetObject) {
    throw new Error(`No targetObject name in bean tag`);
  }

  const elemBeanSub = elemTargetObject.elements?.find((prop) => prop.name === 'bean');
  if (!elemBeanSub) {
    throw new Error(`No bean in targetObject tag`);
  }

  const className = elemBeanSub.attributes?.class as string;
  const properties = getBeanProperties(elemBeanSub);

  const elemTargetMethod = elemProps.find((prop) => prop.attributes?.name === 'targetMethod');
  if (!elemTargetMethod) {
    throw new Error(`No targetMethod name in bean tag`);
  }

  const targetMethod = elemTargetMethod.attributes?.value as string;

  return {
    batchPath,
    beanId,
    className,
    properties,
    targetMethod,
  };
}
function getBeanSql(
  batchPath: string,
  beanId: string,
  elemBean: Element,
  usersAll: Set<string>,
  tablesAll: Set<string>,
  tablesAllNoSchema: Set<string>,
  nameObjectsAll: Map<string, ObjectInfo> | null,
  nameObjectsAllNoSchema: Map<string, ObjectInfo> | null
): BeanSql {
  const elemProps = elemBean.elements;
  if (!elemProps) throw new Error(`No elements in bean tag`);

  const elemSql = elemProps.find((prop) => prop.attributes?.name === 'sql');
  if (!elemSql) throw new Error(`No sql name in bean tag`);

  const elemDataSource = elemProps.find((prop) => prop.attributes?.name === 'dataSource');
  if (!elemDataSource) throw new Error(`No dataSource name in bean tag`);
  const dataSource = elemDataSource.attributes?.ref as string;

  const elemParams = elemProps.find((prop) => prop.attributes?.name === 'params');
  const params = elemParams ? (elemParams.attributes?.value as string) : '';

  const elemValue = elemSql.elements?.find((prop) => prop.name === 'value');
  if (!elemValue) throw new Error(`No value tag in sql tag`);

  const text = getTextCdataFromElement(elemValue);
  const sql = removeCommentLiteralSql(text);

  const iud = getTablesIudFromSql(usersAll, sql, beanId);
  const { objects, tablesInsert, tablesUpdate, tablesDelete, tablesOther, selectExists } = getObjectChild(
    iud,
    usersAll,
    tablesAll,
    tablesAllNoSchema,
    null,
    null,
    nameObjectsAll,
    nameObjectsAllNoSchema,
    'xml',
    beanId,
    sql
  );

  return {
    batchPath,
    beanId,
    dataSource,
    params,
    objects,
    tablesInsert,
    tablesUpdate,
    tablesDelete,
    tablesOther,
    selectExists,
  };
}

function getSteps(elemSteps: Element[]) {
  const steps: BatchStep[] = [];

  for (const elemStep of elemSteps) {
    const id = elemStep.attributes?.id as string;
    const next = (elemStep.attributes?.next as string) || '';

    const elemTasklet = elemStep.elements?.[0];
    if (!elemTasklet) continue;

    // <tasklet ref="AlrimiDay"></tasklet>
    const ref = (elemTasklet.attributes?.ref as string) || '';
    let reader = '';
    let writer = '';
    let processor = '';
    let commitInterval = 0;
    if (!ref) {
      // <tasklet><chunk reader="Reader1" writer="Writer1" processor="Processor1" commit-interval="10" /></tasklet>
      const elemChunk = elemTasklet.elements?.filter((elem) => elem.name === 'chunk')?.[0];
      if (elemChunk) {
        const attrs = elemChunk.attributes;
        if (attrs) {
          reader = (attrs.reader as string) || '';
          writer = (attrs.writer as string) || '';
          processor = (attrs.processor as string) || '';
          // 0 appended to prevent NaN when commit-interval="#{jobParameters[commitInterval]}"
          commitInterval = parseInt(attrs['commit-interval'] as string, 10) || 0;
        }
      }
    }
    const tasklet: BatchTasklet = {
      ref,
      reader,
      writer,
      processor,
      commitInterval,
    };
    const step: BatchStep = {
      id,
      next,
      tasklet,
    };
    steps.push(step);
  }

  return steps;
}

function getJobsAndBeans(
  batchPath: string,
  xml: string,
  usersAll: Set<string>,
  tablesAll: Set<string>,
  tablesAllNoSchema: Set<string>,
  nameObjectsAll: Map<string, ObjectInfo> | null,
  nameObjectsAllNoSchema: Map<string, ObjectInfo> | null
): {
  batchJobs: BatchJob[];
  beanTargetObjects: BeanTargetObject[];
  beanSqls: BeanSql[];
} | null {
  const obj = xml2js(xml) as Element;
  if (!obj) return null;

  const elemBeansRoot = obj.elements?.find((elem) => elem.type === 'element' && elem.name === 'beans');
  if (!elemBeansRoot) {
    return null;
  }

  const elems = elemBeansRoot.elements;
  if (!elems) return null;

  const elemJobs = elems.filter((elem) => elem.name === 'job');
  const batchJobs: BatchJob[] = [];
  for (const elemJob of elemJobs) {
    const id = elemJob.attributes?.id as string;
    const restartable = elemJob.attributes?.restartable === 'true';

    const elemsChildren = elemJob.elements;
    if (!elemsChildren) continue;

    const elemSteps = elemsChildren.filter((elem) => elem.name === 'step');
    const steps: BatchStep[] = getSteps(elemSteps);

    batchJobs.push({ batchPath, id, restartable, steps });
  }

  const elemBeans = elems.filter((elem) => elem.name === 'bean');
  const beanTargetObjects: BeanTargetObject[] = [];
  const beanSqls: BeanSql[] = [];
  for (const elemBean of elemBeans) {
    const { id, className, type } = getBeanType(elemBean);
    switch (type) {
      case 'targetObject':
        {
          const beanTargetObject = getBeanTargetObject(batchPath, id, elemBean);
          beanTargetObjects.push(beanTargetObject);
        }
        break;
      case 'noOrUnknownProperty':
        {
          const properties = getBeanProperties(elemBean);
          beanTargetObjects.push({ batchPath, beanId: id, className, properties, targetMethod: '' });
        }
        break;
      case 'sqlInValue':
        const beanSql = getBeanSql(
          batchPath,
          id,
          elemBean,
          usersAll,
          tablesAll,
          tablesAllNoSchema,
          nameObjectsAll,
          nameObjectsAllNoSchema
        );
        beanSqls.push(beanSql);
        break;
    }
  }

  return { batchJobs, beanTargetObjects, beanSqls };
}

export function insertBatchInfo(
  keyName: string,
  rootDir: string,
  fullPath: string,
  usersAll: Set<string>,
  tablesAll: Set<string>,
  tablesAllNoSchema: Set<string>,
  nameObjectsAll: Map<string, ObjectInfo> | null,
  nameObjectsAllNoSchema: Map<string, ObjectInfo> | null
): void {
  const batchPath = getDbPath(rootDir, fullPath);
  const xml = readFileSyncUtf16le(fullPath);

  const ret = getJobsAndBeans(
    batchPath,
    xml,
    usersAll,
    tablesAll,
    tablesAllNoSchema,
    nameObjectsAll,
    nameObjectsAllNoSchema
  );
  if (!ret) return;

  const { batchJobs, beanTargetObjects, beanSqls } = ret;

  tBatchInfo.insertBatch(keyName, batchJobs, beanTargetObjects, beanSqls);
}

export function getBatchJobFromDb(keyName: string): BatchJob[] {
  const rows = tBatchInfo.selectBatchJob(keyName);

  const jobs: BatchJob[] = [];
  for (const row of rows) {
    const { batchPath, jobId, restartable, stepId, next, ref, reader, writer, processor, commitInterval } = row;

    let jobFound = jobs.find((job) => job.batchPath === batchPath && job.id === jobId);
    if (!jobFound) {
      jobFound = { batchPath, id: jobId, restartable, steps: [] };
      jobs.push(jobFound);
    }

    jobFound.steps.push({
      id: stepId,
      next,
      tasklet: {
        ref,
        reader,
        writer,
        processor,
        commitInterval,
      },
    });
  }

  return jobs;
}

export function getBeanTargetObjectFromDb(keyName: string): BeanTargetObject[] {
  const rows = tBatchInfo.selectBeanTargetObject(keyName);

  const targets: BeanTargetObject[] = [];
  for (const row of rows) {
    const { batchPath, beanId, className, properties, targetMethod } = row;
    targets.push({ batchPath, beanId, className, properties: JSON.parse(properties), targetMethod });
  }
  return targets;
}

export function getBeanSqlFromDb(keyName: string): BeanSql[] {
  const rows = tBatchInfo.selectBeanSql(keyName);

  const sqls: BeanSql[] = [];
  for (const row of rows) {
    const {
      batchPath,
      beanId,
      dataSource,
      params,
      objects,
      tablesInsert,
      tablesUpdate,
      tablesDelete,
      tablesOther,
      selectExists,
    } = row;
    sqls.push({
      batchPath,
      beanId,
      dataSource,
      params,
      objects: JSON.parse(objects),
      tablesInsert: JSON.parse(tablesInsert),
      tablesUpdate: JSON.parse(tablesUpdate),
      tablesDelete: JSON.parse(tablesDelete),
      tablesOther: JSON.parse(tablesOther),
      selectExists: selectExists === 1,
    });
  }
  return sqls;
}

export function insertRouteBatchKeyName() {
  const directoriesDep: string[] = config.path.source.dependency.map(({ service: { directory } }) => directory);
  const directoriesXmlDep: string[] = config.path.source.dependency.map(({ xmlDirectory }) => xmlDirectory);

  for (let i = 0; i < config.path.source.main.length; i++) {
    const {
      startings: { directory, file },
      keyName,
      service,
      xmlDirectory,
    } = config.path.source.main[i];

    const directories = [service.directory];
    const directoriesXml = [xmlDirectory];

    console.log(`getBatchToObjects`);
    const routesAll = getBatchToObjects(
      keyName,
      directory,
      directories.concat(directoriesDep),
      directoriesXml.concat(directoriesXmlDep)
    );

    const routesCur = routesAll
      .map((routes, i) => {
        return routes.map((route) => ({ groupSeq: i, ...route }));
      })
      .flat();
    if (!routesCur.length) {
      continue;
    }
    console.log(`insertRouteJspKeyName`);
    tCommon.insertRouteBatchKeyName(keyName, routesCur);
  }
}
