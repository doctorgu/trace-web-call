public class OverloadTestServiceImpl implements OverloadTestService {
  @Autowired
  private WidgetService widgetService;

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