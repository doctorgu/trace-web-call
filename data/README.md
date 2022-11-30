# All Tables

```sql
select  owner || '.' || table_name
from    all_tables
where   owner not in
        (
            select owner from all_tables where owner in ('HDHS','HDHS_BAK','DBADMIN','ORANGE','READING')
            union all
            select owner from all_tables where tablespace_name in ('SYSAUX', 'SYSTEM')
        )
order by 1;
```

```sql
select  owner, table_name
from    all_tables
where   owner not in ('APPQOSSYS','HDHS_BAK','MAXGAUGE','META','METAPLUS','META_DEPT','META_NEW','OGG','ORANGE','OUTLN','SYS','SYSTEM','TUSER_D','WMSYS','XDB')
order by 1, 2;
```
