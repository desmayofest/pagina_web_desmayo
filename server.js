const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT) || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'Lluc2026';
const ROOT_DIR = __dirname;
const IMAGES_DIR = path.join(ROOT_DIR, 'imagenes');
const ALBUMS_FILE = path.join(IMAGES_DIR, 'albumes.json');
const MAX_UPLOAD_SIZE = 60 * 1024 * 1024;
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

fs.mkdirSync(IMAGES_DIR, { recursive: true });

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type, x-admin-key',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
  };
}

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, {
    'content-type': MIME_TYPES['.json'],
    ...corsHeaders(),
  });
  response.end(JSON.stringify(data));
}

function slugify(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function sanitizeFilename(filename) {
  const extension = path.extname(filename).toLowerCase();
  const basename = slugify(path.basename(filename, extension)) || 'foto';
  return `${Date.now()}-${crypto.randomUUID()}-${basename}${extension}`;
}

function readAlbumsMeta() {
  try {
    return JSON.parse(fs.readFileSync(ALBUMS_FILE, 'utf8'));
  } catch (error) {
    return [];
  }
}

function writeAlbumsMeta(albums) {
  fs.writeFileSync(ALBUMS_FILE, JSON.stringify(albums, null, 2));
}

function getAlbumImages(albumId) {
  const albumDir = path.join(IMAGES_DIR, albumId);
  if (!fs.existsSync(albumDir)) return [];

  return fs
    .readdirSync(albumDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => ({
      name: entry.name,
      url: `/imagenes/${encodeURIComponent(albumId)}/${encodeURIComponent(entry.name)}`,
      modified: fs.statSync(path.join(albumDir, entry.name)).mtimeMs,
    }))
    .sort((a, b) => b.modified - a.modified)
    .map(({ name, url }) => ({ name, url }));
}

function listAlbums(response) {
  const meta = readAlbumsMeta();
  const albums = meta
    .filter((album) => album.id && fs.existsSync(path.join(IMAGES_DIR, album.id)))
    .map((album) => {
      const images = getAlbumImages(album.id);
      return {
        id: album.id,
        name: album.name,
        description: album.description || '',
        count: images.length,
        coverUrl: images[0]?.url || '',
        createdAt: album.createdAt || 0,
      };
    })
    .sort((a, b) => b.createdAt - a.createdAt);

  sendJson(response, 200, albums);
}

function listAlbumImages(response, albumId) {
  const album = readAlbumsMeta().find((item) => item.id === albumId);
  if (!album) {
    sendJson(response, 404, { error: 'Album no encontrado.' });
    return;
  }

  sendJson(response, 200, {
    id: album.id,
    name: album.name,
    description: album.description || '',
    images: getAlbumImages(album.id),
  });
}

function serveFile(response, filePath) {
  const resolvedPath = path.resolve(filePath);
  if (!resolvedPath.startsWith(ROOT_DIR)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  fs.readFile(resolvedPath, (error, content) => {
    if (error) {
      response.writeHead(error.code === 'ENOENT' ? 404 : 500);
      response.end(error.code === 'ENOENT' ? 'Not found' : 'Server error');
      return;
    }

    const extension = path.extname(resolvedPath).toLowerCase();
    response.writeHead(200, { 'content-type': MIME_TYPES[extension] || 'application/octet-stream' });
    response.end(content);
  });
}

function getRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_UPLOAD_SIZE) {
        reject(new Error('Las fotos superan el limite de 60 MB.'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });

    request.on('end', () => resolve(Buffer.concat(chunks)));
    request.on('error', reject);
  });
}

function parseMultipart(buffer, boundary) {
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const parts = { fields: {}, files: [] };
  let start = buffer.indexOf(boundaryBuffer);

  while (start !== -1) {
    start += boundaryBuffer.length;
    if (buffer[start] === 45 && buffer[start + 1] === 45) break;
    if (buffer[start] === 13 && buffer[start + 1] === 10) start += 2;

    const headerEnd = buffer.indexOf(Buffer.from('\r\n\r\n'), start);
    if (headerEnd === -1) break;

    const headers = buffer.slice(start, headerEnd).toString('utf8');
    const nextBoundary = buffer.indexOf(boundaryBuffer, headerEnd + 4);
    if (nextBoundary === -1) break;

    let contentEnd = nextBoundary;
    if (buffer[contentEnd - 2] === 13 && buffer[contentEnd - 1] === 10) contentEnd -= 2;

    const content = buffer.slice(headerEnd + 4, contentEnd);
    const nameMatch = headers.match(/name="([^"]*)"/i);
    const filenameMatch = headers.match(/filename="([^"]*)"/i);
    const typeMatch = headers.match(/content-type:\s*([^\r\n]+)/i);

    if (filenameMatch && filenameMatch[1]) {
      parts.files.push({
        filename: filenameMatch[1],
        type: typeMatch ? typeMatch[1].trim() : '',
        content,
      });
    } else if (nameMatch && nameMatch[1]) {
      parts.fields[nameMatch[1]] = content.toString('utf8');
    }

    start = nextBoundary;
  }

  return parts;
}

function getUploadAlbum(fields) {
  const albums = readAlbumsMeta();
  const mode = fields.albumMode === 'existing' ? 'existing' : 'new';

  if (mode === 'existing') {
    const album = albums.find((item) => item.id === fields.albumId);
    if (!album) return { error: 'Selecciona un album existente valido.' };
    return { album, albums };
  }

  const name = (fields.albumName || '').trim();
  if (!name) return { error: 'Escribe el nombre del album.' };

  const baseId = slugify(name) || `album-${Date.now()}`;
  let id = baseId;
  let suffix = 2;
  while (albums.some((album) => album.id === id) || fs.existsSync(path.join(IMAGES_DIR, id))) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }

  const album = {
    id,
    name,
    description: (fields.albumDescription || '').trim(),
    createdAt: Date.now(),
  };

  albums.push(album);
  writeAlbumsMeta(albums);
  fs.mkdirSync(path.join(IMAGES_DIR, id), { recursive: true });

  return { album, albums };
}

async function handleUpload(request, response) {
  if (request.headers['x-admin-key'] !== ADMIN_KEY) {
    sendJson(response, 401, { error: 'Clave incorrecta.' });
    return;
  }

  const contentType = request.headers['content-type'] || '';
  const boundaryMatch = contentType.match(/boundary=(.+)$/);
  if (!boundaryMatch) {
    sendJson(response, 400, { error: 'Peticion de subida no valida.' });
    return;
  }

  try {
    const body = await getRequestBody(request);
    const { fields, files } = parseMultipart(body, boundaryMatch[1]);
    const albumResult = getUploadAlbum(fields);

    if (albumResult.error) {
      sendJson(response, 400, { error: albumResult.error });
      return;
    }

    const albumDir = path.join(IMAGES_DIR, albumResult.album.id);
    fs.mkdirSync(albumDir, { recursive: true });

    const savedFiles = [];
    for (const file of files) {
      const extension = path.extname(file.filename).toLowerCase();
      if (!IMAGE_EXTENSIONS.has(extension) || !file.type.startsWith('image/')) continue;

      const safeName = sanitizeFilename(file.filename);
      fs.writeFileSync(path.join(albumDir, safeName), file.content);
      savedFiles.push({
        name: safeName,
        url: `/imagenes/${albumResult.album.id}/${safeName}`,
      });
    }

    if (!savedFiles.length) {
      sendJson(response, 400, { error: 'No se encontro ninguna imagen valida.' });
      return;
    }

    sendJson(response, 200, { album: albumResult.album, files: savedFiles });
  } catch (error) {
    sendJson(response, 413, { error: error.message || 'No se pudo completar la subida.' });
  }
}

function handleRequest(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === 'OPTIONS') {
    response.writeHead(204, corsHeaders());
    response.end();
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/albums') {
    listAlbums(response);
    return;
  }

  const albumImagesMatch = url.pathname.match(/^\/api\/albums\/([^/]+)\/images$/);
  if (request.method === 'GET' && albumImagesMatch) {
    listAlbumImages(response, decodeURIComponent(albumImagesMatch[1]));
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/upload') {
    handleUpload(request, response);
    return;
  }

  if (request.method !== 'GET') {
    response.writeHead(405);
    response.end('Method not allowed');
    return;
  }

  const pathname = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  serveFile(response, path.join(ROOT_DIR, pathname));
}

if (require.main === module) {
  const server = http.createServer(handleRequest);

  server.listen(PORT, () => {
    console.log(`Servidor listo en http://localhost:${PORT}`);
    console.log(`Admin: http://localhost:${PORT}/admin.html`);
  });
}

module.exports = handleRequest;
