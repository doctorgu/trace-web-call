export const sqlInit = `
drop table if exists Tables;
drop table if exists ObjectAndTables;

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

create table Tables (
    name text not null primary key,
    insertTime timestamp not null default current_timestamp
);

create table ObjectAndTables (
    objectType text not null,
    object text not null primary key,
    tables text not null,
    insertTime timestamp not null default current_timestamp
);
create index IxObjectAndTables1 on ObjectAndTables (objectType);


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
    tables text not null,
    objectAndTables text not null,
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
    tables text not null,
    objectAndTables text not null,
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
    depth int not null,
    routeType text not null,
    valueMapping text not null,
    valueMethod text not null,
    valueXml text not null,
    valueTable text not null,
    valueView text not null,
    valueFunction text not null,
    valueProcedure text not null,
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

create table JspInfo (
    jspPath text not null,
    includes text not null,
    insertTime timestamp not null default current_timestamp,
    primary key (jspPath)
);


create view vRouteTable
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
                        '(' || ifnull((select group_concat(value) from json_each(jView.value)), '') || ')'
                    end, ''
                )
            when 'function' then
                group_concat(
                    case when jFunction.key = 'object' then
                        jFunction.value
                    else
                        '(' || ifnull((select group_concat(value) from json_each(jFunction.value)), '') || ')'
                    end, ''
                )
            when 'procedure' then
                group_concat(
                    case when jProcedure.key = 'object' then
                        jProcedure.value
                    else
                        '(' || ifnull((select group_concat(value) from json_each(jProcedure.value)), '') || ')'
                    end, ''
                )
            end
        , ''
        ) value
from    RouteTable r
        left join json_each(r.valueMapping) jMapping
        left join json_each(r.valueTable) jTable
        left join json_each(r.valueView) jView
        left join json_each(r.valueFunction) jFunction
        left join json_each(r.valueProcedure) jProcedure
group by r.keyName, r.groupSeq, r.seq;

create view vRouteTableTxt
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
from    vRouteTable;

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
                when 'function' then jFunction.value
                when 'procedure' then jProcedure.value
                end tables
        from    RouteTable r
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


create view vRouteJsp
as
select  r.keyName, r.groupSeq, r.seq, min(r.depth) depth, min(r.routeType) routeType,
        ifnull(
            case routeType
            when 'mapping' then group_concat(jMapping.value, ',')
            when 'method' then group_concat(r.valueMethod, ',')
            when 'jsp' then group_concat(jJsp.value, ',')
            end
        , ''
        ) value
from    RouteJsp r
        left join json_each(r.valueMapping) jMapping
        left join json_each(r.valueJsp) jJsp
group by r.keyName, r.groupSeq, r.seq;

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
