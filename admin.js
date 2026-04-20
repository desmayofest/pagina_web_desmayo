const photoInput = document.getElementById('photoInput');
const uploadButton = document.getElementById('uploadButton');
const adminKey = document.getElementById('adminKey');
const uploadStatus = document.getElementById('uploadStatus');
const previewGrid = document.getElementById('previewGrid');
const albumSelect = document.getElementById('albumSelect');
const albumName = document.getElementById('albumName');
const albumDescription = document.getElementById('albumDescription');
const newAlbumFields = document.getElementById('newAlbumFields');
const existingAlbumFields = document.getElementById('existingAlbumFields');
const albumModeInputs = Array.from(document.querySelectorAll('input[name="albumMode"]'));
const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:3000' : '';

function setStatus(message, isSuccess = false) {
  uploadStatus.textContent = message;
  uploadStatus.classList.toggle('active', isSuccess);
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
    const response = await fetch(`${API_BASE}/api/albums`);
    if (!response.ok) throw new Error('No se pudieron cargar los albumes');

    const albums = await response.json();
    albumSelect.innerHTML = '';

    if (!albums.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No hay albumes todavia';
      albumSelect.appendChild(option);
      return;
    }

    albums.forEach((album) => {
      const option = document.createElement('option');
      option.value = album.id;
      option.textContent = `${album.name} (${album.count})`;
      albumSelect.appendChild(option);
    });
  } catch (error) {
    albumSelect.innerHTML = '<option value="">No se pudieron cargar</option>';
  }
}

photoInput.addEventListener('change', () => {
  renderPreview(photoInput.files);
  setStatus(photoInput.files.length ? 'Fotos listas para subir' : 'Esperando fotos');
});

albumModeInputs.forEach((input) => {
  input.addEventListener('change', syncAlbumMode);
});

uploadButton.addEventListener('click', async () => {
  if (!adminKey.value.trim()) {
    setStatus('Escribe la clave de administrador.');
    return;
  }

  if (!photoInput.files.length) {
    setStatus('Elige una o mas fotos.');
    return;
  }

  const albumMode = getAlbumMode();
  if (albumMode === 'new' && !albumName.value.trim()) {
    setStatus('Escribe el nombre del album.');
    return;
  }

  if (albumMode === 'existing' && !albumSelect.value) {
    setStatus('Selecciona un album existente.');
    return;
  }

  const formData = new FormData();
  formData.append('albumMode', albumMode);
  formData.append('albumId', albumSelect.value);
  formData.append('albumName', albumName.value.trim());
  formData.append('albumDescription', albumDescription.value.trim());

  Array.from(photoInput.files).forEach((file) => {
    formData.append('photos', file);
  });

  uploadButton.disabled = true;
  setStatus('Subiendo fotos...');

  try {
    const response = await fetch(`${API_BASE}/api/upload`, {
      method: 'POST',
      headers: {
        'x-admin-key': adminKey.value.trim(),
      },
      body: formData,
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.error || 'No se pudieron subir las fotos');
    }

    photoInput.value = '';
    if (albumMode === 'new') {
      albumName.value = '';
      albumDescription.value = '';
    }
    previewGrid.innerHTML = '';
    await loadAlbums();
    setStatus(`Subidas ${result.files.length} foto(s) al album "${result.album.name}".`, true);
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
