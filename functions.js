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


function getFileByNameInFolder(fileName, folderId) {
  try {
    const folder = DriveApp.getFolderById(folderId);
    const searchQuery = `title = '${fileName}' and '${folderId}' in parents and trashed = false`;
    const files = folder.searchFiles(searchQuery);
    if (files.hasNext()) {
      return files.next();
    } else {
      return null;
    }
  } catch (e) {
    Logger.log("Error: " + e.toString());
    return null; // Return null in case of an error.
  }
}

function call_gemini(query, data_mime_type, data_base64, generationConfig) {
  const env_data = JSON.parse(HtmlService.createHtmlOutputFromFile(".env.html").getContent());
  const base_url = env_data["Google Cloud"]["GEMINI_URL"];
  const api_key = env_data["Google Cloud"]["GEMINI_API_KEY"];
  const model = "/gemini-2.0-flash";
  const url = base_url + model + ":generateContent" + "?key=" + api_key;

  const payload = {
    "contents": [{
      "parts":[
        {"text": query},{
        "inline_data": {
          "mime_type": data_mime_type,
          "data": data_base64
        }
      }
        ]
    }],
    "generationConfig": generationConfig
  };

  const options = {
    'method': 'post',
    'contentType': 'application/json',
    // Convert the JavaScript object to a JSON string
    'payload': JSON.stringify(payload),
    'muteHttpExceptions': true // Important for error handling
  };

  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();

  // Parse the JSON response (if the response code is successful)
  if (responseCode >= 200 && responseCode < 300) {
    const jsonResponse = JSON.parse(responseText);
    const response = jsonResponse.candidates[0].content.parts[0].text
    return response
  } else {
    Logger.log("Error: API request failed. Check the response code and text for details.");
    Logger.log("Response Code: " + responseCode);
    Logger.log("Response Text: " + responseText)
    return null
  }
}

function test_gemini_with_file() {
  const env_data = JSON.parse(HtmlService.createHtmlOutputFromFile(".env.html").getContent());
  const folder_id = env_data["Cartao"]["folder_id"];
  const file_name = "Nubank_2025-02-08.pdf";

  const file = getFileByNameInFolder(file_name, folder_id);
  const bytes = file.getBlob().getBytes();
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
  const response = call_gemini(query, data_mime_type, data_base64, generationConfig);
  Logger.log(`Response : ${response}`);
  return response
}