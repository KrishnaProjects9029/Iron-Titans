const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 8089;
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
  if (reqPath === '/' || reqPath === '' || reqPath === '//') reqPath = '/index.html';
  const filePath = path.join(ROOT, reqPath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found: ' + reqPath);
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  const targetHash = process.argv[2] || '#arenas';
  const imageName = process.argv[3] || 'phase5_arenas_screen.png';
  const timeBudget = process.argv[4] || '1400';
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const screenshotPath = path.join(__dirname, imageName);
  const artifactPath = path.join(ARTIFACT_DIR, imageName);

  const targetUrl = `http://localhost:${PORT}/index.html${targetHash}`;
  console.log(`Launching headless Edge to capture ${targetUrl} as ${imageName} (budget ${timeBudget}ms)...`);
  const edge = spawn(edgePath, [
    '--headless=new',
    '--disable-gpu',
    `--screenshot=${screenshotPath}`,
    '--window-size=1280,720',
    `--virtual-time-budget=${timeBudget}`,
    targetUrl
  ]);

  edge.on('close', (code) => {
    console.log(`Edge finished with code ${code}`);
    if (fs.existsSync(screenshotPath)) {
      const stats = fs.statSync(screenshotPath);
      console.log(`Screenshot saved successfully (${stats.size} bytes): ${screenshotPath}`);
      fs.copyFileSync(screenshotPath, artifactPath);
      console.log(`Copied screenshot to artifacts: ${artifactPath}`);
    } else {
      console.log('No screenshot file produced');
    }
    server.close(() => {
      console.log('Server shut down cleanly.');
      process.exit(0);
    });
  });
});
