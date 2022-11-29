export const sqlCacheInit = `
drop table if exists Users;
drop table if exists Tables;
drop table if exists Objects;

drop table if exists CstSimple;


create table Users (
    path text not null,
    name text not null,
    insertTime timestamp not null default current_timestamp,
    primary key (path, name)
);

create table Tables (
    path text not null,
    name text not null,
    insertTime timestamp not null default current_timestamp,
    primary key (path, name)
);

create table Objects (
    path text not null,

    type text not null,
    name text not null,

    objects text not null,
    
    tablesInsert text not null,
    tablesUpdate text not null,
    tablesDelete text not null,
    tablesOther text not null,

    selectExists int not null check (selectExists in (0, 1)),
    
    insertTime timestamp not null default current_timestamp,
    primary key (path, type, name)
);
create index IxObjects1 on Objects (name);

create table CstSimple (
    path text not null,
    mtime timestamp not null,
    cstWithLocation text not null,
    insertTime timestamp not null default current_timestamp,
    primary key (path, mtime)
);
`;
