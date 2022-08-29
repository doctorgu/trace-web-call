public class OverloadRouteTestServiceImpl implements OverloadRouteTestService {
  @Autowired
  private WidgetService widgetService;

  private MemberInfoDAO memberInfoDAO;

  public MemberVO selectMember(String siteId, String cryptedId, String custNo) {
    // Must add to routes
    this.selectMember(siteId, null);
  
    // Must not add to routes
    return this.selectMember(siteId, null);
  }

  public MemberVO selectMember(String custNo) {
    String siteId = 1;
    // Must add to routes
    this.selectMember(siteId, null);
  
    // Must add to routes
    return this.selectMember(siteId, null);
  }

  public MemberVO selectMember(String siteId, MemberVO param) {
    return this.memberInfoDAO.selectMember(siteId, param);
  }
}