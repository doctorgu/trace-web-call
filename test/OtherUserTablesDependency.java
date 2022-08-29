package api.common.controller;

public class OtherUserTablesDependency {
	public List<DBObject> selectMualOrgIdxByMualIdx(Model model) {
    return commonSql.selectList("OtherUserTableDependency.selectMualOrgIdxByMualIdx", model);
	}
}
