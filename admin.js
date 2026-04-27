const photoInput = document.getElementById('photoInput');
const uploadButton = document.getElementById('uploadButton');
const adminKey = document.getElementById('adminKey');
const uploadStatus = document.getElementById('uploadStatus');
const previewGrid = document.getElementById('previewGrid');
const albumSelect = document.getElementById('albumSelect');
const albumIdInput = document.getElementById('albumIdInput');
const albumName = document.getElementById('albumName');
const albumDescription = document.getElementById('albumDescription');
const albumDate = document.getElementById('albumDate');
const albumVenue = document.getElementById('albumVenue');
const albumCity = document.getElementById('albumCity');
const albumCover = document.getElementById('albumCover');
const albumStatus = document.getElementById('albumStatus');
const albumFeatured = document.getElementById('albumFeatured');
const albumOrder = document.getElementById('albumOrder');
const clearAlbumButton = document.getElementById('clearAlbumButton');
const albumAdminList = document.getElementById('albumAdminList');
const newAlbumFields = document.getElementById('newAlbumFields');
const existingAlbumFields = document.getElementById('existingAlbumFields');
const albumModeInputs = Array.from(document.querySelectorAll('input[name="albumMode"]'));
const eventId = document.getElementById('eventId');
const eventDay = document.getElementById('eventDay');
const eventMonth = document.getElementById('eventMonth');
const eventLocation = document.getElementById('eventLocation');
const eventTitle = document.getElementById('eventTitle');
const eventDescription = document.getElementById('eventDescription');
const eventSortDate = document.getElementById('eventSortDate');
const eventStatus = document.getElementById('eventStatus');
const eventFlyer = document.getElementById('eventFlyer');
const saveEventButton = document.getElementById('saveEventButton');
const clearEventButton = document.getElementById('clearEventButton');
const eventStatusText = document.getElementById('eventStatusText');
const eventList = document.getElementById('eventList');
const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:3000' : '';
let adminAlbums = [];

function setStatus(message, isSuccess = false) {
  uploadStatus.textContent = message;
  uploadStatus.classList.toggle('active', isSuccess);
}

function setEventStatus(message, isSuccess = false) {
  eventStatusText.textContent = message;
  eventStatusText.classList.toggle('active', isSuccess);
}

function renderPreview(files) {
  previewGrid.innerHTML = '';

  Array.from(files).forEach((file) => {
    if (!file.type.startsWith('image/')) return;

    const card = document.createElement('div');
    card.className = 'card';

    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.alt = file.name;
    img.onload = () => URL.revokeObjectURL(img.src);

    card.appendChild(img);
    previewGrid.appendChild(card);
  });
}

function getImageUrl(url) {
  return `${API_BASE}${url}`;
}

function resetAlbumForm() {
  albumIdInput.value = '';
  albumName.value = '';
  albumDescription.value = '';
  albumDate.value = '';
  albumVenue.value = '';
  albumCity.value = '';
  albumCover.value = '';
  albumStatus.value = 'visible';
  albumFeatured.checked = false;
  albumOrder.value = '0';
  photoInput.value = '';
  previewGrid.innerHTML = '';
  document.querySelector('input[name="albumMode"][value="new"]').checked = true;
  uploadButton.textContent = 'Guardar álbum';
  syncAlbumMode();
  setStatus('Esperando fotos');
}

async function fillAlbumForm(album) {
  albumIdInput.value = album.id;
  albumName.value = album.name || '';
  albumDescription.value = album.description || '';
  albumDate.value = album.date || '';
  albumVenue.value = album.venue || '';
  albumCity.value = album.city || '';
  albumStatus.value = album.status || 'visible';
  albumFeatured.checked = Boolean(album.featured);
  albumOrder.value = album.order || 0;
  albumCover.value = '';
  photoInput.value = '';
  document.querySelector('input[name="albumMode"][value="existing"]').checked = true;
  albumSelect.value = album.id;
  uploadButton.textContent = 'Actualizar álbum';
  syncAlbumMode();
  setStatus(`Editando álbum "${album.name}".`);

  await renderAlbumPhotos(album.id);
}

async function renderAlbumPhotos(albumId) {
  previewGrid.innerHTML = '<p class="gallery-empty">Cargando fotos del álbum...</p>';

  try {
    const response = await fetch(`${API_BASE}/api/albums/${encodeURIComponent(albumId)}/images`);
    if (!response.ok) throw new Error('No se pudieron cargar las fotos');
    const album = await response.json();

    previewGrid.innerHTML = '';
    if (!album.images.length) {
      previewGrid.innerHTML = '<p class="gallery-empty">Este álbum todavía no tiene fotos.</p>';
      return;
    }

    album.images.forEach((image) => {
      const card = document.createElement('div');
      card.className = 'card admin-photo-card';

      const img = document.createElement('img');
      img.src = getImageUrl(image.url);
      img.alt = image.name;
      img.loading = 'lazy';

      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Eliminar foto';
      button.addEventListener('click', () => deleteAlbumPhoto(albumId, image.name));

      card.append(img, button);
      previewGrid.appendChild(card);
    });
  } catch (error) {
    previewGrid.innerHTML = '<p class="gallery-empty">No se pudieron cargar las fotos.</p>';
  }
}

function renderAlbumAdminList(albums) {
  albumAdminList.innerHTML = '';

  if (!albums.length) {
    albumAdminList.innerHTML = '<p class="gallery-empty">Todavía no hay álbumes creados.</p>';
    return;
  }

  albums.forEach((album) => {
    const item = document.createElement('article');
    item.className = 'admin-event-item';

    const thumb = document.createElement('span');
    thumb.className = 'admin-event-thumb';
    if (album.coverUrl) {
      thumb.style.backgroundImage = `linear-gradient(180deg, rgba(0, 0, 0, 0.16), rgba(0, 0, 0, 0.68)), url("${getImageUrl(album.coverUrl)}")`;
    }

    const copy = document.createElement('div');
    copy.className = 'admin-event-copy';

    const meta = document.createElement('small');
    meta.textContent = [album.venue || 'Sin sala', album.city || 'Sin ciudad', album.date || 'Sin fecha', album.status === 'hidden' ? 'Oculto' : 'Visible', album.featured ? 'Destacado' : ''].filter(Boolean).join(' · ');

    const title = document.createElement('strong');
    title.textContent = album.name || 'Álbum sin título';

    const description = document.createElement('p');
    description.textContent = `${album.count} foto${album.count === 1 ? '' : 's'} · ${album.description || 'Sin descripción.'}`;

    copy.append(meta, title, description);

    const actions = document.createElement('div');
    actions.className = 'admin-event-actions';

    const editButton = document.createElement('button');
    editButton.className = 'btn btn-secondary';
    editButton.type = 'button';
    editButton.textContent = 'Editar';
    editButton.addEventListener('click', () => fillAlbumForm(album));

    const deleteButton = document.createElement('button');
    deleteButton.className = 'btn btn-secondary';
    deleteButton.type = 'button';
    deleteButton.textContent = 'Eliminar';
    deleteButton.addEventListener('click', () => deleteAlbum(album.id));

    actions.append(editButton, deleteButton);
    item.append(thumb, copy, actions);
    albumAdminList.appendChild(item);
  });
}

function resetEventForm() {
  eventId.value = '';
  eventDay.value = '';
  eventMonth.value = '';
  eventLocation.value = '';
  eventTitle.value = '';
  eventDescription.value = '';
  eventSortDate.value = '';
  eventStatus.value = 'visible';
  eventFlyer.value = '';
  saveEventButton.textContent = 'Guardar evento';
  setEventStatus('Esperando datos');
}

function fillEventForm(event) {
  eventId.value = event.id;
  eventDay.value = event.day || '';
  eventMonth.value = event.month || '';
  eventLocation.value = event.location || '';
  eventTitle.value = event.title || '';
  eventDescription.value = event.description || '';
  eventSortDate.value = event.sortDate || '';
  eventStatus.value = event.status || 'visible';
  eventFlyer.value = '';
  saveEventButton.textContent = 'Actualizar evento';
  setEventStatus(`Editando "${event.title}".`);
}

function renderEventList(events) {
  eventList.innerHTML = '';

  if (!events.length) {
    eventList.innerHTML = '<p class="gallery-empty">Todavía no hay eventos creados.</p>';
    return;
  }

  events.forEach((event) => {
    const item = document.createElement('article');
    item.className = 'admin-event-item';

    const thumb = document.createElement('span');
    thumb.className = 'admin-event-thumb';
    if (event.flyerUrl) {
      thumb.style.backgroundImage = `linear-gradient(180deg, rgba(0, 0, 0, 0.16), rgba(0, 0, 0, 0.68)), url("${API_BASE}${event.flyerUrl}")`;
    }

    const copy = document.createElement('div');
    copy.className = 'admin-event-copy';

    const meta = document.createElement('small');
    meta.textContent = `${event.day || '--'} ${event.month || ''} · ${event.location || 'Sin ubicación'} · ${event.status === 'hidden' ? 'Oculto' : 'Visible'}`;

    const title = document.createElement('strong');
    title.textContent = event.title || 'Evento sin título';

    const description = document.createElement('p');
    description.textContent = event.description || 'Sin descripción.';

    copy.append(meta, title, description);

    const actions = document.createElement('div');
    actions.className = 'admin-event-actions';

    const editButton = document.createElement('button');
    editButton.className = 'btn btn-secondary';
    editButton.type = 'button';
    editButton.textContent = 'Editar';
    editButton.addEventListener('click', () => fillEventForm(event));

    const deleteButton = document.createElement('button');
    deleteButton.className = 'btn btn-secondary';
    deleteButton.type = 'button';
    deleteButton.textContent = 'Eliminar';
    deleteButton.addEventListener('click', () => deleteEvent(event.id));

    actions.append(editButton, deleteButton);
    item.append(thumb, copy, actions);
    eventList.appendChild(item);
  });
}

async function loadEventsAdmin() {
  if (!adminKey.value.trim()) {
    eventList.innerHTML = '<p class="gallery-empty">Introduce la clave para cargar los eventos.</p>';
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/events`, {
      headers: {
        'x-admin-key': adminKey.value.trim(),
      },
    });
    if (!response.ok) throw new Error('No se pudieron cargar los eventos');

    const events = await response.json();
    renderEventList(events);
  } catch (error) {
    eventList.innerHTML = '<p class="gallery-empty">No se pudieron cargar los eventos.</p>';
  }
}

async function saveEvent() {
  if (!adminKey.value.trim()) {
    setEventStatus('Escribe la clave de administrador.');
    return;
  }

  if (!eventDay.value.trim() || !eventMonth.value.trim() || !eventLocation.value.trim() || !eventTitle.value.trim() || !eventSortDate.value) {
    setEventStatus('Completa día, mes, ubicación, título y fecha real.');
    return;
  }

  const formData = new FormData();
  formData.append('eventId', eventId.value);
  formData.append('day', eventDay.value.trim());
  formData.append('month', eventMonth.value.trim());
  formData.append('location', eventLocation.value.trim());
  formData.append('title', eventTitle.value.trim());
  formData.append('description', eventDescription.value.trim());
  formData.append('sortDate', eventSortDate.value);
  formData.append('status', eventStatus.value);

  if (eventFlyer.files[0]) {
    formData.append('flyer', eventFlyer.files[0]);
  }

  saveEventButton.disabled = true;
  setEventStatus('Guardando evento...');

  try {
    const response = await fetch(`${API_BASE}/api/events`, {
      method: 'POST',
      headers: {
        'x-admin-key': adminKey.value.trim(),
      },
      body: formData,
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'No se pudo guardar el evento');

    resetEventForm();
    await loadEventsAdmin();
    setEventStatus(`Evento "${result.title}" guardado.`, true);
  } catch (error) {
    setEventStatus(
      error.message === 'Failed to fetch'
        ? 'No se pudo conectar con el backend. Ejecuta npm start y abre http://localhost:3000/admin.html.'
        : error.message
    );
  } finally {
    saveEventButton.disabled = false;
  }
}

async function deleteEvent(id) {
  if (!adminKey.value.trim()) {
    setEventStatus('Escribe la clave de administrador.');
    return;
  }

  if (!window.confirm('¿Eliminar este evento del calendario?')) return;

  try {
    const response = await fetch(`${API_BASE}/api/events/delete`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-admin-key': adminKey.value.trim(),
      },
      body: JSON.stringify({ id }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'No se pudo eliminar el evento');

    if (eventId.value === id) resetEventForm();
    await loadEventsAdmin();
    setEventStatus('Evento eliminado.', true);
  } catch (error) {
    setEventStatus(error.message);
  }
}

async function deleteAlbum(id) {
  if (!adminKey.value.trim()) {
    setStatus('Escribe la clave de administrador.');
    return;
  }

  if (!window.confirm('¿Eliminar este álbum y sus fotos de la galería?')) return;

  try {
    const response = await fetch(`${API_BASE}/api/albums/delete`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-admin-key': adminKey.value.trim(),
      },
      body: JSON.stringify({ id }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'No se pudo eliminar el álbum');

    if (albumIdInput.value === id) resetAlbumForm();
    await loadAlbums();
    setStatus('Álbum eliminado.', true);
  } catch (error) {
    setStatus(error.message);
  }
}

async function deleteAlbumPhoto(albumId, name) {
  if (!adminKey.value.trim()) {
    setStatus('Escribe la clave de administrador.');
    return;
  }

  if (!window.confirm('¿Eliminar esta foto del álbum?')) return;

  try {
    const response = await fetch(`${API_BASE}/api/albums/${encodeURIComponent(albumId)}/photos/delete`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-admin-key': adminKey.value.trim(),
      },
      body: JSON.stringify({ name }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'No se pudo eliminar la foto');

    await renderAlbumPhotos(albumId);
    await loadAlbums();
    setStatus('Foto eliminada.', true);
  } catch (error) {
    setStatus(error.message);
  }
}

function getAlbumMode() {
  return albumModeInputs.find((input) => input.checked)?.value || 'new';
}

function syncAlbumMode() {
  const isExisting = getAlbumMode() === 'existing';
  newAlbumFields.classList.toggle('is-hidden', isExisting);
  existingAlbumFields.classList.toggle('is-hidden', !isExisting);
}

async function loadAlbums() {
  try {
    const headers = adminKey.value.trim() ? { 'x-admin-key': adminKey.value.trim() } : {};
    const response = await fetch(`${API_BASE}/api/albums`, { headers });
    if (!response.ok) throw new Error('No se pudieron cargar los álbumes');

    adminAlbums = await response.json();
    albumSelect.innerHTML = '';

    if (!adminAlbums.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No hay álbumes todavía';
      albumSelect.appendChild(option);
      renderAlbumAdminList([]);
      return;
    }

    adminAlbums.forEach((album) => {
      const option = document.createElement('option');
      option.value = album.id;
      option.textContent = `${album.name} (${album.count})`;
      albumSelect.appendChild(option);
    });

    renderAlbumAdminList(adminAlbums);
  } catch (error) {
    albumSelect.innerHTML = '<option value="">No se pudieron cargar</option>';
    albumAdminList.innerHTML = '<p class="gallery-empty">No se pudieron cargar los álbumes.</p>';
  }
}

photoInput.addEventListener('change', () => {
  renderPreview(photoInput.files);
  setStatus(photoInput.files.length ? 'Fotos listas para subir' : 'Esperando fotos');
});

adminKey.addEventListener('change', () => {
  loadAlbums();
  loadEventsAdmin();
});

saveEventButton.addEventListener('click', saveEvent);
clearEventButton.addEventListener('click', resetEventForm);
clearAlbumButton.addEventListener('click', resetAlbumForm);

albumSelect.addEventListener('change', () => {
  const album = adminAlbums.find((item) => item.id === albumSelect.value);
  if (album && getAlbumMode() === 'existing') fillAlbumForm(album);
});

albumModeInputs.forEach((input) => {
  input.addEventListener('change', syncAlbumMode);
});

uploadButton.addEventListener('click', async () => {
  if (!adminKey.value.trim()) {
    setStatus('Escribe la clave de administrador.');
    return;
  }

  const albumMode = getAlbumMode();
  const editingAlbumId = albumIdInput.value || albumSelect.value;
  if (albumMode === 'new' && !albumName.value.trim()) {
    setStatus('Escribe el nombre del álbum.');
    return;
  }

  if (albumMode === 'existing' && !editingAlbumId) {
    setStatus('Selecciona un álbum existente.');
    return;
  }

  const formData = new FormData();
  formData.append('albumMode', albumMode);
  formData.append('albumId', editingAlbumId);
  formData.append('albumName', albumName.value.trim());
  formData.append('albumDescription', albumDescription.value.trim());
  formData.append('albumDate', albumDate.value);
  formData.append('albumVenue', albumVenue.value.trim());
  formData.append('albumCity', albumCity.value.trim());
  formData.append('albumStatus', albumStatus.value);
  formData.append('albumFeatured', String(albumFeatured.checked));
  formData.append('albumOrder', albumOrder.value || '0');

  if (albumCover.files[0]) {
    formData.append('albumCover', albumCover.files[0]);
  }

  Array.from(photoInput.files).forEach((file) => {
    formData.append('photos', file);
  });

  uploadButton.disabled = true;
  setStatus('Guardando álbum...');

  try {
    const response = await fetch(`${API_BASE}/api/albums`, {
      method: 'POST',
      headers: {
        'x-admin-key': adminKey.value.trim(),
      },
      body: formData,
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.error || 'No se pudo guardar el álbum');
    }

    resetAlbumForm();
    await loadAlbums();
    setStatus(`Álbum "${result.album.name}" guardado.`, true);
  } catch (error) {
    setStatus(
      error.message === 'Failed to fetch'
        ? 'No se pudo conectar con el backend. Ejecuta npm start y abre http://localhost:3000/admin.html.'
        : error.message
    );
  } finally {
    uploadButton.disabled = false;
  }
});

syncAlbumMode();
loadAlbums();
loadEventsAdmin();
