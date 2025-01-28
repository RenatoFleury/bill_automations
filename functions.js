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
  Logger.log("Conta adicionada à planilha!")
}

// bill = {
//         "message" : message,
//         "year" : ref_year,
//         "month" : ref_month,
//         "bill_type" : bill_type,
//         "value" : value,
//         "dead_line" : dead_line,
//         "bar_code" : bar_code,
//         "file_name" : file_name,
//         "file_id" : file_id
//       };