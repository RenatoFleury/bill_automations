function main() {
  const env_data = JSON.parse(HtmlService.createHtmlOutputFromFile(".env.html").getContent());
  let bill_type = "Aluguel";
  let sender = env_data[bill_type]["sender"];
  let subject = env_data[bill_type]["subject"];
  let period = env_data[bill_type]["period"];
  let folder_id = env_data[bill_type]["folder_id"];
  findBill(bill_type, sender, subject , period, folder_id);
}

function findBill(bill_type, sender, subject , period, folder_id) {
  let threads = GmailApp.search(`from:${sender} subject:${subject} newer_than:${period}`);

  if (threads.length > 0) {
    let messages = threads[0].getMessages();
    let message = messages[messages.length - 1]; // Pega a última mensagem no thread
    
    Logger.log("Email encontrado em " + message.getDate() + "!");
    
    let ref_month = message.getDate().getMonth() + 1;
    let ref_year = message.getDate().getFullYear();
    let value = get_value(message.getPlainBody());
    let dead_line = get_dead_line(message.getPlainBody()); // DD/MM/YYYY
    let bar_code = get_bar_code(message.getPlainBody());
    let file_name = `${ref_year}_${ref_month}_Boleto_${bill_type}.pdf`;

    Logger.log("File_name: " + file_name);

    if (!is_file_in_folder(file_name, folder_id)) {
      let attachments = message.getAttachments();
      if (attachments.length !== 0) {
        for (let attachment of attachments) {
          if (attachment.getContentType() === 'application/pdf') { // Pega o primeiro pdf em anexo
            attachment.setName(file_name);
            let folder = DriveApp.getFolderById(folder_id);
            folder.createFile(attachment);
            break
          }
        }
      } else if (bill_type === "Aluguel") {
        let file_link = get_file_link(message.getBody());
        let response = UrlFetchApp.fetch(file_link);
        let blob = response.getBlob();
        let folder = DriveApp.getFolderById(folder_id);
        folder.createFile(blob.setName(file_name));
      }
    } else {
      Logger.log(`PDF ${file_name} já existe na pasta!`)
    }
    
  } else {
    Logger.log("Email não encontrado!")
  }  
}

function get_value(plainBody) {
  let regex = /^Valor:.*$/gm;
  let matches = plainBody.match(regex);
  let match = matches ? matches[0] : null;
  let value = match ? Number(match.replace("Valor:", "").replace(/\s+/g, "").replaceAll(".", "").replace(",", ".")) : null;
  Logger.log("Value: " + value)
  return value;
}

function get_dead_line(plainBody) {
  let regex = /^Vencimento:.*$/gm;
  let matches = plainBody.match(regex);
  let match = matches ? matches[0] : null;
  let date = match ? match.replaceAll("Vencimento:", "").replaceAll(" ", "") : null ;
  Logger.log("Deadline: " + date)
  return date;
}

function get_bar_code(plainBody) {
  let regex = /^\d*\s$/gm;
  let matches = plainBody.match(regex);
  let match = matches ? matches[0] : null;
  let bar_code = match ? match.replace(/\s+/g, "") : null;
  Logger.log("Bar_code: " + bar_code)
  return bar_code;
}

function is_file_in_folder(file_name, folder_id) {
  var folder = DriveApp.getFolderById(folder_id);
  var files_list = []
  files = folder.getFiles();
  while(files.hasNext()) {
    files_list.push(files.next().getName())
  }
  return files_list.includes(file_name);
}

function get_file_link(body) {
  let regex = /href="([^"]+)"\starget/;
  let results = body.match(regex);
  let result_group = results ? results[1] : null;
  Logger.log("File_link: " + result_group);
  return result_group;
}