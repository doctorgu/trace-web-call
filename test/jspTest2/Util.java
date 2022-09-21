package smart.util.mobile;

public class Util {
  public static ModelAndView msgOnceAlertView(String msg, String returnUrl, HttpServletResponse response) {
    ModelMap model = new ModelMap();
    model.addAttribute("returnUrl", returnUrl);
    return new ModelAndView("/mobile/co/alert", model);
  }

  public static ModelAndView msgOnceAlertView(String msg, String returnUrl, string claimDiv, HttpServletResponse response) {
    ModelMap model = new ModelMap();
    model.addAttribute("returnUrl", returnUrl);
    model.addAttribute("claimDiv", claimDiv);
    return new ModelAndView("/mobile/co/alert", model);
  }
}