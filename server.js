const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT) || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'Lluc2026';
const ROOT_DIR = __dirname;
const IMAGES_DIR = path.join(ROOT_DIR, 'imagenes');
const ALBUMS_FILE = path.join(IMAGES_DIR, 'albumes.json');
const EVENTS_FILE = path.join(IMAGES_DIR, 'eventos.json');
const EVENTS_DIR = path.join(IMAGES_DIR, 'eventos');
const MAX_UPLOAD_SIZE = 60 * 1024 * 1024;
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

fs.mkdirSync(IMAGES_DIR, { recursive: true });
fs.mkdirSync(EVENTS_DIR, { recursive: true });

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

function readEventsMeta() {
  try {
    return JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf8'));
  } catch (error) {
    return [];
  }
}

function writeEventsMeta(events) {
  fs.writeFileSync(EVENTS_FILE, JSON.stringify(events, null, 2));
}

function normalizeAlbum(album) {
  return {
    id: album.id,
    name: album.name || 'Álbum Desmayo',
    description: album.description || '',
    date: album.date || '',
    venue: album.venue || '',
    city: album.city || '',
    coverUrl: album.coverUrl || '',
    status: album.status === 'hidden' ? 'hidden' : 'visible',
    featured: album.featured === true || album.featured === 'true',
    order: Number(album.order) || 0,
    createdAt: album.createdAt || 0,
    updatedAt: album.updatedAt || 0,
  };
}

function sortAlbums(albums) {
  return albums.sort((a, b) => {
    if ((a.order || 0) !== (b.order || 0)) return (a.order || 0) - (b.order || 0);
    const dateA = Date.parse(a.date || '') || 0;
    const dateB = Date.parse(b.date || '') || 0;
    if (dateA !== dateB) return dateB - dateA;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
}

function normalizeEvent(event) {
  return {
    id: event.id,
    day: event.day || '',
    month: event.month || '',
    location: event.location || '',
    title: event.title || '',
    description: event.description || '',
    flyerUrl: event.flyerUrl || '',
    status: event.status === 'hidden' ? 'hidden' : 'visible',
    sortDate: event.sortDate || '',
    createdAt: event.createdAt || 0,
    updatedAt: event.updatedAt || 0,
  };
}

function sortEvents(events) {
  return events.sort((a, b) => {
    const dateA = Date.parse(a.sortDate || '') || Number.MAX_SAFE_INTEGER;
    const dateB = Date.parse(b.sortDate || '') || Number.MAX_SAFE_INTEGER;
    if (dateA !== dateB) return dateA - dateB;
    return (a.createdAt || 0) - (b.createdAt || 0);
  });
}

function listEvents(response, includeHidden = false) {
  const events = readEventsMeta()
    .map(normalizeEvent)
    .filter((event) => includeHidden || event.status === 'visible');

  sendJson(response, 200, sortEvents(events));
}

function validateEventFields(fields) {
  const day = (fields.day || '').trim();
  const month = (fields.month || '').trim();
  const location = (fields.location || '').trim();
  const title = (fields.title || '').trim();
  const sortDate = (fields.sortDate || '').trim();

  if (!day) return 'Escribe el día del evento.';
  if (!month) return 'Escribe el mes del evento.';
  if (!location) return 'Escribe la ciudad o ubicación.';
  if (!title) return 'Escribe el título del evento.';
  if (!sortDate) return 'Indica la fecha real para ordenar.';
  if (Number.isNaN(Date.parse(sortDate))) return 'La fecha real no es válida.';

  return '';
}

function saveEvent(fields, files) {
  const error = validateEventFields(fields);
  if (error) return { error };

  const events = readEventsMeta().map(normalizeEvent);
  const now = Date.now();
  const existingIndex = events.findIndex((event) => event.id === fields.eventId);
  const existing = existingIndex >= 0 ? events[existingIndex] : null;
  const baseId = existing?.id || slugify(`${fields.sortDate}-${fields.title}`) || `evento-${now}`;
  let id = baseId;
  let suffix = 2;

  while (!existing && events.some((event) => event.id === id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }

  let flyerUrl = existing?.flyerUrl || '';
  const flyer = files.find((file) => file.filename);
  if (flyer) {
    const extension = path.extname(flyer.filename).toLowerCase();
    if (!IMAGE_EXTENSIONS.has(extension) || !flyer.type.startsWith('image/')) {
      return { error: 'El flyer debe ser una imagen válida.' };
    }

    const safeName = sanitizeFilename(flyer.filename);
    fs.writeFileSync(path.join(EVENTS_DIR, safeName), flyer.content);
    flyerUrl = `/imagenes/eventos/${safeName}`;
  }

  const event = normalizeEvent({
    id,
    day: (fields.day || '').trim(),
    month: (fields.month || '').trim(),
    location: (fields.location || '').trim(),
    title: (fields.title || '').trim(),
    description: (fields.description || '').trim(),
    flyerUrl,
    status: fields.status === 'hidden' ? 'hidden' : 'visible',
    sortDate: (fields.sortDate || '').trim(),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  });

  if (existingIndex >= 0) {
    events[existingIndex] = event;
  } else {
    events.push(event);
  }

  writeEventsMeta(sortEvents(events));
  return { event };
}

async function handleEventSave(request, response) {
  if (request.headers['x-admin-key'] !== ADMIN_KEY) {
    sendJson(response, 401, { error: 'Clave incorrecta.' });
    return;
  }

  const contentType = request.headers['content-type'] || '';
  const boundaryMatch = contentType.match(/boundary=(.+)$/);
  if (!boundaryMatch) {
    sendJson(response, 400, { error: 'Petición de evento no válida.' });
    return;
  }

  try {
    const body = await getRequestBody(request);
    const { fields, files } = parseMultipart(body, boundaryMatch[1]);
    const result = saveEvent(fields, files);

    if (result.error) {
      sendJson(response, 400, { error: result.error });
      return;
    }

    sendJson(response, 200, result.event);
  } catch (error) {
    sendJson(response, 413, { error: error.message || 'No se pudo guardar el evento.' });
  }
}

async function handleEventDelete(request, response) {
  if (request.headers['x-admin-key'] !== ADMIN_KEY) {
    sendJson(response, 401, { error: 'Clave incorrecta.' });
    return;
  }

  try {
    const body = await getRequestBody(request);
    const payload = JSON.parse(body.toString('utf8') || '{}');
    const events = readEventsMeta().map(normalizeEvent);
    const nextEvents = events.filter((event) => event.id !== payload.id);

    if (nextEvents.length === events.length) {
      sendJson(response, 404, { error: 'Evento no encontrado.' });
      return;
    }

    writeEventsMeta(nextEvents);
    sendJson(response, 200, { success: true });
  } catch (error) {
    sendJson(response, 400, { error: 'No se pudo eliminar el evento.' });
  }
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

function getAlbumPayload(album, includeImages = false) {
  const images = getAlbumImages(album.id);
  const coverUrl = album.coverUrl || images[0]?.url || '';

  return {
    ...album,
    count: images.length,
    coverUrl,
    images: includeImages ? images : undefined,
  };
}

function listAlbums(response, includeHidden = false) {
  const albums = readAlbumsMeta()
    .map(normalizeAlbum)
    .filter((album) => album.id && fs.existsSync(path.join(IMAGES_DIR, album.id)))
    .filter((album) => includeHidden || album.status === 'visible')
    .map((album) => getAlbumPayload(album));

  sendJson(response, 200, sortAlbums(albums));
}

function listAlbumImages(response, albumId) {
  const album = readAlbumsMeta().map(normalizeAlbum).find((item) => item.id === albumId);
  if (!album) {
    sendJson(response, 404, { error: 'Álbum no encontrado.' });
    return;
  }

  sendJson(response, 200, getAlbumPayload(album, true));
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
        fieldName: nameMatch ? nameMatch[1] : '',
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

function validateAlbumFields(fields, isExisting) {
  if (!isExisting && !(fields.albumName || '').trim()) return 'Escribe el nombre del álbum.';
  return '';
}

function saveAlbum(fields, files = []) {
  const albums = readAlbumsMeta().map(normalizeAlbum);
  const mode = fields.albumMode === 'existing' || fields.albumId ? 'existing' : 'new';
  const now = Date.now();
  const existingIndex = albums.findIndex((item) => item.id === fields.albumId);
  const existing = existingIndex >= 0 ? albums[existingIndex] : null;
  const validationError = validateAlbumFields(fields, Boolean(existing));

  if (validationError) return { error: validationError };

  if (mode === 'existing') {
    if (!existing) return { error: 'Selecciona un álbum existente válido.' };
  }

  const name = (fields.albumName || existing?.name || '').trim();
  const baseId = existing?.id || slugify(name) || `album-${now}`;
  let id = baseId;
  let suffix = 2;

  while (!existing && (albums.some((album) => album.id === id) || fs.existsSync(path.join(IMAGES_DIR, id)))) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }

  const albumDir = path.join(IMAGES_DIR, id);
  fs.mkdirSync(albumDir, { recursive: true });

  let coverUrl = existing?.coverUrl || '';
  const savedFiles = [];
  const coverFile = files.find((file) => file.fieldName === 'albumCover' || file.fieldName === 'cover');

  if (coverFile) {
    const extension = path.extname(coverFile.filename).toLowerCase();
    if (!IMAGE_EXTENSIONS.has(extension) || !coverFile.type.startsWith('image/')) {
      return { error: 'La portada debe ser una imagen válida.' };
    }

    const safeName = sanitizeFilename(coverFile.filename);
    fs.writeFileSync(path.join(albumDir, safeName), coverFile.content);
    coverUrl = `/imagenes/${id}/${safeName}`;
  }

  for (const file of files) {
    if (file === coverFile) continue;
    const extension = path.extname(file.filename).toLowerCase();
    if (!IMAGE_EXTENSIONS.has(extension) || !file.type.startsWith('image/')) continue;

    const safeName = sanitizeFilename(file.filename);
    fs.writeFileSync(path.join(albumDir, safeName), file.content);
    savedFiles.push({
      name: safeName,
      url: `/imagenes/${id}/${safeName}`,
    });
  }

  const album = normalizeAlbum({
    id,
    name,
    description: (fields.albumDescription || '').trim(),
    date: (fields.albumDate || '').trim(),
    venue: (fields.albumVenue || '').trim(),
    city: (fields.albumCity || '').trim(),
    coverUrl,
    status: fields.albumStatus === 'hidden' ? 'hidden' : 'visible',
    featured: fields.albumFeatured === 'true',
    order: fields.albumOrder,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  });

  if (existingIndex >= 0) {
    albums[existingIndex] = album;
  } else {
    albums.push(album);
  }

  writeAlbumsMeta(sortAlbums(albums));
  return { album: getAlbumPayload(album), files: savedFiles };
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
    const albumResult = saveAlbum(fields, files);

    if (albumResult.error) {
      sendJson(response, 400, { error: albumResult.error });
      return;
    }

    if (!albumResult.files.length && !albumResult.album.coverUrl) {
      sendJson(response, 400, { error: 'No se encontró ninguna imagen válida.' });
      return;
    }

    sendJson(response, 200, albumResult);
  } catch (error) {
    sendJson(response, 413, { error: error.message || 'No se pudo completar la subida.' });
  }
}

async function handleAlbumSave(request, response) {
  if (request.headers['x-admin-key'] !== ADMIN_KEY) {
    sendJson(response, 401, { error: 'Clave incorrecta.' });
    return;
  }

  const contentType = request.headers['content-type'] || '';
  const boundaryMatch = contentType.match(/boundary=(.+)$/);
  if (!boundaryMatch) {
    sendJson(response, 400, { error: 'Petición de álbum no válida.' });
    return;
  }

  try {
    const body = await getRequestBody(request);
    const { fields, files } = parseMultipart(body, boundaryMatch[1]);
    const result = saveAlbum(fields, files);

    if (result.error) {
      sendJson(response, 400, { error: result.error });
      return;
    }

    sendJson(response, 200, result);
  } catch (error) {
    sendJson(response, 413, { error: error.message || 'No se pudo guardar el álbum.' });
  }
}

async function handleAlbumDelete(request, response) {
  if (request.headers['x-admin-key'] !== ADMIN_KEY) {
    sendJson(response, 401, { error: 'Clave incorrecta.' });
    return;
  }

  try {
    const body = await getRequestBody(request);
    const payload = JSON.parse(body.toString('utf8') || '{}');
    const albums = readAlbumsMeta().map(normalizeAlbum);
    const album = albums.find((item) => item.id === payload.id);

    if (!album) {
      sendJson(response, 404, { error: 'Álbum no encontrado.' });
      return;
    }

    const albumDir = path.join(IMAGES_DIR, album.id);
    if (fs.existsSync(albumDir)) fs.rmSync(albumDir, { recursive: true, force: true });
    writeAlbumsMeta(albums.filter((item) => item.id !== payload.id));
    sendJson(response, 200, { success: true });
  } catch (error) {
    sendJson(response, 400, { error: 'No se pudo eliminar el álbum.' });
  }
}

async function handlePhotoDelete(request, response, albumId) {
  if (request.headers['x-admin-key'] !== ADMIN_KEY) {
    sendJson(response, 401, { error: 'Clave incorrecta.' });
    return;
  }

  try {
    const body = await getRequestBody(request);
    const payload = JSON.parse(body.toString('utf8') || '{}');
    const filename = path.basename(payload.name || '');
    const filePath = path.join(IMAGES_DIR, albumId, filename);
    const resolvedPath = path.resolve(filePath);

    if (!filename || !resolvedPath.startsWith(path.resolve(path.join(IMAGES_DIR, albumId)))) {
      sendJson(response, 400, { error: 'Foto no válida.' });
      return;
    }

    if (fs.existsSync(resolvedPath)) fs.unlinkSync(resolvedPath);

    const albums = readAlbumsMeta().map(normalizeAlbum);
    const albumIndex = albums.findIndex((album) => album.id === albumId);
    if (albumIndex >= 0 && albums[albumIndex].coverUrl.endsWith(`/${filename}`)) {
      albums[albumIndex].coverUrl = '';
      albums[albumIndex].updatedAt = Date.now();
      writeAlbumsMeta(albums);
    }

    sendJson(response, 200, { success: true });
  } catch (error) {
    sendJson(response, 400, { error: 'No se pudo eliminar la foto.' });
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
    listAlbums(response, request.headers['x-admin-key'] === ADMIN_KEY);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/events') {
    listEvents(response, request.headers['x-admin-key'] === ADMIN_KEY);
    return;
  }

  const albumImagesMatch = url.pathname.match(/^\/api\/albums\/([^/]+)\/images$/);
  if (request.method === 'GET' && albumImagesMatch) {
    listAlbumImages(response, decodeURIComponent(albumImagesMatch[1]));
    return;
  }

  const albumPhotoDeleteMatch = url.pathname.match(/^\/api\/albums\/([^/]+)\/photos\/delete$/);
  if (request.method === 'POST' && albumPhotoDeleteMatch) {
    handlePhotoDelete(request, response, decodeURIComponent(albumPhotoDeleteMatch[1]));
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/upload') {
    handleUpload(request, response);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/albums') {
    handleAlbumSave(request, response);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/albums/delete') {
    handleAlbumDelete(request, response);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/events') {
    handleEventSave(request, response);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/events/delete') {
    handleEventDelete(request, response);
    return;
  }

  if (request.method !== 'GET') {
    response.writeHead(405);
    response.end('Method not allowed');
    return;
  }

  const pathname = url.pathname === '/' ? '/index.html' : (url.pathname === '/galeria' || url.pathname === '/albumes' ? '/galeria.html' : decodeURIComponent(url.pathname));
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
