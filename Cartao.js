function mainCartao() {
  const env_data = JSON.parse(HtmlService.createHtmlOutputFromFile(".env.html").getContent());
  let bill_type = "Cartao";
  let sender = env_data[bill_type]["sender"];
  let subject = env_data[bill_type]["subject"];
  let period = env_data[bill_type]["period"];
  let folder_id = env_data[bill_type]["folder_id"];
  Cartao.findBill(bill_type, sender, subject , period, folder_id);
}

const Cartao = {
  findBill: function(bill_type, sender, subject , period, folder_id) {
    var threads = GmailApp.search(`from:${sender} subject:${subject} newer_than:${period}`);

    if (threads.length > 0) {
      var messages = threads[0].getMessages();
      var message = messages[messages.length - 1]; // Pega a última mensagem no thread
      
      Logger.log("Email encontrado em " + message.getDate() + "!");
      Logger.log(message.getPlainBody())
      
      var attachments = message.getAttachments();
      var attachment = attachments[0]; // Pega o primeiro anexo
      var invoice = attachment.getName()
      
      Logger.log(`PDF ${invoice} encontrado!`);

      var folder = DriveApp.getFolderById(folder_id);
      var files_list = []
      files = folder.getFiles();
      while(files.hasNext()) {
        files_list.push(files.next().getName())
      }

      if (files_list.includes(invoice)) {
        Logger.log(`PDF ${invoice} já existe na pasta!`)
      } else {
        if (attachment.getContentType() === 'application/pdf') {
            var file = folder.createFile(attachment);
            Logger.log(`Fatura salva como: ${invoice}`);
        }
      }
    } else {
      Logger.log("Email não encontrado!")
    }  
  }
}