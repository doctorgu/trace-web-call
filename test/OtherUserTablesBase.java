package api.common.controller;

public class OtherUserTablesBase {
	public List<DBObject> selectMemberByModel(Model model) {
    return commonSql.selectList("OtherUserTable.selectUser", model);
	}
}
