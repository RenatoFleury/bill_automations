function mainGas() {
  const env_data = JSON.parse(HtmlService.createHtmlOutputFromFile(".env.html").getContent());
  let bill_type = "Gas";
  const {
    sender,
    subject,
    period,
    folder_id,
    spreadsheet_id,
    tab_name,
    pdf_password
  } = env_data[bill_type];

  let bill_data = Gas.findBill(bill_type, sender, subject, period, folder_id);
  if (bill_data) {
    const file_id = Gas.saveBill(folder_id, bill_data.file_name, bill_data.message, pdf_password);
    if (file_id) {
      bill_data["file_id"] = file_id;
      append_data_to_spreadsheet(spreadsheet_id, tab_name, bill_data);
    }
  }
}

const Gas = {

  findBill: function(bill_type, sender, subject , period) {
    var threads = GmailApp.search(`from:${sender} subject:${subject} newer_than:${period}`);
    if (threads.length > 0) {
      let messages = threads[0].getMessages();
      let message = messages[messages.length - 1]; // Pega a última mensagem no thread
      Logger.log("Email encontrado em " + message.getDate() + "!");
      
      let ref_month = message.getDate().getMonth() + 1;
      let ref_year = message.getDate().getFullYear();
      let value = Gas.get_value(message.getPlainBody());
      let dead_line = Gas.get_dead_line(message.getPlainBody()); // DD/MM/YYYY
      let bar_code = Gas.get_bar_code(message.getPlainBody());
      let file_name = `${ref_year}_${ref_month.toString().padStart(2, '0')}_Boleto_${bill_type}.pdf`;
      let bill = {
        "message" : message,
        "year" : ref_year,
        "month" : ref_month,
        "bill_type" : bill_type,
        "value" : value,
        "dead_line" : dead_line,
        "bar_code" : bar_code,
        "file_name" : file_name
      };
      return bill;
    } else {
      Logger.log("Email não encontrado!")
      return null;
    }  
  },

  saveBill: function(folder_id, file_name, message, pdf_password) {
    if (!is_file_in_folder(file_name, folder_id)) {
      let attachments = message.getAttachments();
      for (let attachment of attachments) {
        if (attachment.getContentType() === 'application/pdf') {
          let blob_unlocked_pdf = unlockPdf(attachment, pdf_password, file_name)
          let folder = DriveApp.getFolderById(folder_id);
          let file = folder.createFile(blob_unlocked_pdf);
          Logger.log(`PDF ${file_name} salvo com sucesso!`)
          const file_id = file.getId();
          return file_id;
        }
      }
    } else {
      Logger.log(`PDF ${file_name} já existe na pasta!`)
      return null;
    }
  },

  get_value: function(plainBody) {
    let regex = /R\$\s\d*,\d*/gm;
    let matches = plainBody.match(regex);
    let match = matches ? matches[0] : null;
    let value = match ? Number(match.replace("R$", "").replace(/\s+/g, "").replace(",", ".")) : null;
    Logger.log("Value: " + value)
    return value;
  },

  get_dead_line: function(plainBody) {
    
    let regex = /\d{2}\.\d{2}\.\d{4}/gm;
    let matches = plainBody.match(regex);
    let match = matches ? matches[0] : null;
    let date = match ? match.replaceAll(".", "/") : null ;
    Logger.log("Date: " + date)
    return date;
  },

  get_bar_code: function(plainBody) {
    let regex = /\d{30,}/gm;
    let matches = plainBody.match(regex);
    let match = matches ? matches[0] : null;
    let bar_code = match ? match.replace(/\s+/g, "") : null;
    Logger.log("Bar_code: " + bar_code)
    return bar_code;
  }
}