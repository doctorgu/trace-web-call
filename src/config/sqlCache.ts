export const sqlCacheInit = `
drop table if exists CstSimple;

create table CstSimple (
    sha1 text not null primary key,
    path text not null,
    cstSimple text not null,
    insertTime timestamp not null default current_timestamp
);
`;
