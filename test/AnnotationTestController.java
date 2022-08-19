package api.common.controller;

@Controller
@RequestMapping("/root")
public class AnnotationTestController extends AbstractBaseController {
	@RequestMapping("/abc/abc.do")
	public ModelAndView getAbc(Model model) throws Exception {
		return new ModelAndView("output/abc", model);
	}

	@RequestMapping(value = "/abc/abc2.do")
	public ModelAndView getAbc2(Model model) throws Exception {
		return new ModelAndView("output/abc2", model);
	}

	@RequestMapping(value="/abc/abc3.do",method=RequestMethod.GET)
	public ModelAndView getAbc3(Model model) throws Exception {
		return new ModelAndView("output/abc3", model);
	}

	@RequestMapping(value={"/abc/abc4.do"})
	public ModelAndView getAbc4(Model model) throws Exception {
		return new ModelAndView("output/abc4", model);
	}

	@RequestMapping(value={"/abc/abc5.do","/abc/abc6.do"})
	public ModelAndView getAbc5(Model model) throws Exception {
		return new ModelAndView("output/abc5", model);
	}

	@RequestMapping(value={"/abc/abc7.do","/abc/abc8.do"},method=RequestMethod.GET)
	public ModelAndView getAbc7(Model model) throws Exception {
		return new ModelAndView("output/abc7", model);
	}

	@RequestMapping(value="/abc/abc9"+ACTION_NAME)
	public ModelAndView getAbc9(Model model) throws Exception {
		return new ModelAndView("output/abc9", model);
	}
}
