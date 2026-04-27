const galleryGrid = document.getElementById('galleryGrid');
const galleryTitle = document.getElementById('galleryTitle');
const galleryDescription = document.getElementById('galleryDescription');
const backToAlbums = document.getElementById('backToAlbums');
const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:3000' : '';

function renderEmptyGallery(message) {
  if (!galleryGrid) return;
  galleryGrid.innerHTML = `<p class="gallery-empty">${message}</p>`;
}

function getImageUrl(url) {
  return `${API_BASE}${url}`;
}

function renderAlbumCard(album) {
  const card = document.createElement('button');
  card.className = 'card album-card';
  card.type = 'button';

  if (album.coverUrl) {
    const img = document.createElement('img');
    img.src = getImageUrl(album.coverUrl);
    img.alt = album.name;
    img.loading = 'lazy';
    card.appendChild(img);
  } else {
    const placeholder = document.createElement('div');
    placeholder.className = 'album-placeholder';
    placeholder.textContent = 'Sin fotos';
    card.appendChild(placeholder);
  }

  const info = document.createElement('span');
  info.className = 'album-info';

  const name = document.createElement('strong');
  name.textContent = album.name;

  const count = document.createElement('small');
  count.textContent = `${album.count} foto${album.count === 1 ? '' : 's'}`;

  info.append(name, count);
  card.appendChild(info);
  card.addEventListener('click', () => loadAlbum(album.id));

  return card;
}

async function loadAlbums() {
  if (!galleryGrid || !galleryTitle || !galleryDescription || !backToAlbums) return;

  galleryTitle.textContent = 'Álbumes de fiestas';
  galleryDescription.textContent = 'Selecciona una fiesta para ver todas sus fotos.';
  backToAlbums.classList.add('is-hidden');
  renderEmptyGallery('Cargando álbumes...');

  try {
    const response = await fetch(`${API_BASE}/api/albums`);
    if (!response.ok) throw new Error('No se pudieron cargar los álbumes');

    const albums = await response.json();
    if (!albums.length) {
      renderEmptyGallery('Todavía no hay álbumes subidos.');
      return;
    }

    galleryGrid.innerHTML = '';
    albums.forEach((album) => {
      galleryGrid.appendChild(renderAlbumCard(album));
    });
  } catch (error) {
    renderEmptyGallery('No se pudieron cargar los álbumes ahora mismo.');
  }
}

async function loadAlbum(albumId) {
  if (!galleryGrid || !galleryTitle || !galleryDescription || !backToAlbums) return;

  renderEmptyGallery('Cargando fotos...');

  try {
    const response = await fetch(`${API_BASE}/api/albums/${encodeURIComponent(albumId)}/images`);
    if (!response.ok) throw new Error('No se pudo cargar el álbum');

    const album = await response.json();
    galleryTitle.textContent = album.name;
    galleryDescription.textContent = album.description || 'Fotos de esta fiesta.';
    backToAlbums.classList.remove('is-hidden');

    if (!album.images.length) {
      renderEmptyGallery('Este álbum todavía no tiene fotos.');
      return;
    }

    galleryGrid.innerHTML = '';
    album.images.forEach((image) => {
      const card = document.createElement('div');
      card.className = 'card';

      const img = document.createElement('img');
      img.src = getImageUrl(image.url);
      img.alt = image.name;
      img.loading = 'lazy';

      card.appendChild(img);
      galleryGrid.appendChild(card);
    });
  } catch (error) {
    renderEmptyGallery('No se pudo cargar este álbum ahora mismo.');
  }
}

backToAlbums?.addEventListener('click', loadAlbums);
loadAlbums();
