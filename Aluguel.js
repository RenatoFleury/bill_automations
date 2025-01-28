function mainAluguel() {
  const env_data = JSON.parse(HtmlService.createHtmlOutputFromFile(".env.html").getContent());
  const bill_type = "Aluguel";
  const {
    sender,
    subject,
    period,
    folder_id,
    spreadsheet_id,
    tab_name
  } = env_data[bill_type];

  let bill_data = Aluguel.findBill(bill_type, sender, subject, period, folder_id);
  if (bill_data) {
    const file_id = Aluguel.saveBill(folder_id, bill_data.file_name, bill_data.message);
    if (file_id) {
      bill_data["file_id"] = file_id;
      append_data_to_spreadsheet(spreadsheet_id, tab_name, bill_data);
    }
  }
}

const Aluguel = {

  findBill: function(bill_type, sender, subject , period) {
    let threads = GmailApp.search(`from:${sender} subject:${subject} newer_than:${period}`);

    if (threads.length > 0) {
      let messages = threads[0].getMessages();
      let message = messages[messages.length - 1]; // Pega a última mensagem no thread
      
      Logger.log("Email encontrado em " + message.getDate() + "!");
      
      let ref_month = message.getDate().getMonth() + 1;
      let ref_year = message.getDate().getFullYear();
      let value = Aluguel.get_value(message.getPlainBody());
      let dead_line = Aluguel.get_dead_line(message.getPlainBody()); // DD/MM/YYYY
      let bar_code = Aluguel.get_bar_code(message.getPlainBody());
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

  saveBill: function(folder_id, file_name, message) {
    if (!is_file_in_folder(file_name, folder_id)) {
      let file_link = Aluguel.get_file_link(message.getBody());
      let response = UrlFetchApp.fetch(file_link);
      let blob = response.getBlob();
      let folder = DriveApp.getFolderById(folder_id);
      let file = folder.createFile(blob.setName(file_name));
      Logger.log(`PDF ${file_name} salvo com sucesso!`)
      const file_id = file.getId();
      return file_id;
    } else {
      Logger.log(`PDF ${file_name} já existe na pasta!`)
      return null;
    }
  },

  get_value: function(plainBody) {
    let regex = /^Valor:.*$/gm;
    let matches = plainBody.match(regex);
    let match = matches ? matches[0] : null;
    let value = match ? Number(match.replace("Valor:", "").replace(/\s+/g, "").replaceAll(".", "").replace(",", ".")) : null;
    Logger.log("Value: " + value)
    return value;
  },

  get_dead_line: function(plainBody) {
    let regex = /^Vencimento:.*$/gm;
    let matches = plainBody.match(regex);
    let match = matches ? matches[0] : null;
    let date = match ? match.replaceAll("Vencimento:", "").replaceAll(" ", "") : null ;
    Logger.log("Deadline: " + date)
    return date;
  },

  get_bar_code: function(plainBody) {
    let regex = /\d{30,}/gm;
    let matches = plainBody.match(regex);
    let match = matches ? matches[0] : null;
    let bar_code = match ? match.replace(/\s+/g, "") : null;
    Logger.log("Bar_code: " + bar_code)
    return bar_code;
  },

  get_file_link: function(body) {
    let regex = /href="([^"]+)"\starget/;
    let results = body.match(regex);
    let result_group = results ? results[1] : null;
    Logger.log("File_link: " + result_group);
    return result_group;
  }
}