function mainCartao() {
  const env_data = JSON.parse(HtmlService.createHtmlOutputFromFile(".env.html").getContent());
  let bill_type = "Cartao";
  let sender = env_data[bill_type]["sender"];
  let subject = env_data[bill_type]["subject"];
  let period = env_data[bill_type]["period"];
  let folder_id = env_data[bill_type]["folder_id"];
  let spreadsheet_id = env_data[bill_type]["spreadsheet_id"];
  let tab_name_card = env_data[bill_type]["tab_card"];
  
  // let attachment = Cartao.findBill(bill_type, sender, subject , period, folder_id);
  
  const card = new Card()
  const attachment = card.findBill(sender,subject,period);
  if (card.saveBill(attachment, folder_id)) {
    const bill_data_string = card.getBillData(attachment);
    card.appendDataToSheets(bill_data_string, spreadsheet_id, tab_name_card);
  }
}

class Card {
  findBill(sender, subject , period) {
    let threads = GmailApp.search(`from:${sender} subject:${subject} newer_than:${period}`);

    if (threads.length > 0) {
      let messages = threads[0].getMessages();
      let message = messages[messages.length - 1]; // Pega a última mensagem no thread
      
      Logger.log("Email encontrado em " + message.getDate() + "!");
      
      let attachments = message.getAttachments();
      let attachment = attachments[0]; // Pega o primeiro anexo
      let attachment_name = attachment.getName()
      
      Logger.log(`PDF ${attachment_name} encontrado!`);
      return attachment;
    } else {
      Logger.log("Email não encontrado!")
      return null;
    } 
  }

  saveBill(attachment, folder_id) {
    const attachment_name = attachment.getName();
    const folder = DriveApp.getFolderById(folder_id);
    
    if (is_file_in_folder(attachment_name, folder_id)) {
      Logger.log(`PDF ${attachment_name} já existe na pasta!`)
      return false;
    } else {
      if (attachment.getContentType() === 'application/pdf') {
        const file = folder.createFile(attachment);
        Logger.log(`Fatura salva como: ${attachment_name}`);
      } else {
        Logger.log(`attachment isn't of type 'application/pdf'`);
      }
    }
  }

  getBillData(attachment) {
    let blob = attachment.copyBlob();
    let bytes = blob.getBytes();
    const data_base64 = Utilities.base64Encode(bytes);
    const data_mime_type = "application/pdf"
    const query = "Get all the transactions in the pdf. Give me the answer with day, month, stablishment and value.";
    let bill_data = call_gemini(query, data_mime_type, data_base64);
    
    return bill_data
  }

  appendDataToSheets(bill_data_string, spreadsheet_id, tab_name) {
    try {
      const bill_data = JSON.parse(bill_data_string);
      const spreadsheet = SpreadsheetApp.openById(spreadsheet_id);
      let sheet = spreadsheet.getSheetByName(tab_name);
      if (!sheet) {
        Logger.log(`The tab ${tab_name} doesn't exist.`)
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

      Logger.log("Data appended to sheet: " + tab_name);

    } catch (e) {
      Logger.log("Error: " + e.toString());
      Logger.log("Stack Trace: " + e.stack); // Add stack trace for better debugging
      throw e;
    }
  }
}











const Cartao = {
  findBill: function(bill_type, sender, subject , period, folder_id) {
    let threads = GmailApp.search(`from:${sender} subject:${subject} newer_than:${period}`);

    if (threads.length > 0) {
      var messages = threads[0].getMessages();
      var message = messages[messages.length - 1]; // Pega a última mensagem no thread
      
      Logger.log("Email encontrado em " + message.getDate() + "!");
      
      var attachments = message.getAttachments();
      var attachment = attachments[0]; // Pega o primeiro anexo
      var invoice = attachment.getName()
      
      Logger.log(`PDF ${invoice} encontrado!`);

      const folder = DriveApp.getFolderById(folder_id);
      let files_list = []
      files = folder.getFiles();
      while(files.hasNext()) {
        files_list.push(files.next().getName())
      }

      if (files_list.includes(invoice)) {
        Logger.log(`PDF ${invoice} já existe na pasta!`)
        return null;
      } else {
        if (attachment.getContentType() === 'application/pdf') {
            const file = folder.createFile(attachment);
            Logger.log(`Fatura salva como: ${invoice}`);
            return attachment;
        }
      }
    } else {
      Logger.log("Email não encontrado!")
      return null;
    }  
  }
}