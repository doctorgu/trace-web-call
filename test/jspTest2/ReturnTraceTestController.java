public class ReturnTraceTestController {
  @RequestMapping(value = "/return.do")
  public ModelAndView returnTrace(ModelMap modelMap, HttpServletRequest request, HttpServletResponse response) {
    return Util.msgOnceAlertView("삭제되었습니다", "/m/smGgimL.do", response);
  }
}