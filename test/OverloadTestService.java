public class OverloadTestServiceImpl implements OverloadTestService {
	@Autowired
	private WidgetService widgetService;

	ResponseEntity<?> aGroupRegistRatingHandler(@RequestBody Map<String, Object> bodyParam, @RequestAttribute("sessionInfo") JsonObject sessionInfo){
		try {	
			if (APP_ID != 0 || POINT != -1 || COMNT != null) {
				if (GUBUN.equals("INSERT")) {
					code = widgetService.insertRating(param);
				} else if (GUBUN.equals("UPDATE")) {
					code = widgetService.updateRating(param);
				} else if (GUBUN.equals("DELETE")) {
					code = widgetService.deleteRating(param);
				} else {
					code = 500;
				}
				body.put("code", code);
			} else {
				body.put("code", 500);
			}

			return ResponseEntity.ok(body.encode());

		} catch (Exception e) {
			e.printStackTrace();
			throw new MicroServiceException(HttpStatus.INTERNAL_SERVER_ERROR, 500, "System Error");

		}
	}

	public List<DBObject> getGroupRatingList(JsonObject param) {
		try {
			return commonSql.selectList("Widget.getGroupRatingList", param.getMap());
		} catch (SQLException e) {
			e.printStackTrace();
			return null;
		}
	}

  private MemberInfoDAO memberInfoDAO;

  public MemberVO selectMember(String siteId, String cryptedId, String custNo) {
    MemberVO param = getMemberVO();
    param.setCustNo(custNo);

	this.selectMember(siteId, param);
	selectMember(siteId, param);
	
    return this.selectMember(siteId, param);
  }

  public MemberVO selectMember(String siteId, MemberVO param) {
    return this.memberInfoDAO.selectMember(siteId, param);
  }
}