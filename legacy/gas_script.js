// Google Apps Script (GAS) 用のコード
// スプレッドシートの「拡張機能」 ＞ 「Apps Script」を開き、このコードを貼り付けてください。
// その後、「デプロイ」 ＞ 「新しいデプロイ」 ＞ 種類の選択で「ウェブアプリ」を選び、
// 「アクセスできるユーザー」を「全員」にしてデプロイし、生成されたURLを控えてください。

function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var rows = [];
  
  for (var i = 1; i < data.length; i++) {
    var row = {};
    for (var j = 0; j < headers.length; j++) {
      row[headers[j]] = data[i][j];
    }
    rows.push(row);
  }
  
  return ContentService.createTextOutput(JSON.stringify(rows))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var params = JSON.parse(e.postData.contents);
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  
  // 「会社名」列を探す
  var companyColIndex = headers.indexOf("会社名");
  if (companyColIndex === -1) {
    return ContentService.createTextOutput(JSON.stringify({error: "会社名列が見つかりません"}))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  var companyName = params.companyName;
  var foundRowIndex = -1;
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][companyColIndex] === companyName) {
      foundRowIndex = i + 1; // 1から始まる行インデックス
      break;
    }
  }
  
  // 該当する会社名があれば更新、なければ新規行追加
  if (foundRowIndex === -1) {
    var newRow = new Array(headers.length).fill("");
    newRow[companyColIndex] = companyName;
    
    // 他のパラメータをマッピング
    mapParamsToRow(newRow, headers, params);
    sheet.appendRow(newRow);
  } else {
    // 既存行の更新
    for (var key in params) {
      var colIdx = headers.indexOf(key === "status" ? "対応ステータス" : 
                                   key === "nextAction" ? "次回アクション(対応メモ）" : 
                                   key === "assignee" ? "面談担当者" : 
                                   key === "notes" ? "備考" : key);
      if (colIdx !== -1) {
        sheet.getRange(foundRowIndex, colIdx + 1).setValue(params[key]);
      }
    }
  }
  
  return ContentService.createTextOutput(JSON.stringify({status: "success", foundRowIndex: foundRowIndex}))
    .setMimeType(ContentService.MimeType.JSON);
}

function mapParamsToRow(rowArray, headers, params) {
  var mapping = {
    "status": "対応ステータス",
    "nextAction": "次回アクション(対応メモ）",
    "assignee": "面談担当者",
    "notes": "備考"
  };
  
  for (var key in params) {
    var targetHeader = mapping[key] || key;
    var colIdx = headers.indexOf(targetHeader);
    if (colIdx !== -1) {
      rowArray[colIdx] = params[key];
    }
  }
}
