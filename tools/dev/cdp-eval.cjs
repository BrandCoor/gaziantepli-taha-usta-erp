// Geliştirme aracı: çalışan Electron penceresinde (--remote-debugging-port) ifade değerlendirir.
const WebSocket = require('ws');
const http = require('http');
const port = process.env.CDP_PORT || 9333;
const exprs = process.argv.slice(2);
http.get(`http://127.0.0.1:${port}/json`, (res) => {
  let b = ''; res.on('data', (d) => (b += d)); res.on('end', () => {
    const page = JSON.parse(b).find((t) => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let id = 0; const pending = new Map();
    ws.on('message', (m) => { const r = JSON.parse(m); if (pending.has(r.id)) { pending.get(r.id)(r); pending.delete(r.id); } });
    const send = (method, params) => new Promise((ok) => { const i = ++id; pending.set(i, ok); ws.send(JSON.stringify({ id: i, method, params })); });
    ws.on('open', async () => {
      for (const e of exprs) {
        const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true });
        console.log(e.slice(0, 70).padEnd(72), '=>', JSON.stringify(r.result.result.value ?? r.result.exceptionDetails?.text));
      }
      ws.close(); process.exit(0);
    });
  });
});
