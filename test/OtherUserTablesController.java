package api.common.controller;

@Controller
@RequestMapping("/root")
public class OtherUserTablesController extends OtherUserTablesBase {
  @Resource(name = "overloadRouteTestService")
  private OtherUserTablesDependency otherUserTablesDependency;

	@RequestMapping("/select/user")
	public ModelAndView selectMember(Model model) throws Exception {
		return selectMemberByModel(model);
    // return commonSql.selectList("OtherUserTable.selectUser", model);
	}

	@RequestMapping("/select/selectMualOrgIdxByMualIdx")
	public ModelAndView selectMember(ModelMual model) throws Exception {
		return otherUserTablesDependency.selectMualOrgIdxByMualIdx(model);
	}
}
