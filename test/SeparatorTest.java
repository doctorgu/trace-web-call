public class SeparatorTest {
	public void getAbc(Model model) throws Exception {
		new ModelAndView("redirect:https://" + ConfigUtil.getString("server.host") + "/p/cob/registMrMember.do", model);

		int ternaryTest = true ? 1 : 0;

		switch (num) {
			case 1: break;
			case 2: break;
		}
		
		int num = 1;
		num += 1;
		num -= 1;
		num = num + 1;
		num = num - 1;
		num = 1 + 2 + 3 - 1 - 2 - 3;

		String s = "";
		s = "a" + "b" + "c";

		int x = a & b;
		int y = a ^ b;
		int z = a | b;

		String[] cars = {"Volvo", "BMW", "Ford", "Mazda"};

		int l = 1 + 2 - 3 * 4 / 5;
		int m = (1 + 2) - (3 * (4 / 5));

		
	}
}
