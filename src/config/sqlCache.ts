export const sqlCacheInit = `
drop table if exists CstSimple;

create table CstSimple (
    path text not null,
    mtime timestamp not null,
    cstSimple text not null,
    insertTime timestamp not null default current_timestamp,
    primary key (path, mtime)
);

`;
