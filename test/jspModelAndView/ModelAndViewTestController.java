package api.common.controller;

@Controller
@RequestMapping("/root")
public class ModelAndViewTestController extends AbstractBaseController {
	public View getMappingJacksonJsonView(Model model) throws Exception {
		return new MappingJacksonJsonView();
	}

  public ModelAndView getRequiredStringParameter(ModelMap modelMap, HttpServletRequest request, HttpServletResponse response) {
    String eventNo = ServletRequestUtils.getRequiredStringParameter(request, "EventNo");
    String sViewStr = "smEvent" + eventNo + "ViewR";
    Map model = new HashMap();
    model.put("eventNo", eventNo);
    return new ModelAndView("/event/" + sViewStr, model);
  }

	public ModelAndView getConfigUtil(Model model) throws Exception {
		return new ModelAndView("redirect:https://" + ConfigUtil.getString("server.host") + "/p/cob/registMrMember.do", model);
	}

	public ModelAndView getReturns(Model model) throws Exception {
		if (true) {
			return new ModelAndView("/output/abc2", model);
		} else {
			return new ModelAndView("/output/abc3", model);
		}
	}

	public ModelAndView getVariables(Model model) throws Exception {
		String p1 = "name=Hong";
		String p2 = "age=19";
		return new ModelAndView("/output/abc4"+"?" + p1 +  "&" + p2, model);
	}

  public ModelAndView getMsgOnce(ModelMap modelMap, HttpServletRequest request, HttpServletResponse response) {
    return Util.msgOnceAlertView("삭제되었습니다", "/m/smGgimL.do", response);
  }
}
