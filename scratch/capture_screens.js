/**
 * Synchronous Screenshot Capture Tool for Iron Titans
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT = 8096;
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
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`Capture server active on http://localhost:${PORT}`);

  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

  const targets = [
    { hash: '#arenas', filename: 'phase5_arenas_screen.png' },
    { hash: '#career', filename: 'phase5_career_screen.png' }
  ];

  for (const t of targets) {
    const localOut = path.join(__dirname, t.filename);
    const artifactOut = path.join(ARTIFACT_DIR, t.filename);

    console.log(`Capturing ${t.hash} -> ${t.filename}...`);
    const cmd = `"${edgePath}" --headless=new --disable-gpu --screenshot="${localOut}" --window-size=1280,720 --virtual-time-budget=2500 "http://localhost:${PORT}/${t.hash}"`;

    try {
      execSync(cmd, { timeout: 20000, stdio: 'ignore' });
      if (fs.existsSync(localOut)) {
        fs.copyFileSync(localOut, artifactOut);
        console.log(`✔ Successfully captured and copied ${t.filename}`);
      } else {
        console.log(`✖ File not created for ${t.filename}`);
      }
    } catch (err) {
      console.log(`Error capturing ${t.filename}:`, err.message);
    }
  }

  server.close(() => {
    console.log('Capture server shut down.');
    process.exit(0);
  });
});
