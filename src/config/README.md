# SQL

```sql
-- h2o_hmall_key_info
select  keyName key_name
from    KeyInfo;

-- h2o_hmall_route_table
select  r.keyName key_name, r.groupSeq group_seq, r.seq, r.seqParent seq_parent, r.depth, r.routeType route_type,
        r.value,
        r.selectExists select_exists
from    RouteTable r
union all
select  r.keyName key_name, r.groupSeq group_seq, r.seq, r.seqParent seq_parent, r.depth, r.routeType route_type,
        r.value,
        r.selectExists select_exists
from    RouteBatch r;

-- h2o_hmall_route_mapping
select  r.keyName key_name, r.groupSeq group_seq, r.seq, r.seqParent seq_parent, j.value
from    RouteTable r
        inner join json_each(r.valueList) j
where   r.routeType = 'mapping';

-- h2o_hmall_route_object
select  r.keyName key_name, r.groupSeq group_seq, r.seq, r.seqParent seq_parent, j.value
from    RouteTable r
        inner join json_each(r.objects) j
union all
select  r.keyName key_name, r.groupSeq group_seq, r.seq, r.seqParent seq_parent, j.value
from    RouteBatch r
        inner join json_each(r.objects) j;

-- h2o_hmall_route_insert
select  r.keyName key_name, r.groupSeq group_seq, r.seq, r.seqParent seq_parent, j.value
from    RouteTable r
        inner join json_each(r.tablesInsert) j
union all
select  r.keyName key_name, r.groupSeq group_seq, r.seq, r.seqParent seq_parent, j.value
from    RouteBatch r
        inner join json_each(r.tablesInsert) j;

-- h2o_hmall_route_update
select  r.keyName key_name, r.groupSeq group_seq, r.seq, r.seqParent seq_parent, j.value
from    RouteTable r
        inner join json_each(r.tablesUpdate) j
union all
select  r.keyName key_name, r.groupSeq group_seq, r.seq, r.seqParent seq_parent, j.value
from    RouteBatch r
        inner join json_each(r.tablesUpdate) j;

-- h2o_hmall_route_delete
select  r.keyName key_name, r.groupSeq group_seq, r.seq, r.seqParent seq_parent, j.value
from    RouteTable r
        inner join json_each(r.tablesDelete) j
union all
select  r.keyName key_name, r.groupSeq group_seq, r.seq, r.seqParent seq_parent, j.value
from    RouteBatch r
        inner join json_each(r.tablesDelete) j;

-- h2o_hmall_route_other
select  r.keyName key_name, r.groupSeq group_seq, r.seq, r.seqParent seq_parent, j.value
from    RouteTable r
        inner join json_each(r.tablesOther) j
union all
select  r.keyName key_name, r.groupSeq group_seq, r.seq, r.seqParent seq_parent, j.value
from    RouteBatch r
        inner join json_each(r.tablesOther) j;


-- h2o_hmall_route_jsp
select  r.keyName key_name, r.groupSeq group_seq, r.seq, r.seqParent seq_parent, r.depth, r.routeType route_type,
        r.value
from    RouteJsp r;

-- h2o_hmall_route_jsps
select  r.keyName key_name, r.groupSeq group_seq, r.seq, r.seqParent seq_parent, j.value
from    RouteJsp r
        inner join json_each(r.jsps) j;


-- h2o_hmall_object_to_start
select  keyName key_name, groupSeq group_seq, seq, seqParent seq_parent, depth, name, routeType route_type, value
from    vObjectToStart
union all
select  keyName key_name, groupSeq group_seq, seq, seqParent seq_parent, depth, name, routeType route_type, value
from    vObjectToBatch
order by keyName, groupSeq, seq desc;


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
    select  owner, name, type, referenced_owner, referenced_name,
            case when referenced_type != 'TABLE' then 'OBJECT' else 'TABLE' end referenced_type
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
    select 'PMEChannelCheckAlmJob,CUAfcrNewMemSmrJob,CUEnterSiteJob,CSECrtErrRqstPrcJob,CUCustGrdGdSilverJob,CUCustGrdGdJob,CUCustMktgAgrInfEmailJob,COBMembershipCustRegInterfaceJob,COBMembershipCustLevInterfaceJob,CUMemberChangeJob,CUCustGrdPlePushJob,CUCustGrdDiaPushJob,CUCustGrdTopPushJob,PDCGamBackJob,PDBItemStatusJob,ODSendBasketPriceChangeEmailJob,CUChkCertLogJob,ODTransGiftyConReportJob,ODDeleteBasktInfJob,CUBasktRcmmEmailJob,BMEvalVdoUpdateJob,PDItemEvalComtPushJob,PDCreateBestComtSmrJob,PDCreateRevrComtSmrJob,CUHsEmpDcMstUpdateJob,ODAfreecaTvCancelJob,ODAfreecaTvDepositJob,ODChanelOrdDataJob,ODKakaoMapUpdateJob,PDCItemEvalQnaAlrimJob,ODSendBasketPriceChangePushJob,ODGiftOrdSmsResendJob,ODPlccCustJob,ODPlccCustGrdJob,PDMassOrdReqJob,HMGTsdItemDeptCntJob,DPCreateSectSummaryJob,DPDayItemCntJob,DPInsertItemClickRankJob,DPInsertSectBrand4DepthJob,DPInsertSectCtgrSumJob,DPSectItemSumJob,DPUpdateItemPackCostJob,DPUpdateSectDbstsJob,DPUpdateSectItemCntJob,EVDeleteTentrantJob,EVFamilyCouponUpdateJob,DPBackupHomeJob,BMAlrimiJob,EVOrdRankJob,COAItemSupportJob,DPInsertSectBrand2Depthjob,PDBfmtSrchInfUpdateJob,BMBfmtInfJob,BMVodMonitorJob,GreenEmailSendJob,COABatchMonitorJob,BMVodDelJob,PDETireSizeSearchJob,BMAlrimiDayJob,DPSearchPopKeyWordJob,HMABbsCrawlingBatchJob,EVVdoMngJob,DPSectClhItemSumJob,DPOnAirDataJob,BMPgmAlrimiJob,BMUploadWenUpdateJob,DPSpecialShopSmartJob,BMBitmAlrimSmrJob,CUSendCrdPrmoJob,DPInsertDealItemJob,DPInsertOdtmDealItemSmrJob,EVInsertAmtJob,BMVodUploaderUpdateJob,DPNewMainData4Job,DPKrxDataJob,DPInsertSectQryCntInfJob,DPInsertBrandDispItemJob,DPBrndSellFreqSmrJob,PDInsertMkCrdLntmWintItemSmrJob,DPMtrmRsvPushJob,PDCInsertOmScwdCntSmrJob,DPInsertOmSrchIcidxDtlJob,PDItemPtcIdnfHisJob,BMSmileTesterBlackListSetJob,BMSmileTesterNonRegsendLmsJob,DPCtgrExcltCopnItemJob,BMSectMngUploaderUpdateJob,DPInsertSect2ClickRnkJob,DPSectFundingItemSumJob,DPBrodCtgrBestItemJob,EVInsertStampAmtJob,DPInsertOmSectSmrJob,BMMlbVIPUpdateJob,BMMlbTotAlrimiJob,PDSearchIdxSmrJob,DPBMlbEventPastProcDAOJob,CUBrodCustVipCopnPblcJob,PDSearchSoldOutPnltSmrJob,DPUpdateEvalVdoHideJob,EVClubFriendsCouponUpdateJob,DPInsertDealItemDtlJob,DPDeptItemDispExcldJob,DPInsertItemBrodPrrgTimeJob,DPInsertOmBrodNotfSmrJob,DPInsertOmOptItemEvalSmrJob,DPDeptTabSlitmDispPrtyNewJob,DPInsertItemVdoRunTimeJob,BMUntdVodUploaderUpdateJob,DPKeywordADNewJob,DPSpecialShopSmartNewJob,PDReferPopupNewJob,DPUpdateUntdSpexNewJob,DPNewMainDataNewJob,DPExecPurgeJob,DPUpdateMkEventBbcAtflDtlJob,PDOmniousTaggerJob,PDOmniousTaggerAllJob,EVMemberShipPointJob,EVMemberShipBenefitJob,HMABEvntDayDAOJob,PDSearchOptAttrJob,PDSearchTagSmrJob,PDItemQnaPushSendJob,DPSectPrsnItemSumJob,DPSectPrsnWkItemSumJob,PDGetGARealTimeUserJob,DPSearchRltmKeyWordJob,EVPetMemberShipBenefitJob'
    --select 'DPInsertOdtmDealItemSmrJob,ODGiftOrdCnclSmsSendJob'
),
jobRow as
(
    select  row_number() over (order by 1) rnum, job.value
    from    jobComma j
            inner join json_each('[' || regexp_replace(j.value, '([^,]+)', 'g', '"$1"') || ']') job
),
jobRowJoined as
(
    select  r.keyName, r.groupSeq, jr.rnum
    from    RouteBatch r
            inner join jobRow jr
            on jr.value = r.value
),
r012 as
(
    select  distinct
            r.keyName, r.groupSeq,

            case when r.depth = 0 then
                ''
            else
                '└' || substring(replace(printf('%0' || (r.depth * 3) || 'd', '0'), '0', '─'), 3) || ' '
            end
            ||
            r.value value,
            jr.rnum
    from    RouteBatch r
            inner join jobRowJoined jr
            on jr.keyName = r.keyName
            and jr.groupSeq = r.groupSeq
    where   (
                (r.routeType in ('job', 'step') or (r.depth = 2 and r.routeType in ('method', 'xml')))
                or r.routeType in ('xml')
            )
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

            case when r.routeType = 'view' then r.value end v,
            case when r.routeType = 'function' then r.value end f,
            case when r.routeType = 'procedure' then r.value end p,

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
select  '* ' || group_concat(distinct t.keyName)
        || char(13) || group_concat(t.value)
        || ifnull(char(13) || '(Insert):' || group_concat(distinct t.i), '')
        || ifnull(char(13) || '(Update):' || group_concat(distinct t.u), '')
        || ifnull(char(13) || '(Delete):' || group_concat(distinct t.d), '')
        || ifnull(char(13) || '(Select):' || group_concat(distinct t.s), '')
        || ifnull(char(13) || '(View):' || group_concat(distinct t.v), '')
        || ifnull(char(13) || '(Function):' || group_concat(distinct t.f), '')
        || ifnull(char(13) || '(Procedure):' || group_concat(distinct t.p), '')
        || char(13) || char(13) value
from    t
where   (t.i is null or t.i is not null and t.i not like '%BATCH_%')
        and (t.u is null or t.u is not null and t.u not like '%BATCH_%')
        and (t.d is null or t.d is not null and t.d not like '%BATCH_%')
        and (t.s is null or t.s is not null and t.s not like '%BATCH_%')
group by t.keyName, t.groupSeq, t.rnum
order by t.rnum;
```
