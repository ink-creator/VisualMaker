// Local preview: node tests/serve.cjs
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
http.createServer((req, res) => {
  const filename = path.resolve(root, '.' + decodeURIComponent(req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0]));
  if (!filename.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
  fs.readFile(filename, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', ({'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png'})[path.extname(filename)] || 'application/octet-stream');
    res.end(data);
  });
}).listen(4173, '127.0.0.1', () => console.log('VisualMaker: http://127.0.0.1:4173'));
