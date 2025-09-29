// _worker.js - 更新後的代理模式
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. 如果請求路徑是 /api/inventory，就觸發代理邏輯
    if (url.pathname.startsWith('/api/inventory')) {
      // 從瀏覽器請求中獲取 sheetName 查詢參數
      const sheetName = url.searchParams.get('sheetName');
      if (!sheetName) {
        return new Response('Missing sheetName parameter', { status: 400 });
      }

      // 從環境變數中讀取秘密的 Google Apps Script URL
      const secretApiUrl = env.SS_API_URL;
      if (!secretApiUrl) {
        return new Response('API URL not configured', { status: 500 });
      }

      // 在伺服器端建立真正的請求 URL
      const actualUrl = `${secretApiUrl}?sheetName=${sheetName}`;

      try {
        // 在伺服器端發起 fetch，去跟 Google Apps Script 要資料
        const response = await fetch(actualUrl);
        const data = await response.json(); // 假設 Google 回傳的是 JSON

        // 將從 Google 收到的資料回傳給瀏覽器
        // 加上 CORS 標頭，確保瀏覽器能正常接收
        return new Response(JSON.stringify(data), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*', // 允許所有來源，或更換成您的網域
          },
        });
      } catch (error) {
        return new Response(`Error fetching data: ${error.message}`, { status: 502 }); // 502 Bad Gateway
      }
    }

    // 2. 如果是其他請求 (例如載入網頁)，就回傳靜態檔案
    // 注意：我們不再需要替換 HTML 裡的任何佔位符了
    return env.ASSETS.fetch(request);
  }
};
