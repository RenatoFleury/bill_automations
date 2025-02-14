function is_file_in_folder(file_name, folder_id) {
  var folder = DriveApp.getFolderById(folder_id);
  var files_list = []
  files = folder.getFiles();
  while(files.hasNext()) {
    files_list.push(files.next().getName())
  }
  return files_list.includes(file_name);
}

function append_data_to_spreadsheet(spreadsheet_id, tab_name, bill_data) {
  // Open the spreadsheet
  const spreadsheet = SpreadsheetApp.openById(spreadsheet_id);

  // Get the specific sheet by name
  const sheet = spreadsheet.getSheetByName(tab_name);
  if (!sheet) {
    Logger.log(`Sheet ${tab_name} does not exist.`);
  }
  
  // Find the last row with data
  const lastRow = sheet.getLastRow();

  // Calculate the range where the new data should be added
  const startRow = lastRow + 1; // Append below the last row
  const startColumn = 1; // Assuming data starts from the first column

  // Append the new data
  const dataKeys = ["year", "month", "bill_type", "value", "dead_line", "bar_code"];
  const data = dataKeys.map(key => bill_data[key]);
  let file_url = 'https://drive.google.com/file/d/' + bill_data.file_id + '/view';
  sheet.getRange(startRow, startColumn, 1, data.length).setValues([data]);
  sheet.getRange(startRow, startColumn + data.length).setFormula('=HYPERLINK("' + file_url + '"; "' + bill_data.file_name + '")');
  sheet.getRange(startRow, startColumn + data.length + 1).setValue("Pendente");
  Logger.log("Conta adicionada à planilha!")
}

function invoke_gc_function() {
  const env_data = JSON.parse(HtmlService.createHtmlOutputFromFile(".env.html").getContent());
  const CLOUD_RUN_URL = env_data["Google Cloud"]["CLOUD_RUN_URL"]
  
  // Use the OpenID token inside App Scripts
  const token = ScriptApp.getIdentityToken();
  var options = {
    'method' : 'get',
    'headers': {'Authorization': 'Bearer ' + token},
  };
  // call the server
  var response = UrlFetchApp.fetch(CLOUD_RUN_URL + '/unlock_pdf' + '?name=Renato', options);

  Logger.log(response)
}

function unlockPdf(attachment, password, file_name) {

  let blob = attachment.copyBlob(); // Get the attachment as a Blob
  let bytes = blob.getBytes();       // Get the binary data as bytes
  let pdfBase64 = Utilities.base64Encode(bytes); // Encode to base64

  const env_data = JSON.parse(HtmlService.createHtmlOutputFromFile(".env.html").getContent());
  const token = ScriptApp.getIdentityToken();
  const data = {
    pdf_base64: pdfBase64,
    password: password
  };
  const options = {
    'method': 'post',
    'headers': {'Authorization': 'Bearer ' + token},
    'contentType': 'application/json',
    'payload': JSON.stringify(data)
  };
  
  const url = env_data["Google Cloud"]["CLOUD_RUN_URL"]
  const response = UrlFetchApp.fetch(url + '/unlock_pdf', options);
  const jsonResponse = JSON.parse(response.getContentText());

  if (jsonResponse.error) {
    Logger.log('Error unlocking PDF: ' + jsonResponse.error);
    return null; // Or handle the error as needed
  } else {
    const unlockedPdfBase64 = jsonResponse.unlocked_pdf_base64;
    const decodedPdf = Utilities.base64Decode(unlockedPdfBase64);
    const blob_unlockedPdf = Utilities.newBlob(decodedPdf, "application/pdf", file_name);
    return blob_unlockedPdf;

  }
}

