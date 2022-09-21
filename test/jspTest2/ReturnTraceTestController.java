public class ReturnTraceTestController {
  @RequestMapping(value = "/returnTrace.do")
  public ModelAndView returnTrace(ModelMap modelMap, HttpServletRequest request, HttpServletResponse response) {
    return Util.msgOnceAlertView("삭제되었습니다", "/m/smGgimL.do", response);
  }

  @RequestMapping(value = "/returnTrace2.do")
  public ModelAndView returnTrace2(ModelMap modelMap, HttpServletRequest request, HttpServletResponse response) {
    String eventNo = ServletRequestUtils.getRequiredStringParameter(request, "EventNo");
    String sViewStr = "smEvent" + eventNo + "ViewR";
    Map model = new HashMap();
    model.put("eventNo", eventNo);
    return new ModelAndView("/event/" + sViewStr, model);
  }
}