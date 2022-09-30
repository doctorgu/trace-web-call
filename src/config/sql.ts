export const sqlInit = `
drop table if exists XmlInfo;
drop table if exists XmlNodeInfo;
drop table if exists XmlNodeInfoFind;

drop table if exists ClassInfo;
drop table if exists HeaderInfo;
drop table if exists MethodInfo;
drop table if exists MethodInfoFind;

drop table if exists RouteTable;
drop table if exists RouteJsp;
drop table if exists JspInfo;

drop view if exists vRouteTable;
drop view if exists vRouteTableTxt;
drop view if exists vStartToTables;
drop view if exists vJspViews;

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


create table JspInfo (
    jspPath text not null,
    includes text not null,
    insertTime timestamp not null default current_timestamp,
    primary key (jspPath)
);


create table RouteTable (
    keyName text not null,
    groupSeq int not null,
    seq int not null,
    depth int not null,
    routeType text not null,
    valueMapping text not null,
    valueMethod text not null,
    valueXml text not null,
    valueView text not null,
    valueFunction text not null,
    valueProcedure text not null,

    objects text not null,
    tablesInsert text not null,
    tablesUpdate text not null,
    tablesDelete text not null,
    tablesOther text not null,
    selectExists int not null check (selectExists in (0, 1)),
    
    insertTime timestamp not null default current_timestamp,
    primary key (keyName, groupSeq, seq)
);

create table RouteJsp (
    keyName text not null,
    groupSeq int not null,
    seq int not null,
    depth int not null,
    routeType text not null,
    valueMapping text not null,
    valueMethod text not null,
    valueJsp text not null,
    insertTime timestamp not null default current_timestamp,
    primary key (keyName, groupSeq, seq)
);


create view vRouteTable
as
select  r.keyName, r.groupSeq, r.seq, min(r.depth) depth, min(r.routeType) routeType,
        ifnull(
            case routeType
            when 'mapping' then group_concat(jMapping.value)
            when 'method' then group_concat(r.valueMethod)
            when 'xml' then group_concat(r.valueXml)
            when 'view' then group_concat(r.valueView)
            when 'function' then group_concat(r.valueFunction)
            when 'procedure' then group_concat(r.valueProcedure)
            end
        , ''
        ) value,

        ifnull(
            case when routeType in ('xml', 'view', 'function', 'procedure') then
                group_concat(jObjects.value)
            end
        , '') objects,
        ifnull(
            case when routeType in ('xml', 'view', 'function', 'procedure') then
                group_concat(jTablesInsert.value)
            end
        , '') tablesInsert,
        ifnull(
            case when routeType in ('xml', 'view', 'function', 'procedure') then
                group_concat(jTablesUpdate.value)
            end
        , '') tablesUpdate,
        ifnull(
            case when routeType in ('xml', 'view', 'function', 'procedure') then
                group_concat(jTablesDelete.value)
            end
        , '') tablesDelete,
        ifnull(
            case when routeType in ('xml', 'view', 'function', 'procedure') then
                group_concat(jTablesOther.value)
            end
        , '') tablesOther,
        ifnull(
            case when routeType in ('xml', 'view', 'function', 'procedure') then
                group_concat(jSelectExists.value)
            end
        , '') selectExists

from    RouteTable r
        left join json_each(r.valueMapping) jMapping
        left join json_each(r.objects) jObjects
        left join json_each(r.tablesInsert) jTablesInsert
        left join json_each(r.tablesUpdate) jTablesUpdate
        left join json_each(r.tablesDelete) jTablesDelete
        left join json_each(r.tablesOther) jTablesOther
        left join json_each(r.selectExists) jSelectExists

group by r.keyName, r.groupSeq, r.seq;


create view vRouteTableTxt
as
select  keyName, groupSeq, seq, depth, routeType, value,
        substring('         ' || routeType, -9)
        || ': ' ||
        case when depth > 0 then
            replace(substring(printf('%0' || (depth * 4) || 'd', 0) || '+-- ', 5), '0', ' ')
        else
            ''
        end
        || value output,
        objects, tablesInsert, tablesUpdate, tablesDelete, tablesOther, selectExists
from    vRouteTable;


create view vStartToTables
as
with 
AllTables as
(
    select  keyName, groupSeq, seq, jtables.value tables
    from    RouteTable r
            inner join json_each(r.tablesInsert) jtables
    union all
    select  keyName, groupSeq, seq, jtables.value tables
    from    RouteTable r
            inner join json_each(r.tablesUpdate) jtables
    union all
    select  keyName, groupSeq, seq, jtables.value tables
    from    RouteTable r
            inner join json_each(r.tablesDelete) jtables
    union all
    select  keyName, groupSeq, seq, jtables.value tables
    from    RouteTable r
            inner join json_each(r.tablesOther) jtables
)
select  keyName, groupSeq, group_concat(start) start, group_concat(distinct tables) tables
from    (
        select  r.keyName, r.groupSeq,
        
                case r.routeType 
                when 'mapping' then jMapping.value
                when 'method' then r.valueMethod
                end start,
        
                case when routeType in ('xml', 'view', 'function', 'procedure') then
                    a.tables
                end tables

        from    RouteTable r
                left join json_each(r.valueMapping) jMapping
                left join AllTables a
                on r.keyName = a.keyName
                and r.groupSeq = a.groupSeq
                and r.seq = a.seq

        where   (r.seq = 0 and r.routeType in ('mapping', 'method'))
                or r.routeType in ('xml', 'view', 'function', 'procedure')
        order by r.keyName, r.groupSeq, tables
        )
group by keyName, groupSeq;


create view vRouteJspTxt
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
        || value output
from    vRouteJsp;


create view vStartToJsps
as
select  keyName, groupSeq, group_concat(start) start, group_concat(distinct jsps) jsps
from    (
        select  r.keyName, r.groupSeq,
        
                case routeType 
                when 'mapping' then jMapping.value
                when 'method' then r.valueMethod
                end start,
        
                case routeType
                when 'jsp' then jJsp.value
                end jsps
        from    RouteJsp r
                left join json_each(r.valueMapping) jMapping
                left join json_each(r.valueJsp) jJsp
        where   r.seq = 0 and r.routeType in ('mapping', 'method')
                or r.routeType in ('jsp')
        order by r.keyName, r.groupSeq, jsps
        )
group by keyName, groupSeq;


create view vJspViewFinds
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
`;
