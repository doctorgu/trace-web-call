package api.common.controller;

@Controller
@RequestMapping("/root")
public class OverloadRouteTestController extends AbstractBaseController {
  @Resource(name = "overloadRouteTestService")
  private OverloadRouteTestService overloadRouteTestService;

	@RequestMapping("/abc/abc.do")
	public ModelAndView selectMember(Model model) throws Exception {
    overloadRouteTestService.selectMember(model.siteId, model.cryptedId, model.custNo);

		return new ModelAndView("output/abc", model);
	}

	@RequestMapping("/abc/abc2.do")
	public ModelAndView selectMember(Model model) throws Exception {
    overloadRouteTestService.selectMember(model.custNo);

		return new ModelAndView("output/abc2", model);
	}
}
