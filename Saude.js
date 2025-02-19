function mainSaude() {
  const env_data = JSON.parse(HtmlService.createHtmlOutputFromFile(".env.html").getContent());
  const bill_type = "Saude";
  const {
    sender,
    subject,
    period,
    folder_id,
    spreadsheet_id,
    tab_name,
    pdf_password
  } = env_data[bill_type];

  let health = new Health(sender, subject, period, folder_id, spreadsheet_id, tab_name, pdf_password);
  let pdf_blob = health.findBill();
  if (pdf_blob) {
    let bill_data = health.processBill(pdf_blob);
    if (bill_data) {
      health.saveBill(pdf_blob, bill_data);
    }
  }
  return health.logs;
}

class Health {
  constructor(sender, subject, period, folder_id, spreadsheet_id, tab_name, pdf_password) {
    this.sender = sender;
    this.subject = subject;
    this.period = period;
    this.folder_id = folder_id;
    this.spreadsheet_id = spreadsheet_id;
    this.tab_name = tab_name;
    this.pdf_password = pdf_password;
    this.bill_type = "Saude";
    this.file_name = "";
    this.logs = [];
  }

  add_log(message) {
    this.logs.push(message);
    Logger.log(message);
  }

  findBill() {
    let threads = GmailApp.search(`from:${this.sender} subject:${this.subject} newer_than:${this.period}`);
    if (threads.length > 0) {
      let messages = threads[0].getMessages();
      let message = messages[messages.length - 1]; // Pega a última mensagem no thread
      this.add_log("Email encontrado em " + message.getDate() + "!");
      let attachments = message.getAttachments();
      let ref_month = message.getDate().getMonth() + 1;
      let ref_year = message.getDate().getFullYear();
      this.file_name = `${ref_year}_${ref_month.toString().padStart(2, '0')}_Boleto_${this.bill_type}.pdf`;
      if (is_file_in_folder(this.file_name, this.folder_id)) {
        this.add_log(`PDF ${this.file_name} já foi catalogado!`)
        return null;
      } else {
        const allowedTypes = ['application/pdf', 'application/octet-stream'];
        for (let attachment of attachments) {
          if (allowedTypes.includes(attachment.getContentType())) {
            let blob_unlocked_pdf = unlockPdf(attachment, this.pdf_password, this.file_name);
            return blob_unlocked_pdf;
          }
        }
      }
    } else {
      this.add_log("Email não encontrado!")
      return null;
    }
  }

  processBill(pdf_blob) {
    const bytes = pdf_blob.getBytes();
    const data_base64 = Utilities.base64Encode(bytes);
    const data_mime_type = "application/pdf"
    const query = "No arquivo enviado me forneça o ano, mês e valor da conta, como também a data de vencimento e o código de barras. (Ano e Mês são referentes ao campo 'Data do Documento') Utilize o seguinte JSON schema para a resposta: { year: Number, month: Number, value: Number, dead_line: String com / como separador, bar_code: String }";
    const generationConfig = {
      "response_mime_type": "application/json",
      "temperature": 0.0
    }
    const response = call_gemini(query, data_mime_type, data_base64, generationConfig);
    if (response) {
      this.add_log(`Bill data: ${response}`);
      const bill_data = JSON.parse(response);
      return bill_data;
    } else {
      this.add_log("Erro ao processar o boleto!")
      return null;
    }
  }

  saveBill(pdf_blob, bill_data) {
    try {
      let folder = DriveApp.getFolderById(this.folder_id);
      let file = folder.createFile(pdf_blob);
      this.add_log(`PDF ${this.file_name} salvo com sucesso!`)
      bill_data["bill_type"] = this.bill_type;
      bill_data["file_id"] = file.getId();
      bill_data["file_name"] = this.file_name;
      append_data_to_spreadsheet(this.spreadsheet_id, this.tab_name, bill_data);
      this.add_log(`Dados do boleto salvos na planilha!`)
    } catch (e) {
      this.add_log(`Erro ao salvar o boleto: ${e}`)
      throw new Error(e);
    }
  }
}