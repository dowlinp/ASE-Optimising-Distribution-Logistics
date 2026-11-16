// Dependency-free local preview. Production continues to use the existing Java app.
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const routes = {
  '/': ['home/home.html', 'text/html'],
  '/Warehouse': ['warehouse/warehouse.html', 'text/html'],
  '/User': ['frontend/frontend.html', 'text/html'],
  '/Delivery': ['delivery/delivery.html', 'text/html'],
  '/Account': ['home/account.html', 'text/html'],
  '/css/warehouse.css': ['css/warehouse.css', 'text/css'],
  '/warehouse-assets/demo-data.js': ['warehouse/demo-data.js', 'text/javascript'],
  '/warehouse-assets/warehouse.js': ['warehouse/warehouse.js', 'text/javascript']
};
const server = http.createServer(async (request, response) => {
  const route = routes[new URL(request.url, 'http://localhost').pathname];
  if (!route) { response.writeHead(404).end('Not found'); return; }
  try {
    const body = await fs.readFile(path.join(root, route[0]));
    response.writeHead(200, { 'Content-Type': `${route[1]}; charset=utf-8`, 'Cache-Control': 'no-store' }).end(body);
  } catch {
    response.writeHead(500).end('Unable to read preview file');
  }
});
server.listen(5050, '127.0.0.1', () => console.log('Warehouse preview: http://127.0.0.1:5050/Warehouse'));
