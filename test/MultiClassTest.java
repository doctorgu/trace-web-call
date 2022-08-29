public class MultiClassTestImpl extends MultiClassService implements MultiClassTest {
  @Resource(name="userDAO")
  private UserDAO userDAO;

  @Override
  public userVO selectUser(UserMap searchMap) throws Exception {
    SFTPClient ftp = new SFTPClient();
    ftp.init(IP, PORT, ID, PWD);

    return userDAO.selectUser(searchMap);
  }
}

class SFTPClient {
  private Session session = null;

  public void init(String ip, init port, String id, String pwd) {
    session.setPassword(pwd);
  }
}