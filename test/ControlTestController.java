package api.common.controller;

public class ControlTestController {
	public ModelAndView ifTrueElse(Model model) throws Exception {
		if (true) {
			return true;
		} else {
			return false;
		}
	}

	public ModelAndView ifTrueElseIfFalse(Model model) throws Exception {
		if (true) {
			return true;
		} else if (false) {
			return false;
		}
	}
}
