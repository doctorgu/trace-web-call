export const sqlInit = `
drop table if exists XmlInfo;
drop table if exists XmlNodeInfo;
drop table if exists XmlNodeInfoFind;

drop table if exists ClassInfo;
drop table if exists HeaderInfo;
drop table if exists MethodInfo;
drop table if exists MethodInfoFind;

drop table if exists RouteTable;

drop table if exists JspInfo;
drop table if exists RouteJsp;

drop table if exists BatchJob;
drop table if exists BatchStep;
drop table if exists BeanTargetObject;
drop table if exists BeanSql;


drop view if exists vRouteTable;
drop view if exists vRouteTableIndent;
drop view if exists vStartToObject;

drop view if exists vRouteJsp;
drop view if exists vRouteJspIndent;
drop view if exists vStartToJsp;
drop view if exists vJspViewFind;

drop view if exists vRouteBatch;
drop view if exists vRouteBatchIndent;
drop view if exists vBatchToObject;

drop view if exists vObjectToStart;
drop view if exists vObjectToBatch;

-- strict removed because SQLiteStudio does not support it.

create table KeyInfo (
    keyName text not null primary key,
    insertTime timestamp not null default current_timestamp
);


create table XmlInfo (
    xmlPath text not null primary key,
    namespace text not null,
    insertTime timestamp not null default current_timestamp
);

create table XmlNodeInfo (
    xmlPath text not null,
    id text not null,
    tagName text not null,
    params text not null,

    objects text not null,
    tablesInsert text not null,
    tablesUpdate text not null,
    tablesDelete text not null,
    tablesOther text not null,
    selectExists int not null check (selectExists in (0, 1)),

    insertTime timestamp not null default current_timestamp,
    primary key (xmlPath, id),
    foreign key (xmlPath) references XmlInfo (xmlPath) on update cascade on delete cascade
);

create table XmlNodeInfoFind (
    keyName text not null,
    xmlPath text not null,
    id text not null,
    namespaceId text not null,
    tagName text not null,
    params text not null,

    objects text not null,
    tablesInsert text not null,
    tablesUpdate text not null,
    tablesDelete text not null,
    tablesOther text not null,
    selectExists int not null check (selectExists in (0, 1)),

    insertTime timestamp not null default current_timestamp,
    primary key (keyName, id, xmlPath),
    foreign key (keyName) references KeyInfo (keyName) on update cascade on delete cascade
);
create index IxXmlNodeInfoFind1 on XmlNodeInfoFind (keyName, namespaceId, xmlPath);


create table ClassInfo (
    classPath text not null primary key,
    insertTime timestamp not null default current_timestamp
);

create table HeaderInfo (
    classPath text not null,
    name text not null,
    implementsName text not null,
    extendsName text not null,
    mapping text not null,
    insertTime timestamp not null default current_timestamp,
    primary key (classPath, name),
    foreign key (classPath) references ClassInfo (classPath) on update cascade on delete cascade
);

create table MethodInfo (
    classPath text not null,
    mapping text not null,
    isPublic int not null check (isPublic in (0, 1)),
    returnType text not null,
    name text not null,
    parameterCount int not null,
    callers text not null,
    jspViews text not null,
    insertTime timestamp not null default current_timestamp,
    foreign key (classPath) references ClassInfo (classPath) on update cascade on delete cascade
);

create table MethodInfoFind (
    keyName text not null,
    classPath text not null,
    className text not null,
    implementsName text not null,
    extendsName text not null,
    mappingMethod text not null,
    mappingValues text not null,
    isPublic int not null check (isPublic in (0, 1)),
    returnType text not null,
    name text not null,
    parameterCount int not null,
    callers text not null,
    jspViewFinds text not null,
    insertTime timestamp not null default current_timestamp,
    foreign key (classPath) references ClassInfo (classPath) on update cascade on delete cascade,
    foreign key (keyName) references KeyInfo (keyName) on update cascade on delete cascade
);
create index IxMethodInfoFind1 on MethodInfoFind (keyName, name, parameterCount, className, implementsName);
create index IxMethodInfoFind2 on MethodInfoFind (keyName, classPath);

create table RouteTable (
    keyName text not null,
    groupSeq int not null,
    seq int not null,
    seqParent int not null,
    depth int not null,
    routeType text not null,
    value text not null,
    valueList text not null,

    objects text not null,
    tablesInsert text not null,
    tablesUpdate text not null,
    tablesDelete text not null,
    tablesOther text not null,
    selectExists int not null check (selectExists in (0, 1)),
    
    insertTime timestamp not null default current_timestamp,
    primary key (keyName, groupSeq, seq)
);


create table JspInfo (
    keyName text not null,
    jspPath text not null,
    includes text not null,
    insertTime timestamp not null default current_timestamp,
    primary key (keyName, jspPath)
);

create table RouteJsp (
    keyName text not null,
    groupSeq int not null,
    seq int not null,
    seqParent int not null,
    depth int not null,
    routeType text not null,
    value text not null,
    valueList text not null,
    jsps text not null,
    insertTime timestamp not null default current_timestamp,
    primary key (keyName, groupSeq, seq)
);


create table BatchJob (
    keyName text not null,
    batchPath text not null,
    jobId text not null,
    
    restartable int not null check (restartable in (0, 1)),
    
    insertTime timestamp not null default current_timestamp,
    primary key (keyName, batchPath, jobId)
);

create table BatchStep (
    batchPath text not null,
    jobId text not null,
    id text not null,
    
    next text not null,
    
    ref text not null,
    reader text not null,
    writer text not null,
    processor text not null,
    commitInterval int not null,

    insertTime timestamp not null default current_timestamp,
    primary key (batchPath, jobId, id)
);

create table BeanTargetObject (
    batchPath text not null,
    beanId text not null,

    className text not null,
    properties text not null,
    targetMethod text not null,

    insertTime timestamp not null default current_timestamp,
    primary key (batchPath, beanId)
);

create table BeanSql (
    batchPath text not null,
    beanId text not null,

    dataSource text not null,
    params text not null,

    objects text not null,
    tablesInsert text not null,
    tablesUpdate text not null,
    tablesDelete text not null,
    tablesOther text not null,
    selectExists int not null check (selectExists in (0, 1)),

    insertTime timestamp not null default current_timestamp,
    primary key (batchPath, beanId)
);

create table RouteBatch (
    keyName text not null,
    groupSeq int not null,
    seq int not null,
    seqParent int not null,
    depth int not null,
    routeType text not null,
    value text not null,

    objects text not null,
    tablesInsert text not null,
    tablesUpdate text not null,
    tablesDelete text not null,
    tablesOther text not null,
    selectExists int not null check (selectExists in (0, 1)),
    
    insertTime timestamp not null default current_timestamp,
    primary key (keyName, groupSeq, seq)
);


create view vRouteTable
as
select  r.keyName, r.groupSeq, r.seq, min(r.depth) depth, min(r.routeType) routeType,
        ifnull(
            case routeType
            when 'mapping' then group_concat(distinct jValueList.value)
            else group_concat(distinct r.value)
            end
        , ''
        ) value,

        ifnull(
            case when routeType in ('xml', 'view', 'function', 'procedure') then
                group_concat(distinct jObjects.value)
            end
        , '') objects,
        ifnull(
            case when routeType in ('xml', 'view', 'function', 'procedure') then
                group_concat(distinct jTablesInsert.value)
            end
        , '') tablesInsert,
        ifnull(
            case when routeType in ('xml', 'view', 'function', 'procedure') then
                group_concat(distinct jTablesUpdate.value)
            end
        , '') tablesUpdate,
        ifnull(
            case when routeType in ('xml', 'view', 'function', 'procedure') then
                group_concat(distinct jTablesDelete.value)
            end
        , '') tablesDelete,
        ifnull(
            case when routeType in ('xml', 'view', 'function', 'procedure') then
                group_concat(distinct jTablesOther.value)
            end
        , '') tablesOther,
        ifnull(
            case when routeType in ('xml', 'view', 'function', 'procedure') then
                group_concat(distinct jSelectExists.value)
            end
        , '') selectExists

from    RouteTable r
        left join json_each(r.valueList) jValueList
        left join json_each(r.objects) jObjects
        left join json_each(r.tablesInsert) jTablesInsert
        left join json_each(r.tablesUpdate) jTablesUpdate
        left join json_each(r.tablesDelete) jTablesDelete
        left join json_each(r.tablesOther) jTablesOther
        left join json_each(r.selectExists) jSelectExists

group by r.keyName, r.groupSeq, r.seq;

create view vRouteTableIndent
as
select  keyName, groupSeq, seq, depth, routeType, value,
        substring('         ' || routeType, -9)
        || ': ' ||
        case when depth > 0 then
            replace(substring(printf('%0' || (depth * 4) || 'd', 0) || '+-- ', 5), '0', ' ')
        else
            ''
        end
        || value valueIndent,
        objects, tablesInsert, tablesUpdate, tablesDelete, tablesOther, selectExists
from    vRouteTable;

create view vStartToObject
as
with 
allTables as
(
    select  keyName, groupSeq, seq, 'I' type, r.selectExists, jtables.value tables
    from    RouteTable r
            inner join json_each(r.tablesInsert) jtables
    union all
    select  keyName, groupSeq, seq, 'U' type, r.selectExists, jtables.value tables
    from    RouteTable r
            inner join json_each(r.tablesUpdate) jtables
    union all
    select  keyName, groupSeq, seq, 'D' type, r.selectExists, jtables.value tables
    from    RouteTable r
            inner join json_each(r.tablesDelete) jtables
    union all
    select  keyName, groupSeq, seq, 'O' type, r.selectExists, jtables.value tables
    from    RouteTable r
            inner join json_each(r.tablesOther) jtables
)
select  keyName, groupSeq, group_concat(start) start,
        group_concat(distinct tables) tables,
        group_concat(distinct valueView) views,
        group_concat(distinct valueFunction) functions,
        group_concat(distinct valueProcedure) procedures,
        group_concat(distinct type) types
from    (
        select  r.keyName, r.groupSeq,
        
                case r.routeType 
                when 'mapping' then jValueList.value
                else r.value
                end start,
        
                case when r.routeType in ('xml', 'view', 'function', 'procedure') then
                    a.tables
                end tables,

                case when r.routeType in ('xml', 'view', 'function', 'procedure') then
                    case when a.type = 'O' then
                        case when a.selectExists = 1 then 'S' end
                    else
                        a.type
                    end
                end type,

                nullif(case when r.routeType = 'view' then r.value end, '') valueView,
                nullif(case when r.routeType = 'function' then r.value end, '') valueFunction,
                nullif(case when r.routeType = 'procedure' then r.value end, '') valueProcedure

        from    RouteTable r
                left join json_each(r.valueList) jValueList
                left join allTables a
                on r.keyName = a.keyName
                and r.groupSeq = a.groupSeq
                and r.seq = a.seq

        where   (r.seq = 0 and r.routeType in ('mapping', 'method'))
                or r.routeType in ('xml', 'view', 'function', 'procedure')
        order by r.keyName, r.groupSeq, tables
        )
group by keyName, groupSeq;


create view vRouteJsp
as
select  r.keyName, r.groupSeq, r.seq, min(r.depth) depth, min(r.routeType) routeType,
        ifnull(
            case routeType
            when 'mapping' then group_concat(distinct jValueList.value)
            when 'jsp' then group_concat(distinct jJsps.value)
            else group_concat(distinct r.value)
            end
        , ''
        ) value

from    RouteJsp r
        left join json_each(r.valueList) jValueList
        left join json_each(r.jsps) jJsps

group by r.keyName, r.groupSeq, r.seq;

create view vRouteJspIndent
as
select  keyName, groupSeq, seq,
        case when seq = 0 then char(13) else '' end
        || substring('         ' || routeType, -9)
        || ': ' ||
        case when depth > 0 then
            replace(substring(printf('%0' || (depth * 4) || 'd', 0) || '+-- ', 5), '0', ' ')
        else
            ''
        end
        || value valueIndent
from    vRouteJsp;

create view vStartToJsp
as
select  keyName, groupSeq, group_concat(start) start, group_concat(distinct jsps) jsps
from    (
        select  r.keyName, r.groupSeq,
        
                case routeType 
                when 'mapping' then jValueList.value
                else r.value
                end start,
        
                case routeType
                when 'jsp' then jJsp.value
                end jsps
        from    RouteJsp r
                left join json_each(r.valueList) jValueList
                left join json_each(r.jsps) jJsp
        where   r.seq = 0 and r.routeType in ('mapping', 'method')
                or r.routeType in ('jsp')
        order by r.keyName, r.groupSeq, jsps
        )
group by keyName, groupSeq;

create view vJspViewFind
as
select  f.keyName, f.className, jMv.value mappingValues,
        json_extract(jVn.value, '$.name') jspName,
        json_extract(jVn.value, '$.parsed') jspParsed,
        json_extract(jVn.value, '$.exists') jspExists
from    MethodInfoFind f
        left join json_each(f.mappingValues) jMv
        left join json_each(f.jspViewFinds) jVn
where   f.returnType = 'ModelAndView'
group by f.keyName, f.className, json_extract(jVn.value, '$.name');


create view vRouteBatch
as
select  r.keyName, r.groupSeq, r.seq, min(r.depth) depth, min(r.routeType) routeType,
        ifnull(group_concat(distinct r.value), '') value,

        ifnull(
            case when routeType in ('xml', 'view', 'function', 'procedure') then
                group_concat(distinct jObjects.value)
            end
        , '') objects,
        ifnull(
            case when routeType in ('xml', 'view', 'function', 'procedure') then
                group_concat(distinct jTablesInsert.value)
            end
        , '') tablesInsert,
        ifnull(
            case when routeType in ('xml', 'view', 'function', 'procedure') then
                group_concat(distinct jTablesUpdate.value)
            end
        , '') tablesUpdate,
        ifnull(
            case when routeType in ('xml', 'view', 'function', 'procedure') then
                group_concat(distinct jTablesDelete.value)
            end
        , '') tablesDelete,
        ifnull(
            case when routeType in ('xml', 'view', 'function', 'procedure') then
                group_concat(distinct jTablesOther.value)
            end
        , '') tablesOther,
        ifnull(
            case when routeType in ('xml', 'view', 'function', 'procedure') then
                group_concat(distinct jSelectExists.value)
            end
        , '') selectExists

from    RouteBatch r
        left join json_each(r.objects) jObjects
        left join json_each(r.tablesInsert) jTablesInsert
        left join json_each(r.tablesUpdate) jTablesUpdate
        left join json_each(r.tablesDelete) jTablesDelete
        left join json_each(r.tablesOther) jTablesOther
        left join json_each(r.selectExists) jSelectExists

group by r.keyName, r.groupSeq, r.seq;

create view vRouteBatchIndent
as
select  keyName, groupSeq, seq, depth, routeType, value,
        substring('         ' || routeType, -9)
        || ': ' ||
        case when depth > 0 then
            replace(substring(printf('%0' || (depth * 4) || 'd', 0) || '+-- ', 5), '0', ' ')
        else
            ''
        end
        || value valueIndent,
        objects, tablesInsert, tablesUpdate, tablesDelete, tablesOther, selectExists
from    vRouteBatch;

create view vBatchToObject
as
with 
allTables as
(
    select  keyName, groupSeq, seq, 'I' type, r.selectExists, jtables.value tables
    from    RouteBatch r
            inner join json_each(r.tablesInsert) jtables
    union all
    select  keyName, groupSeq, seq, 'U' type, r.selectExists, jtables.value tables
    from    RouteBatch r
            inner join json_each(r.tablesUpdate) jtables
    union all
    select  keyName, groupSeq, seq, 'D' type, r.selectExists, jtables.value tables
    from    RouteBatch r
            inner join json_each(r.tablesDelete) jtables
    union all
    select  keyName, groupSeq, seq, 'O' type, r.selectExists, jtables.value tables
    from    RouteBatch r
            inner join json_each(r.tablesOther) jtables
)
select  keyName, groupSeq, group_concat(start) start,
        group_concat(distinct tables) tables,
        group_concat(distinct valueView) views,
        group_concat(distinct valueFunction) functions,
        group_concat(distinct valueProcedure) procedures,
        group_concat(distinct type) types
from    (
        select  r.keyName, r.groupSeq,
        
                case r.routeType 
                when 'job' then r.value
                end start,
        
                case when r.routeType in ('xml', 'view', 'function', 'procedure') then
                    a.tables
                end tables,

                case when r.routeType in ('xml', 'view', 'function', 'procedure') then
                    case when a.type = 'O' then
                        case when a.selectExists = 1 then 'S' end
                    else
                        a.type
                    end
                end type,

                nullif(case when routeType = 'view' then r.value end, '') valueView,
                nullif(case when routeType = 'function' then r.value end, '') valueFunction,
                nullif(case when routeType = 'procedure' then r.value end, '') valueProcedure

        from    RouteBatch r
                left join allTables a
                on r.keyName = a.keyName
                and r.groupSeq = a.groupSeq
                and r.seq = a.seq

        where   (r.seq = 0 and r.routeType = 'job')
                or r.routeType in ('xml', 'view', 'function', 'procedure')
        order by r.keyName, r.groupSeq, tables
        )
group by keyName, groupSeq;

create view vObjectToStart
as
/*
select  *
from    vObjectToStart
where   objects = 'HDHS.CM_GA_MST'
order by keyName, groupSeq, objects, seq desc;
*/
with recursive t as
(
    select  r.keyName, r.groupSeq, r.seq, r.seqParent, 0 depth,
            r.routeType,
            r.value,
            r.value valueIndent,
            t.value name
    from    RouteTable r
            inner join
            (
                select  keyName, groupSeq, seq, jobjects.value
                from    RouteTable r
                        inner join json_each(r.objects) jobjects
                union all
                select  keyName, groupSeq, seq, jtables.value
                from    RouteTable r
                        inner join json_each(r.tablesInsert) jtables
                union all
                select  keyName, groupSeq, seq, jtables.value
                from    RouteTable r
                        inner join json_each(r.tablesUpdate) jtables
                union all
                select  keyName, groupSeq, seq, jtables.value
                from    RouteTable r
                        inner join json_each(r.tablesDelete) jtables
                union all
                select  keyName, groupSeq, seq, jtables.value
                from    RouteTable r
                        inner join json_each(r.tablesOther) jtables
            ) t
            on t.keyName = r.keyName and t.groupSeq = r.groupSeq and t.seq = r.seq
    union all
    select  p.keyName, p.groupSeq, p.seq, p.seqParent, c.depth + 1 depth,
            p.routeType,
            case when p.value != '' then
                p.value
            else
                json_extract(p.valueList, '$[0]') || ifnull(',' || json_extract(p.valueList, '$[1]'), '')
            end value,

            replace(substring(printf('%0' || ((c.depth + 1) * 4) || 'd', 0) || '+-- ', 5), '0', ' ')
            ||
            case when p.value != '' then
                p.value
            else
                json_extract(p.valueList, '$[0]') || ifnull(',' || json_extract(p.valueList, '$[1]'), '')
            end valueIndent,
            
            c.name
    from    t c
            inner join RouteTable p
            on p.keyName = c.keyName
            and p.groupSeq = c.groupSeq
            and p.seq = c.seqParent
)
select  distinct
        t.keyName, t.groupSeq, t.seq, t.seqParent, t.depth, t.name, t.routeType, t.value, t.valueIndent
from    t
;

create view vObjectToBatch
as
/*
select  *
from    vObjectToBatch
where   objects = 'HDHS.CM_GA_MST'
order by keyName, groupSeq, objects, seq desc;
*/
with recursive t as
(
    select  r.keyName, r.groupSeq, r.seq, r.seqParent, 0 depth,
            r.routeType,
            r.value,
            r.value valueIndent,
            t.value name
    from    RouteBatch r
            inner join
            (
                select  keyName, groupSeq, seq, jobjects.value
                from    RouteBatch r
                        inner join json_each(r.objects) jobjects
                union all
                select  keyName, groupSeq, seq, jtables.value
                from    RouteBatch r
                        inner join json_each(r.tablesInsert) jtables
                union all
                select  keyName, groupSeq, seq, jtables.value
                from    RouteBatch r
                        inner join json_each(r.tablesUpdate) jtables
                union all
                select  keyName, groupSeq, seq, jtables.value
                from    RouteBatch r
                        inner join json_each(r.tablesDelete) jtables
                union all
                select  keyName, groupSeq, seq, jtables.value
                from    RouteBatch r
                        inner join json_each(r.tablesOther) jtables
            ) t
            on t.keyName = r.keyName and t.groupSeq = r.groupSeq and t.seq = r.seq
    union all
    select  p.keyName, p.groupSeq, p.seq, p.seqParent, c.depth + 1 depth,
            p.routeType,
            p.value,
            replace(substring(printf('%0' || ((c.depth + 1) * 4) || 'd', 0) || '+-- ', 5), '0', ' ')
            || p.value valueIndent,
            c.name
    from    t c
            inner join RouteBatch p
            on p.keyName = c.keyName
            and p.groupSeq = c.groupSeq
            and p.seq = c.seqParent
)
select  distinct
        t.keyName, t.groupSeq, t.seq, t.seqParent, t.depth, t.name, t.routeType, t.value, t.valueIndent
from    t
;
`;
