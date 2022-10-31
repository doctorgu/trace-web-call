# SQL

```sql
-- h2o_hmall_route_table
select  r.keyName key_name, r.groupSeq group_seq, r.seq, r.depth, r.routeType route_type,
        r.valueMethod value_method, r.valueXml value_xml, r.valueView value_view, r.valueFunction value_function, r.valueProcedure value_procedure,
        r.selectExists select_exists
from    RouteTable r;

-- h2o_hmall_route_mapping
select  r.keyName key_name, r.groupSeq group_seq, r.seq, j.value
from    RouteTable r
        inner join json_each(r.valueMapping) j;

-- h2o_hmall_route_objects
select  r.keyName key_name, r.groupSeq group_seq, r.seq, j.value
from    RouteTable r
        inner join json_each(r.objects) j;

-- h2o_hmall_route_insert
select  r.keyName key_name, r.groupSeq group_seq, r.seq, j.value
from    RouteTable r
        inner join json_each(r.tablesInsert) j;

-- h2o_hmall_route_update
select  r.keyName key_name, r.groupSeq group_seq, r.seq, j.value
from    RouteTable r
        inner join json_each(r.tablesUpdate) j;

-- h2o_hmall_route_delete
select  r.keyName key_name, r.groupSeq group_seq, r.seq, j.value
from    RouteTable r
        inner join json_each(r.tablesDelete) j;

-- h2o_hmall_route_other
select  r.keyName key_name, r.groupSeq group_seq, r.seq, j.value
from    RouteTable r
        inner join json_each(r.tablesOther) j;


-- h2o_hmall_route_jsp
select  r.keyName key_name, r.groupSeq group_seq, r.seq, r.depth, r.routeType route_type,
        r.valueMethod value_method
from    RouteJsp r;

-- h2o_hmall_route_jsps
select  r.keyName key_name, r.groupSeq group_seq, r.seq, j.value
from    RouteJsp r
        inner join json_each(r.jsps) j;


-- users.txt
select  username
from    all_users
where   username not in ('CTXSYS','DBADMIN','EXFSYS','EXPERDB','OUTLN','SYS','SYSTEM','WMSYS','XDB','XS$NULL')
        and username in (select owner from all_tables union all select owner from all_objects)
order by username;

-- tables.txt
select  owner || '.' || table_name
from    all_tables
where   owner not in ('CTXSYS','DBADMIN','EXFSYS','EXPERDB','OUTLN','SYS','SYSTEM','WMSYS','XDB','XS$NULL')
        and (table_name not like '$%' and table_name not like '#%' and length(table_name) >= 5)
order by owner, table_name;

-- views.txt
with t as
(
    select  owner, name, type, referenced_owner, referenced_name, case when referenced_type != 'TABLE' then 'OBJECT' else 'TABLE' end referenced_type
    from    sys.dba_dependencies
    where   type = 'VIEW'
            and referenced_type in ('TABLE','VIEW','FUNCTION','PROCEDURE')
            and owner not in ('CTXSYS','DBADMIN','EXFSYS','EXPERDB','OUTLN','SYS','SYSTEM','WMSYS','XDB','XS$NULL')
            and referenced_owner not in ('CTXSYS','DBADMIN','EXFSYS','EXPERDB','OUTLN','SYS','SYSTEM','WMSYS','XDB','XS$NULL')
    order by owner, name, referenced_owner, referenced_name
), t2 as
(
    select  owner, name, referenced_type,
            case when referenced_type = 'OBJECT' then
              '[' || listagg('"' || referenced_owner || '.' || referenced_name || '"', ',') within group (order by referenced_owner, referenced_name) || ']'
            end objects,
            case when referenced_type = 'TABLE' then
              '[' || listagg('"' || referenced_owner || '.' || referenced_name || '"', ',') within group (order by referenced_owner, referenced_name) || ']'
            end tables_select
    from    t
    group by owner, name, referenced_type
)
select  owner || '.' || name name, nvl(min(objects), '[]') objects, nvl(min(tables_select), '[]') tables_select
from    t2
group by owner || '.' || name
order by 1;

-- batch confluence
with
jobComma (value) as
(
    select  'TestJob1,TestJob2'
),
jobRow as
(
    select  row_number() over (order by 1) rnum, job.value
    from    jobComma j
            inner join json_each('[' || regexp_replace(j.value, '([^,]+)', 'g', '"$1"') || ']') job
),
jobRowJoined as
(
    select  r.keyName, r.groupSeq, jr.rnum -- r.valueJob
    from    RouteBatch r
            inner join jobRow jr
            on jr.value = r.valueJob
),
r012 as
(
    select  r.keyName, r.groupSeq,
            case r.routeType
            when 'job' then
                r.valueJob
            when 'step' then
                '└─ ' || r.valueStep
            when 'method' then
                '└──── ' || r.valueMethod
            when 'xml' then
                '└──── ' || r.valueXml
            end value,
            jr.rnum
    from    RouteBatch r
            inner join jobRowJoined jr
            on jr.keyName = r.keyName
            and jr.groupSeq = r.groupSeq
    where   r.depth in (0, 1, 2)
),
r012Value as
(
    select  keyName, groupSeq, rnum, group_concat(value, char(13)) value
    from    r012
    group by keyName, groupSeq, rnum
),
t as
(
    select  r.keyName, r.groupSeq, r.seq, r.depth, r.routeType,

            case when r.seq = 0 then v.value end value,

            i.value i, u.value u, d.value d,
            case when r.selectExists = 1 then o.value else null end s,

            v.rnum
    from    RouteBatch r
            inner join r012Value v
            on v.keyName = r.keyName and v.groupSeq = r.groupSeq
            left join json_each(r.tablesInsert) i
            left join json_each(r.tablesUpdate) u
            left join json_each(r.tablesDelete) d
            left join json_each(r.tablesOther) o
    where   (
                (r.routeType in ('job', 'step') or (r.depth = 2 and r.routeType in ('method', 'xml')))
                or r.routeType in ('xml', 'view', 'function', 'procedure')
            )
)
select  group_concat(t.value)
        || ifnull(char(13) || 'I:' || group_concat(distinct t.i), '')
        || ifnull(char(13) || 'U:' || group_concat(distinct t.u), '')
        || ifnull(char(13) || 'D:' || group_concat(distinct t.d), '')
        || ifnull(char(13) || 'S:' || group_concat(distinct t.s), '')
        || char(13) || char(13) value
from    t
group by t.keyName, t.groupSeq, t.rnum
order by t.rnum
```
