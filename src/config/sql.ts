export const sqlInit = `
drop table if exists XmlInfo;
drop table if exists XmlNodeInfo;

drop table if exists ClassInfo;
drop table if exists HeaderInfo;
drop table if exists MethodInfo;
drop table if exists MethodInfoFind;
drop table if exists Tables;
drop table if exists ObjectAndTables;

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
    filePostfix text not null,
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
create index IxMethodInfoFind1 on MethodInfoFind (filePostfix, name, parameterCount, className, implementsName);
create index IxMethodInfoFind2 on MethodInfoFind (filePostfix, classPath);

create table Tables (
    name text not null primary key
) strict;

create table ObjectAndTables (
    object text not null primary key,
    objectType text not null,
    tables text not null
) strict;
`;
