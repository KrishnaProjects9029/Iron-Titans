const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const crypto = require('crypto');

const PORT = 8098;
const CDP_PORT = 9229;
const ROOT = path.resolve(__dirname, '..');

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
  const filePath = path.join(ROOT, reqPath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not found: ' + reqPath);
  }
});

server.listen(PORT, async () => {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const edge = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    '--disable-gpu',
    `http://localhost:${PORT}/index.html#missions`
  ]);

  setTimeout(async () => {
    try {
      const res = await fetch(`http://localhost:${CDP_PORT}/json`);
      const targets = await res.json();
      const page = targets.find(t => t.type === 'page' && t.url.includes(PORT.toString()));
      if (!page) {
        console.log('No page target found');
        return;
      }
      console.log('Connecting to ws:', page.webSocketDebuggerUrl);

      // Connect raw WebSocket to CDP
      const wsUrl = new URL(page.webSocketDebuggerUrl);
      const req = http.request({
        host: wsUrl.hostname,
        port: wsUrl.port,
        path: wsUrl.pathname,
        headers: {
          'Connection': 'Upgrade',
          'Upgrade': 'websocket',
          'Sec-WebSocket-Key': crypto.randomBytes(16).toString('base64'),
          'Sec-WebSocket-Version': '13'
        }
      });

      req.on('upgrade', (res, socket, upgradeHead) => {
        console.log('WebSocket connection upgraded to CDP');

        function sendCdp(method, params = {}, id = 1) {
          const payload = Buffer.from(JSON.stringify({ id, method, params }));
          let header;
          if (payload.length < 126) {
            header = Buffer.alloc(6);
            header[0] = 0x81; // FIN + text
            header[1] = 0x80 | payload.length; // MASK
            crypto.randomBytes(4).copy(header, 2);
          } else {
            header = Buffer.alloc(8);
            header[0] = 0x81;
            header[1] = 0x80 | 126;
            header.writeUInt16BE(payload.length, 2);
            crypto.randomBytes(4).copy(header, 4);
          }
          const mask = header.slice(header.length - 4);
          const masked = Buffer.alloc(payload.length);
          for (let i = 0; i < payload.length; i++) {
            masked[i] = payload[i] ^ mask[i % 4];
          }
          socket.write(Buffer.concat([header, masked]));
        }

        let buffer = Buffer.alloc(0);
        socket.on('data', (chunk) => {
          buffer = Buffer.concat([buffer, chunk]);
          while (buffer.length >= 2) {
            const secondByte = buffer[1];
            let payloadLen = secondByte & 0x7f;
            let offset = 2;
            if (payloadLen === 126) {
              if (buffer.length < 4) break;
              payloadLen = buffer.readUInt16BE(2);
              offset = 4;
            } else if (payloadLen === 127) {
              if (buffer.length < 10) break;
              payloadLen = Number(buffer.readBigUInt64BE(2));
              offset = 10;
            }
            if (buffer.length < offset + payloadLen) break;
            const payload = buffer.slice(offset, offset + payloadLen);
            buffer = buffer.slice(offset + payloadLen);

            try {
              const msg = JSON.parse(payload.toString('utf8'));
              if (msg.method === 'Runtime.consoleAPICalled') {
                console.log('[BROWSER CONSOLE]', msg.params.type, msg.params.args.map(a => a.value || a.description));
              } else if (msg.method === 'Runtime.exceptionThrown') {
                console.error('[BROWSER EXCEPTION]', msg.params.exceptionDetails);
              } else if (msg.id === 10) {
                const val = (msg.result && msg.result.result) ? msg.result.result.value : msg.result;
                console.log('[SCREEN RESULT]\n', JSON.stringify(val, null, 2));
              }
            } catch (e) {
              console.error('CDP parse err:', e);
            }
          }
        });

        // Enable Console & Runtime
        sendCdp('Runtime.enable', {}, 1);
        sendCdp('Log.enable', {}, 2);

        // Evaluate active screen and visible elements
        setTimeout(() => {
          sendCdp('Runtime.evaluate', {
            expression: `(() => {
              const el = document.getElementById('screen-missions');
              if (!el) return { error: 'screen-missions not found' };
              const r = el.getBoundingClientRect();
              const cs = window.getComputedStyle(el);
              const header = el.querySelector('.screen-header');
              const tabs = el.querySelector('.missions-tab-bar');
              const grid = el.querySelector('.missions-grid');

              return {
                missions: {
                  display: cs.display,
                  visibility: cs.visibility,
                  opacity: cs.opacity,
                  zIndex: cs.zIndex,
                  rect: { x: r.x, y: r.y, w: r.width, h: r.height }
                },
                header: header ? {
                  display: window.getComputedStyle(header).display,
                  rect: header.getBoundingClientRect()
                } : null,
                tabs: tabs ? {
                  display: window.getComputedStyle(tabs).display,
                  rect: tabs.getBoundingClientRect()
                } : null,
                grid: grid ? {
                  display: window.getComputedStyle(grid).display,
                  children: grid.children.length,
                  rect: grid.getBoundingClientRect()
                } : null
              };
            })()`,
            returnByValue: true
          }, 10);
        }, 800);

        setTimeout(() => {
          socket.end();
          edge.kill();
          server.close();
          process.exit(0);
        }, 5000);
      });

      req.end();
    } catch (e) {
      console.error('Err:', e.message);
      edge.kill();
      server.close();
      process.exit(0);
    }
  }, 2000);
});
