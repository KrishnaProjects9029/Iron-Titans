const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 8097;
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

server.listen(PORT, () => {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const edge = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9228',
    '--disable-gpu',
    `http://localhost:${PORT}/index.html#missions`
  ]);

  setTimeout(async () => {
    try {
      const res = await fetch('http://localhost:9228/json');
      const targets = await res.json();
      console.log('Targets found:', targets.length);
      const page = targets.find(t => t.type === 'page' && t.url.includes(PORT.toString()));
      if (page) console.log('Target page URL:', page.url);
    } catch(e) {
      console.log('Err:', e.message);
    } finally {
      edge.kill();
      server.close();
      process.exit(0);
    }
  }, 2500);
});
