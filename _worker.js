/**
 * 處理 Web App API 請求 (GET)。
 * 讀取指定工作表（預設為 'Breakfast'）的庫存數據和時間戳記。
 * * 假設：
 * - 庫存資料在 A 欄 (品名) 和 B 欄 (數量)，從第 2 行開始。
 * - 時間元件 (年, 月, 日, 時, 分, 秒) 位於 E2 到 E7 儲存格。
 */
function doGet(e) {
  const sheetName = e.parameter.sheetName || 'Breakfast';
  
  let updatedAt = null;
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      throw new Error(`找不到工作表 "${sheetName}"。`);
    }

    // --- 讀取時間戳記 ---
    try {
      const timeValues = sheet.getRange(2, 5, 6, 1).getValues().flat(); 
      const [year, month, day, hour, minute, second] = timeValues.map(v => Number(v) || 0);
      const pad = (num) => String(num).padStart(2, '0');
      updatedAt = `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}`;
    } catch (timeError) {
      Logger.log("讀取時間戳記時發生錯誤: " + timeError.message);
      updatedAt = null;
    }

    // --- 讀取庫存資料 ---
    const lastRow = sheet.getLastRow();
    let inventoryData = [];

    if (lastRow >= 2) {
      // 讀取 A:C 範圍 (品名, 數量, [暫不使用])，但最關鍵的是讀取 A, B 欄
      // 我們在數據中新增 'row' 屬性，用來指示前端更新時該寫入哪一行
      const range = sheet.getRange(2, 1, lastRow - 1, 2); 
      const values = range.getValues();
      
      inventoryData = values
        .filter(row => row[0]) // 濾除品名為空值的列
        .map((row, index) => ({
          // index + 2 是因為資料從第 2 行開始 (index 0 是第 2 行)
          row: index + 2, 
          name: String(row[0]).trim(),
          quantity: Number(row[1]) || 0
        }));
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      data: inventoryData,
      updated_at: updatedAt
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log("API 錯誤 (GET): " + error.message);
    return ContentService.createTextOutput(JSON.stringify({ 
      error: true, 
      message: error.message,
      updated_at: updatedAt
    })).setMimeType(ContentService.MimeType.JSON);
  }
}


/**
 * 處理 Web App API 請求 (POST)。
 * 接收 JSON 格式的 { sheetName, row, newQuantity } 進行庫存更新。
 */
function doPost(e) {
  let requestData;
  try {
    // 解析 JSON 請求體
    requestData = JSON.parse(e.postData.contents);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ 
      error: true, 
      message: "無法解析 JSON 請求體。"
    })).setMimeType(ContentService.MimeType.JSON);
  }

  const { sheetName, row, newQuantity } = requestData;

  // 驗證輸入
  if (!sheetName || !row || typeof newQuantity === 'undefined' || isNaN(newQuantity)) {
    return ContentService.createTextOutput(JSON.stringify({ 
      error: true, 
      message: "缺少必要的參數 (sheetName, row, newQuantity) 或格式不正確。"
    })).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      throw new Error(`找不到工作表 "${sheetName}"。`);
    }

    // 檢查行號是否在有效範圍內 (至少是第 2 行)
    if (row < 2 || row > sheet.getLastRow()) {
         throw new Error(`無效的行號 ${row}。`);
    }

    // 寫入新數量到 B 欄的指定行
    // range: (行, 列, 行數, 列數) -> 從指定行、第 2 欄開始，取 1 行、1 列
    sheet.getRange(row, 2).setValue(newQuantity);

    // 成功回傳
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: `工作表 ${sheetName} 的第 ${row} 行庫存已更新為 ${newQuantity}。`
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log("API 錯誤 (POST): " + error.message);
    return ContentService.createTextOutput(JSON.stringify({ 
      error: true, 
      message: error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
