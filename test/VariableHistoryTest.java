public class VariableHistoryTest {
	public String getDup(String value) {
		return value + value;	
	}

	public void doTest() {
		String s = "a";
		a += "a";
		a = getDup(a) + "b" + getDup("x");
		return a;
	}
}
