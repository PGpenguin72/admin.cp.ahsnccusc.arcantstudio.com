// _worker10.js - 使用代理模式存取 Google Apps Script API

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. 如果請求路徑是 /api/inventory，就觸發代理邏輯
    if (url.pathname.startsWith('/api/inventory')) {
      // 解析 query string 或 POST body
      let sheetName = url.searchParams.get('sheetName');

      // 如果是 POST，則讀取 body
      let requestBody = null;
      if (request.method === 'POST') {
        try {
          requestBody = await request.json();
          sheetName = sheetName || requestBody.sheetName;
        } catch (err) {
          return new Response('Invalid JSON body', { status: 400 });
        }
      }

      if (!sheetName) {
        return new Response('Missing sheetName parameter', { status: 400 });
      }

      // 從環境變數中讀取秘密的 Google Apps Script Web App URL
      const secretApiUrl = env.SS_API_URL;
      if (!secretApiUrl) {
        return new Response('API URL not configured', { status: 500 });
      }

      try {
        let actualUrl = `${secretApiUrl}?sheetName=${encodeURIComponent(sheetName)}`;
        let fetchOptions = { method: request.method };

        if (request.method === 'POST') {
          fetchOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
          };
        }

        // 代理請求到 Google Apps Script
        const response = await fetch(actualUrl, fetchOptions);
        const data = await response.json();

        return new Response(JSON.stringify(data), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*', // 可改成你的網域
          },
        });
      } catch (error) {
        return new Response(`Error fetching data: ${error.message}`, { status: 502 });
      }
    }

    // 2. 其他請求 => 靜態資源
    return env.ASSETS.fetch(request);
  },
};
