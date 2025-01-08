function mainGas() {
  const env_data = JSON.parse(HtmlService.createHtmlOutputFromFile(".env.html").getContent());
  let bill_type = "Gas";
  let sender = env_data[bill_type]["sender"];
  let subject = env_data[bill_type]["subject"];
  let period = env_data[bill_type]["period"];
  let folder_id = env_data[bill_type]["folder_id"];
  findBill(bill_type, sender, subject , period, folder_id);
}

function findBill(bill_type, sender, subject , period, folder_id) {
  var threads = GmailApp.search(`from:${sender} subject:${subject} newer_than:${period}`);

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

    if (!is_file_in_folder(file_name, folder_id)) {
      let attachments = message.getAttachments();
      for (let attachment of attachments) {
        if (attachment.getContentType() === 'application/pdf') {
          attachment.setName(file_name);
          let folder = DriveApp.getFolderById(folder_id);
          folder.createFile(attachment);
          break
        }
      }
    } else {
      Logger.log(`PDF ${file_name} já existe na pasta!`)
    }
    
  } else {
    Logger.log("Email não encontrado!")
  }  
}

function get_value(plainBody) {
  let regex = /R\$\s\d*,\d*/gm;
  let matches = plainBody.match(regex);
  let match = matches ? matches[0] : null;
  let value = match ? Number(match.replace("R$", "").replace(/\s+/g, "").replace(",", ".")) : null;
  Logger.log("Value: " + value)
  return value;
}

function get_dead_line(plainBody) {
  
  let regex = /\d{2}\.\d{2}\.\d{4}/gm;
  let matches = plainBody.match(regex);
  let match = matches ? matches[0] : null;
  let date = match ? match.replace(".", "/") : null ;
  Logger.log("Date: " + date)
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