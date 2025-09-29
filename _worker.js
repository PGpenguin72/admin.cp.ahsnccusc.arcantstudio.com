// @ts-check

/**
 * 處理所有 Web 請求。
 * 1. 處理根路徑 / 請求 (回傳主頁面 HTML)。
 * 2. 處理 /api/inventory 請求 (Apps Script API Proxy)。
 * * NOTE: 我們假設主頁面檔案 index_admin.html 的內容可透過全局變數 __files 存取。
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // --- 1. 靜態檔案服務邏輯: 處理根路徑 / 或主頁面檔案請求 ---
    if (url.pathname === '/' || url.pathname.endsWith('/index.html')) {
        
        // 檢查環境是否提供了主頁面檔案的內容 (我們使用的是上一步生成的 index_admin.html)
        // 假定環境透過 __files 物件存取靜態檔案內容
        if (typeof __files !== 'undefined' && __files['index_admin.html']) {
             return new Response(__files['index_admin.html'], { 
                headers: { 'Content-Type': 'text/html' } // 確保設定正確的 Content-Type
             });
        } else {
            // 如果無法存取檔案內容
             return new Response('主頁面 HTML 檔案 (index_admin.html) 載入失敗，請確認檔案名稱和部署狀態。', { status: 500 });
        }
    }
    
    // --- 2. API PROXY 邏輯: 處理 /api/inventory 路徑 (GET/POST) ---
    if (url.pathname.startsWith('/api/inventory')) {
      const method = request.method;
      
      const secretApiUrl = env.SS_API_URL;
      if (!secretApiUrl) {
        return new Response('API URL not configured', { status: 500 });
      }
      
      let actualUrl = secretApiUrl;
      let requestBody = null;

      // 處理 GET/POST 請求的參數和主體
      if (method === 'GET') {
        // 從瀏覽器請求中獲取 sheetName 查詢參數
        const sheetName = url.searchParams.get('sheetName');
        if (!sheetName) {
          // GET 請求必須要有 sheetName
          return new Response('Missing sheetName parameter', { status: 400 });
        }
        // 在伺服器端建立真正的請求 URL
        actualUrl = `${secretApiUrl}?sheetName=${sheetName}`;
      } else if (method === 'POST') {
        try {
            // 讀取請求主體，POST 請求不需要 URL 參數
            requestBody = await request.text();
        } catch(e) {
             return new Response('Invalid POST body', { status: 400 });
        }
      } else if (method === 'OPTIONS') {
           // 處理 OPTIONS 預檢請求 (CORS)
            return new Response(null, {
                status: 204, 
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

      // 發起實際的 Apps Script 請求
      try {
        const fetchOptions = {
            method: method,
            headers: request.headers,
        };

        if (method === 'POST' && requestBody) {
            fetchOptions.headers = new Headers(request.headers);
            fetchOptions.body = requestBody;
            // 移除 Content-Length 避免 Cloudflare Worker 報錯
            fetchOptions.headers.delete('Content-Length'); 
        }

        const response = await fetch(actualUrl, fetchOptions);
        
        // 複製 Apps Script 的回應並設定 CORS
        const responseHeaders = new Headers(response.headers);
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

    // --- 3. 處理其他未匹配路徑 ---
    return new Response('404 Not Found: 找不到資源', { status: 404 });
  }
}
