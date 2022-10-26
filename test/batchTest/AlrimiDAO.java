package batchTest;

public class AlrimiDAO extends AbstractDAO {
  private String jobName;
  private String stepName;
  private String today;

  public void executeDayBatch() throws Exception {
    HshopBatchVO broadList = new HshopBatchVO();
    HshopBatchMap paramMap = new HshopBatchMap();
    paramMap.put("today", today);

    broadList = hshopList2hshopVO("AlrimiDAO.selectList", null);
    result = hshopUpdate("AlrimiDAO.insertSms", paramMap);
  }

  public String getJobName() {
    return jobName;
  }
  public void setJobName(String jobName) {
    this.jobName = jobName;
  }

  public String getStepName() {
    return stepName;
  }
  public void setStepName(String stepName) {
    this.stepName = stepName;
  }

  public String getToday() {
    return today;
  }
  public void setToday(String today) {
    this.today = today;
  }
}