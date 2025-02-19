function mainCartao() {
  const env_data = JSON.parse(HtmlService.createHtmlOutputFromFile(".env.html").getContent());
  let bill_type = "Cartao";
  let sender = env_data[bill_type]["sender"];
  let subject = env_data[bill_type]["subject"];
  let period = env_data[bill_type]["period"];
  let folder_id = env_data[bill_type]["folder_id"];
  let spreadsheet_id = env_data[bill_type]["spreadsheet_id"];
  let tab_name_card = env_data[bill_type]["tab_card"];

  const card = new Card()
  const attachment = card.findBill(sender,subject,period);
  if (card.saveBill(attachment, folder_id)) {
    let bill_data_string = card.getBillData(attachment);
    card.appendDataToSheets(bill_data_string, spreadsheet_id, tab_name_card);
  }
  return card.logs
}

class Card {
  constructor() {
    this.logs = [];
  }

  findBill(sender, subject , period) {
    let threads = GmailApp.search(`from:${sender} subject:${subject} newer_than:${period}`);

    if (threads.length > 0) {
      let messages = threads[0].getMessages();
      let message = messages[messages.length - 1]; // Pega a última mensagem no thread
      
      this.add_log("Email encontrado em " + message.getDate() + "!");
      
      let attachments = message.getAttachments();
      let attachment = attachments[0]; // Pega o primeiro anexo
      let attachment_name = attachment.getName()
      
      this.add_log(`PDF ${attachment_name} encontrado!`);
      return attachment;
    } else {
      this.add_log("Email não encontrado!")
      return null;
    } 
  }

  saveBill(attachment, folder_id) {
    const attachment_name = attachment.getName();
    const folder = DriveApp.getFolderById(folder_id);
    
    if (is_file_in_folder(attachment_name, folder_id)) {
      this.add_log(`PDF ${attachment_name} já existe na pasta!`)
      return false;
    } else {
      if (attachment.getContentType() === 'application/pdf') {
        const file = folder.createFile(attachment);
        this.add_log(`Fatura salva como: ${attachment_name}`);
        return true;
      } else {
        this.add_log(`attachment isn't of type 'application/pdf'`);
        return false;
      }
    }
  }

   getBillData(attachment) {
    let blob = attachment.copyBlob();
    let bytes = blob.getBytes();
    const data_base64 = Utilities.base64Encode(bytes);
    const data_mime_type = "application/pdf"
    const query = "Get all the transactions in the pdf. Give me the answer with day, month, stablishment and value.";
    const generationConfig = {
      "response_mime_type": "application/json",
      "response_schema": {
        "type": "ARRAY",
        "items": {
          "type": "OBJECT",
          "properties": {
            "day": {"type":"NUMBER"},
            "month" : {"type":"NUMBER"},
            "stablishment" : {"type":"STRING"},
            "value" : {"type":"NUMBER"}
          }
        }
      }
    }
    let bill_data = call_gemini(query, data_mime_type, data_base64, generationConfig);
    
    return bill_data
  }

  appendDataToSheets(bill_data_string, spreadsheet_id, tab_name) {
    try {
      const bill_data = JSON.parse(bill_data_string);
      const spreadsheet = SpreadsheetApp.openById(spreadsheet_id);
      let sheet = spreadsheet.getSheetByName(tab_name);
      if (!sheet) {
        this.add_log(`The tab ${tab_name} doesn't exist.`)
      }

      // Prepare the data rows.
      const headers = (sheet.getLastRow() === 0) ? (bill_data.length > 0 ? Object.keys(bill_data[0]) : []) : Object.keys(bill_data[0]); // Get headers from data if sheet is empty
      const dataRows = bill_data.map(item => {
        return headers.map(header => item[header]);
      });

      // Append the data rows to the sheet.
      if (dataRows.length > 0) {
        sheet.getRange(sheet.getLastRow() + 1, 1, dataRows.length, headers.length).setValues(dataRows);
      }

      this.add_log("Data appended to sheet: " + tab_name);

    } catch (e) {
      this.add_log("Error: " + e.toString());
      this.add_log("Stack Trace: " + e.stack); // Add stack trace for better debugging
      throw e;
    }
  }

  add_log(message) {
    this.logs.push(message);
    Logger.log(message);
  }
}
