-- TAB1 ~ TAB9 (exclude TAB5, TAB9)

create 
view
V_TEST
(
  COL
)
AS
SELECT  COL
FROM    TAB1
;

create no force view v_name (col) as
select 1 from TAB2;

create or replace force view v_name (col) as
select 1 from TAB3;

create or replace force view v_name (col) as
select 1 from TAB4;

-- should exclude because no without force
create or replace no view v_name (col) as
select 1 from TAB5;

CREATE OR REPLACE FORCE VIEW "SCHEMA"."V_VIEW_NAME" ("COL1", "COL2", "COL3", "COL4") AS 
  SELECT
    G.COL1 AS COL1
  , G.COL2 AS COL2
  , G.COL3 AS COL3
  , G.COL4 AS COL4
FROM TAB6 G
UNION ALL
SELECT
    GU1.COL1 AS COL1
  , GU2.COL2 AS COL2
  , GU1.COL3 AS COL3
  , GU2.COL4 AS COL4
FROM ( SELECT
        GU.COL1
      , GU.COL3
      , GU.COL2
    FROM TAB6 GU
    WHERE GU.COL4 = 'D' AND GU.COL3 = 'V' ) GU1
JOIN TAB6 GU2
ON GU2.COL1 = GU1.COL2 AND GU2.COL3 = 'D'
WITH READ ONLY;

create or replace view SCHEMA.AB_CD_#EFGH$
(
  RID,
  COL
)
AS
SELECT  ROWID RID,
        COL
FROM    TAB7
UNION ALL
SELECT  ROWID RID,
        COL
FROM    TAB8
/*
UNION ALL
SELECT  ROWID RID,
        COL
FROM    TAB9
*/
;