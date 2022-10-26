package batchTest;

public class AlrimiProcessor implements ItemProcessor<AlrimiSmsSendVO, AlrimiGiftSmsSendVO> {
  private String jobName;
  private String stepName;
  private String today;

  public AlimiGiftSmsSendVO process(AlimiGiftSmsSendVO item) throws Exception {
    String ordNo = item.getOrdNo();

    StringBuffer sbSendMessage = new StringBuffer();
    sbSendMessage.append("주문번호 : " + ordNo + "\n");

    itemsetMsgBox(sbSendMessage.toString());

    return item;
  }
}