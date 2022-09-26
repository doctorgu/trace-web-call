export const sqlCacheInit = `
drop table if exists Tables;
drop table if exists ObjectAndTables;

drop table if exists CstSimple;


create table Tables (
    path text not null,
    name text not null,
    insertTime timestamp not null default current_timestamp,
    primary key (path, name)
);

create table ObjectAndTables (
    path text not null,
    objectType text not null,

    object text not null,
    objectParent text not null,

    objects text not null,
    
    tables text not null,
    tablesInsert text not null,
    tablesUpdate text not null,
    tablesDelete text not null,
    tablesSelect text not null,
    
    insertTime timestamp not null default current_timestamp,
    primary key (path, objectType, object)
);


create table CstSimple (
    path text not null,
    mtime timestamp not null,
    cstSimple text not null,
    insertTime timestamp not null default current_timestamp,
    primary key (path, mtime)
);
`;
