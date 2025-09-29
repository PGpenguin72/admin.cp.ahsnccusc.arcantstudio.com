// _worker.js - 修正後的代理工作者邏輯
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. 如果請求路徑是 /api/inventory，就觸發代理邏輯
    if (url.pathname.startsWith('/api/inventory')) {
      const method = request.method;
      
      // 從環境變數中讀取秘密的 Google Apps Script URL
      const secretApiUrl = env.SS_API_URL;
      if (!secretApiUrl) {
        return new Response('API URL not configured', { status: 500 });
      }
      
      let actualUrl = secretApiUrl;
      let requestBody = null;

      // --- 處理 GET 請求 (讀取資料) ---
      if (method === 'GET') {
        // 從瀏覽器請求中獲取 sheetName 查詢參數
        const sheetName = url.searchParams.get('sheetName');
        if (!sheetName) {
          // 只有 GET 請求必須要有 sheetName
          return new Response('Missing sheetName parameter', { status: 400 });
        }
        // 在伺服器端建立真正的請求 URL，將 sheetName 作為 Apps Script 的查詢參數
        actualUrl = `${secretApiUrl}?sheetName=${sheetName}`;
      
      // --- 處理 POST 請求 (寫入資料) ---
      } else if (method === 'POST') {
        // POST 請求不檢查 URL 上的 sheetName，因為它在 body 裡
        // 只需要複製原始的 body 和 headers 到新的請求中
        try {
            // 讀取請求體
            requestBody = await request.text();
            // Apps Script 的 doPost 會處理 body，所以 actualUrl 保持為 secretApiUrl (不帶參數)
        } catch(e) {
             return new Response('Invalid POST body', { status: 400 });
        }
      } else if (method === 'OPTIONS') {
           // 處理 OPTIONS 預檢請求 (由瀏覽器自動發送)
            return new Response(null, {
                status: 204, // No Content
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Max-Age': '86400',
                },
            });
      } else {
          // 處理不允許的方法
          return new Response('Method Not Allowed', { status: 405 });
      }

      // 在伺服器端發起 fetch，去跟 Google Apps Script 要資料
      try {
        const fetchOptions = {
            method: method,
            headers: request.headers,
        };

        if (method === 'POST' && requestBody) {
            // 確保 Content-Type 標頭被保留
            fetchOptions.headers = new Headers(request.headers);
            fetchOptions.body = requestBody;
        }

        const response = await fetch(actualUrl, fetchOptions);
        
        // 複製 Google Apps Script 的回應
        const responseHeaders = new Headers(response.headers);
        // 設定 CORS，確保瀏覽器能正常接收
        responseHeaders.set('Access-Control-Allow-Origin', '*'); 

        const responseBody = await response.text(); 

        return new Response(responseBody, {
          status: response.status,
          headers: responseHeaders,
        });

      } catch (error) {
        return new Response(`Proxy Fetch Error: ${error.message}`, { status: 500 });
      }
    }

    // 2. 如果不是 API 請求，回傳靜態資源 (在 Canvas 環境中通常回傳 404 或處理靜態文件)
    return new Response('Not Found', { status: 404 });
  }
}
