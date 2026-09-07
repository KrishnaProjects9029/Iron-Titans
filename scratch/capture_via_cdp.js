const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const crypto = require('crypto');

const PORT = 8099;
const CDP_PORT = 9230;
const ROOT = path.resolve(__dirname, '..');
const ARTIFACT_DIR = 'C:\\Users\\admin\\.gemini\\antigravity\\brain\\5f4bdba8-5fc3-4788-a765-1a4936f9961c';

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

const PRESETS = {
  first_launch: `
    document.getElementById('modal-first-launch').style.display = 'flex';
  `,
  settings: `
    document.querySelectorAll('.ui-screen').forEach(el => el.style.display = 'none');
    const s = document.getElementById('screen-settings');
    if (s) {
      s.style.display = 'flex';
      const sc = s.querySelector('.settings-container');
      if (sc) sc.scrollTop = 9999;
    }
  `,
  offline: `
    const pill = document.getElementById('net-status-pill');
    const text = document.getElementById('net-status-text');
    const ping = document.getElementById('net-ping-display');
    if (pill) pill.className = 'net-status-pill net-offline';
    if (text) text.textContent = 'OFFLINE';
    if (ping) ping.style.display = 'none';

    const toast = document.getElementById('notification-toast-container');
    if (toast) {
      toast.innerHTML = '<div class="notification-toast"><span class="toast-icon">📶</span><div class="toast-content"><div class="toast-title">OFFLINE MODE</div><div class="toast-message">Operating offline. Local combat & missions active.</div></div></div>';
    }
  `,
  combat: `
    document.querySelectorAll('.ui-screen').forEach(el => el.style.display = 'none');
    const b = document.getElementById('screen-battle');
    if (b) b.style.display = 'block';
    const topBar = document.getElementById('hud-top-bar');
    if (topBar) topBar.style.display = 'flex';
    const ps = document.getElementById('hud-player-status');
    if (ps) ps.style.display = 'flex';
    const jz = document.getElementById('joystick-zone');
    if (jz) jz.style.display = 'block';
    const tap = document.getElementById('touch-action-panel');
    if (tap) tap.style.display = 'flex';
    const ch = document.getElementById('hud-crosshair-wrap');
    if (ch) ch.style.display = 'block';
  `
};

server.listen(PORT, async () => {
  const arg2 = process.argv[2] || '';
  let targetRoute = '';
  let evalSnippet = process.argv[5] || '';

  if (arg2.startsWith('preset:')) {
    const pName = arg2.replace('preset:', '');
    evalSnippet = PRESETS[pName] || '';
  } else if (arg2 !== '-') {
    targetRoute = arg2;
  }

  const outFilename = process.argv[3] || 'phase8_missions_screen.png';
  const waitMs = parseInt(process.argv[4] || '2000', 10);

  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const localOut = path.join(__dirname, outFilename);
  const artifactOut = path.join(ARTIFACT_DIR, outFilename);

  const targetUrl = `http://localhost:${PORT}/index.html${targetRoute}`;
  console.log(`Starting headless Edge for ${targetUrl} -> ${outFilename} (wait ${waitMs}ms)...`);

  const edge = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    '--disable-gpu',
    '--window-size=1280,720',
    targetUrl
  ]);

  setTimeout(async () => {
    try {
      let page = null;
      for (let attempt = 0; attempt < 8; attempt++) {
        try {
          const res = await fetch(`http://localhost:${CDP_PORT}/json`);
          const targets = await res.json();
          page = targets.find(t => t.type === 'page');
          if (page) break;
        } catch (e) {
          await new Promise(r => setTimeout(r, 400));
        }
      }
      if (!page) {
        console.error('No page target found after retries');
        cleanup();
        return;
      }

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

      req.on('upgrade', (res, socket) => {
        let msgId = 1;

        function sendCdp(method, params = {}) {
          const id = msgId++;
          const payload = Buffer.from(JSON.stringify({ id, method, params }));
          let header;
          if (payload.length < 126) {
            header = Buffer.alloc(6);
            header[0] = 0x81;
            header[1] = 0x80 | payload.length;
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
          return id;
        }

        let buffer = Buffer.alloc(0);
        let captureId = -1;

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
              if (msg.result && msg.result.exceptionDetails) {
                console.error('CDP Eval Exception:', JSON.stringify(msg.result.exceptionDetails));
              }
              if (msg.method === 'Runtime.consoleAPICalled') {
                console.log('[BrowserConsole]', msg.params.args.map(a => a.value || a.description || '').join(' '));
              }
              if (msg.id === captureId && msg.result && msg.result.data) {
                const imgBuf = Buffer.from(msg.result.data, 'base64');
                fs.writeFileSync(localOut, imgBuf);
                fs.writeFileSync(artifactOut, imgBuf);
                console.log(`✔ Captured screenshot successfully (${imgBuf.length} bytes): ${outFilename}`);
                socket.end();
                cleanup();
              }
            } catch (e) {
              console.error('JSON parse err:', e);
            }
          }
        });

        sendCdp('Page.enable', {});
        sendCdp('Runtime.enable', {});

        setTimeout(() => {
          if (evalSnippet) {
            console.log('Evaluating snippet:', evalSnippet);
            sendCdp('Runtime.evaluate', { expression: evalSnippet });
          }

          setTimeout(() => {
            console.log('Capturing screenshot...');
            captureId = sendCdp('Page.captureScreenshot', { format: 'png' });
          }, waitMs);
        }, 3000);
      });

      req.end();
    } catch (e) {
      console.error('CDP capture error:', e.message);
      cleanup();
    }
  }, 1000);

  function cleanup() {
    try { edge.kill(); } catch (e) {}
    try { server.close(); } catch (e) {}
    process.exit(0);
  }
});
