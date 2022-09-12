export const sqlInit = `
drop table if exists Tables;
drop table if exists ObjectAndTables;

drop table if exists XmlInfo;
drop table if exists XmlNodeInfo;

drop table if exists ClassInfo;
drop table if exists HeaderInfo;
drop table if exists MethodInfo;
drop table if exists MethodInfoFind;


drop view if exists vRoutes;
drop view if exists vRoutesTxt;
drop view if exists vStartToTables;


create table Tables (
    name text not null primary key
) strict;

create table ObjectAndTables (
    objectType text not null,
    object text not null primary key,
    tables text not null
) strict;
create index IxObjectAndTables1 on ObjectAndTables (objectType);


create table XmlInfo (
    xmlPath text not null primary key,
    namespace text not null
) strict;

create table XmlNodeInfo (
    xmlPath text not null,
    id text not null,
    tagName text not null,
    params text not null,
    tables text not null,
    objectAndTables text not null,
    primary key (xmlPath, id),
    foreign key (xmlPath) references XmlInfo (xmlPath) on update cascade on delete cascade
) strict;

create table XmlNodeInfoFind (
    keyName text not null,
    xmlPath text not null,
    id text not null,
    namespaceId text not null,
    tagName text not null,
    params text not null,
    tables text not null,
    objectAndTables text not null,
    primary key (keyName, id, xmlPath)
) strict;
create index IxXmlNodeInfoFind1 on XmlNodeInfoFind (keyName, namespaceId, xmlPath);


create table ClassInfo (
    classPath text not null primary key
) strict;

create table HeaderInfo (
    classPath text not null,
    name text not null,
    implementsName text not null,
    extendsName text not null,
    mapping text not null,
    primary key (classPath, name),
    foreign key (classPath) references ClassInfo (classPath) on update cascade on delete cascade
) strict;

create table MethodInfo (
    classPath text not null,
    mapping text not null,
    isPublic int not null check (isPublic in (0, 1)),
    name text not null,
    parameterCount int not null,
    callers text not null,
    foreign key (classPath) references ClassInfo (classPath) on update cascade on delete cascade
) strict;

create table MethodInfoFind (
    keyName text not null,
    classPath text not null,
    className text not null,
    implementsName text not null,
    extendsName text not null,
    mappingMethod text not null,
    mappingValues text not null,
    isPublic int not null check (isPublic in (0, 1)),
    name text not null,
    parameterCount int not null,
    callers text not null,
    foreign key (classPath) references ClassInfo (classPath) on update cascade on delete cascade
) strict;
create index IxMethodInfoFind1 on MethodInfoFind (keyName, name, parameterCount, className, implementsName);
create index IxMethodInfoFind2 on MethodInfoFind (keyName, classPath);

create table RouteInfo (
    keyName text not null,
    groupSeq int not null,
    seq int not null,
    depth int not null,
    routeType text not null,
    valueMapping text not null,
    valueMethod text not null,
    valueXml text not null,
    valueTable text not null,
    valueView text not null,
    valueFunction text not null,
    valueProcedure text not null,
    primary key (keyName, groupSeq, seq)
) strict;


create view vRoutes
as
select  r.keyName, r.groupSeq, r.seq, min(r.depth) depth, min(r.routeType) routeType,
        ifnull(
            case routeType
            when 'mapping' then group_concat(jMapping.value, ',')
            when 'method' then group_concat(r.valueMethod, ',')
            when 'xml' then group_concat(r.valueXml, ',')
            when 'table' then group_concat(jTable.value, ',')
            when 'view' then
                group_concat(
                    case when jView.key = 'object' then
                        jView.value
                    else
                        '(' || (select group_concat(value) from json_each(jView.value)) || ')'
                    end, ''
                )
            when 'function' then
                group_concat(
                    case when jFunction.key = 'object' then
                        jFunction.value
                    else
                        '(' || (select group_concat(value) from json_each(jFunction.value)) || ')'
                    end, ''
                )
            when 'procedure' then
                group_concat(
                    case when jProcedure.key = 'object' then
                        jProcedure.value
                    else
                        '(' || (select group_concat(value) from json_each(jProcedure.value)) || ')'
                    end, ''
                )
            end
        , ''
        ) value
from    RouteInfo r
        left join json_each(r.valueMapping) jMapping
        left join json_each(r.valueTable) jTable
        left join json_each(r.valueView) jView
        left join json_each(r.valueFunction) jFunction
        left join json_each(r.valueProcedure) jProcedure
group by r.keyName, r.groupSeq, r.seq;

create view vRoutesTxt
as
select  keyName,
        case when seq = 0 then char(13) else '' end
        || substring('         ' || routeType, -9)
        || ': ' ||
        case when depth > 0 then
            replace(substring(printf('%0' || (depth * 4) || 'd', 0) || '+-- ', 5), '0', ' ')
        else
            ''
        end
        || value output
from    vRoutes;

create view vStartToTables
as
select  keyName, groupSeq, group_concat(start) start, group_concat(distinct tables) tables
from    (
        select  r.keyName, r.groupSeq,
        
                case routeType 
                when 'mapping' then jMapping.value
                when 'method' then r.valueMethod
                end start,
        
                case routeType
                when 'table' then jTable.value
                when 'view' then jView.value
                end tables
        from    RouteInfo r
                left join json_each(r.valueMapping) jMapping
                left join json_each(r.valueTable) jTable
                left join json_each(r.valueView, '$.tables') jView
                left join json_each(r.valueFunction, '$.tables') jFunction
                left join json_each(r.valueProcedure, '$.tables') jProcedure
        where   r.seq = 0 and r.routeType in ('mapping', 'method')
                or r.routeType in ('table', 'view', 'function', 'procedure')
        order by r.keyName, r.groupSeq, tables
        )
group by keyName, groupSeq;
`;
