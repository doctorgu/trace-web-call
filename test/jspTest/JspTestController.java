public class JspTestController extends BaseController {
  @RequestMapping(value = "/mainBrodReload.do")
  public ModelAndView mainBrodReload(ModelMap modelMap, HttpServletRequest request, HttpServletResponse response) throws Exception {
    
    String mainType = Util.cleanXSS(request.getParameter("mainType"));
    String brodType = Util.cleanXSS(request.getParameter("brodType"));
    Map<String, Object> param = new HashMap<String, Object>();

    DPLMainHomeDispVO display_zone_list = mainUntdTmplService.selectBrodReload(request, param);
    modelMap.put("display_zone_list", display_zone_list);

    String viewNm = "/mobile/dp/Etv";


    if ("home1".equals(mainType)) {
      if ("etv1".equals(brodType)) {
        viewNm = "/mobile/dp/Etv";
      } else if ("dtv2".equals(brodType)) {
        viewNm = "/mobile/dp/Dtv";
      }
    } else if ("home2".equals(mainType)) {
      if ("etv2".equals(brodType)) {
        viewNm = "/mobile/dp/VHEtv";
      } else if ("dtv2".equals(brodType)) {
        viewNm = "/mobile/dp/VHDtvNotExists";
      }
    }

    return new ModelAndView(viewNm, modelMap);

  }
}