package api.common.controller;

@Controller
@RequestMapping("/root")
public class ModelAndViewTestController extends AbstractBaseController {
	@RequestMapping(value="/abc/abc.do",method=RequestMethod.GET)
	public View getAbc(Model model) throws Exception {
		return new MappingJacksonJsonView();
	}

	@RequestMapping(value="/abc/abc2.do",method=RequestMethod.GET)
	public ModelAndView getAbc2(Model model) throws Exception {
		if (true) {
			return new ModelAndView("/output/abc2", model);
		} else {
			return new ModelAndView("/output/abc3", model);
		}
	}

	@RequestMapping(value="/abc/abc4.do",method=RequestMethod.GET)
	public ModelAndView getAbc4(Model model) throws Exception {
		String p1 = "name=Hong";
		String p2 = "age=19";
		return new ModelAndView("/output/abc4"+"?" + p1 +  "&" + p2, model);
	}

	ResponseEntity<?> bizBuilderWidgetHandler(@RequestBody Map<String, Object> bodyParam){
		JsonObject body = new JsonObject(bodyParam);
		
		try {
			JsonObject param = body.getJsonObject("param");
			
			String workId = param.getValue("WORK_ID").toString();
			return ResponseEntity.ok(body.encode());
			
		} catch (Exception e) {
			e.printStackTrace();
			throw new MicroServiceException(HttpStatus.INTERNAL_SERVER_ERROR, 500, "System Error");
		}
	}	
}
