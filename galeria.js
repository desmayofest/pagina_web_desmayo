const albumsGrid = document.getElementById('albumsGrid');
const albumSearch = document.getElementById('albumSearch');
const venueFilter = document.getElementById('venueFilter');
const dateFilter = document.getElementById('dateFilter');
const clearAlbumFilters = document.getElementById('clearAlbumFilters');
const albumView = document.getElementById('albumView');
const backToAlbumList = document.getElementById('backToAlbumList');
const albumViewMeta = document.getElementById('albumViewMeta');
const albumViewTitle = document.getElementById('albumViewTitle');
const albumViewDescription = document.getElementById('albumViewDescription');
const photoGrid = document.getElementById('photoGrid');
const downloadAlbumButton = document.getElementById('downloadAlbumButton');
const photoLightbox = document.getElementById('photoLightbox');
const lightboxImage = document.getElementById('lightboxImage');
const lightboxDownload = document.getElementById('lightboxDownload');
const lightboxClose = document.getElementById('lightboxClose');
const navToggle = document.getElementById('navToggle');
const navMenu = document.getElementById('navMenu');
const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:3000' : '';

let albums = [];
let currentAlbum = null;

function getImageUrl(url) {
  return `${API_BASE}${url}`;
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('es', { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
}

function setMenuState(isOpen) {
  if (!navToggle || !navMenu) return;
  navMenu.classList.toggle('is-open', isOpen);
  navToggle.setAttribute('aria-expanded', String(isOpen));
  document.body.style.overflow = isOpen ? 'hidden' : '';
}

function albumMeta(album) {
  return [album.venue, album.city, formatDate(album.date)].filter(Boolean).join(' · ') || 'Desmayo';
}

function createAlbumCard(album) {
  const card = document.createElement('article');
  card.className = `gallery-album-card${album.coverUrl ? '' : ' gallery-album-card-fallback'}`;

  const media = document.createElement('button');
  media.className = 'gallery-album-media';
  media.type = 'button';
  media.addEventListener('click', () => openAlbum(album.id));

  if (album.coverUrl) {
    const img = document.createElement('img');
    img.src = getImageUrl(album.coverUrl);
    img.alt = album.name;
    img.loading = 'lazy';
    media.appendChild(img);
  }

  const content = document.createElement('div');
  content.className = 'gallery-album-content';

  const tags = document.createElement('div');
  tags.className = 'album-tags';
  [album.venue, album.city, formatDate(album.date)].filter(Boolean).forEach((tag) => {
    const item = document.createElement('span');
    item.textContent = tag;
    tags.appendChild(item);
  });

  const title = document.createElement('h3');
  title.textContent = album.name;

  const description = document.createElement('p');
  description.textContent = album.description || 'Fotos oficiales de esta noche Desmayo.';

  const count = document.createElement('small');
  count.textContent = `${album.count} foto${album.count === 1 ? '' : 's'}`;

  const actions = document.createElement('div');
  actions.className = 'album-card-actions';

  const viewButton = document.createElement('button');
  viewButton.className = 'btn btn-primary';
  viewButton.type = 'button';
  viewButton.textContent = 'Ver fotos';
  viewButton.addEventListener('click', () => openAlbum(album.id));

  const downloadButton = document.createElement('button');
  downloadButton.className = 'btn btn-secondary';
  downloadButton.type = 'button';
  downloadButton.textContent = 'Descargar';
  downloadButton.addEventListener('click', () => downloadAlbum(album.id));

  actions.append(viewButton, downloadButton);
  content.append(tags, title, description, count, actions);
  card.append(media, content);

  return card;
}

function populateFilters() {
  const venues = [...new Set(albums.map((album) => album.venue).filter(Boolean))].sort();
  const dates = [...new Set(albums.map((album) => album.date).filter(Boolean))].sort().reverse();

  venueFilter.innerHTML = '<option value="">Todas las salas</option>';
  dateFilter.innerHTML = '<option value="">Todas las fechas</option>';

  venues.forEach((venue) => {
    const option = document.createElement('option');
    option.value = venue;
    option.textContent = venue;
    venueFilter.appendChild(option);
  });

  dates.forEach((date) => {
    const option = document.createElement('option');
    option.value = date;
    option.textContent = formatDate(date);
    dateFilter.appendChild(option);
  });
}

function renderAlbums() {
  const query = albumSearch.value.trim().toLowerCase();
  const venue = venueFilter.value;
  const date = dateFilter.value;

  const filtered = albums.filter((album) => {
    const haystack = [album.name, album.venue, album.city, album.description].join(' ').toLowerCase();
    return (!query || haystack.includes(query)) && (!venue || album.venue === venue) && (!date || album.date === date);
  });

  albumsGrid.innerHTML = '';

  if (!filtered.length) {
    albumsGrid.innerHTML = '<p class="gallery-empty">No hay álbumes que coincidan con esos filtros.</p>';
    return;
  }

  filtered.forEach((album) => albumsGrid.appendChild(createAlbumCard(album)));
}

async function loadAlbums() {
  try {
    const response = await fetch(`${API_BASE}/api/albums`);
    if (!response.ok) throw new Error('No se pudieron cargar los álbumes');

    albums = await response.json();
    populateFilters();
    renderAlbums();

    const hashAlbum = new URLSearchParams(window.location.hash.slice(1)).get('album');
    if (hashAlbum) openAlbum(hashAlbum);
  } catch (error) {
    albumsGrid.innerHTML = '<p class="gallery-empty">No se pudieron cargar los álbumes ahora mismo.</p>';
  }
}

async function openAlbum(albumId) {
  photoGrid.innerHTML = '<p class="gallery-empty">Cargando fotos...</p>';
  albumView.classList.remove('is-hidden');
  albumView.scrollIntoView({ behavior: 'smooth', block: 'start' });

  try {
    const response = await fetch(`${API_BASE}/api/albums/${encodeURIComponent(albumId)}/images`);
    if (!response.ok) throw new Error('No se pudo cargar el álbum');

    currentAlbum = await response.json();
    window.location.hash = `album=${encodeURIComponent(currentAlbum.id)}`;
    albumViewMeta.textContent = albumMeta(currentAlbum);
    albumViewTitle.textContent = currentAlbum.name;
    albumViewDescription.textContent = currentAlbum.description || 'Selecciona una foto para ampliarla y descargarla.';
    renderPhotos(currentAlbum.images || []);
  } catch (error) {
    photoGrid.innerHTML = '<p class="gallery-empty">No se pudo cargar este álbum.</p>';
  }
}

function renderPhotos(images) {
  photoGrid.innerHTML = '';

  if (!images.length) {
    photoGrid.innerHTML = '<p class="gallery-empty">Este álbum todavía no tiene fotos.</p>';
    return;
  }

  images.forEach((image) => {
    const button = document.createElement('article');
    button.className = 'photo-tile';
    button.tabIndex = 0;
    button.addEventListener('click', () => openLightbox(image));
    button.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') openLightbox(image);
    });

    const img = document.createElement('img');
    img.src = getImageUrl(image.url);
    img.alt = image.name;
    img.loading = 'lazy';

    const download = document.createElement('a');
    download.href = getImageUrl(image.url);
    download.download = image.name;
    download.textContent = 'Descargar';
    download.addEventListener('click', (event) => event.stopPropagation());

    button.append(img, download);
    photoGrid.appendChild(button);
  });
}

function openLightbox(image) {
  lightboxImage.src = getImageUrl(image.url);
  lightboxImage.alt = image.name;
  lightboxDownload.href = getImageUrl(image.url);
  lightboxDownload.download = image.name;
  photoLightbox.classList.remove('is-hidden');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  photoLightbox.classList.add('is-hidden');
  lightboxImage.src = '';
  document.body.style.overflow = '';
}

async function downloadAlbum(albumId = currentAlbum?.id) {
  if (!albumId) return;
  const album = currentAlbum?.id === albumId ? currentAlbum : await fetch(`${API_BASE}/api/albums/${encodeURIComponent(albumId)}/images`).then((response) => response.json());
  const images = album.images || [];

  if (!images.length) return;

  images.forEach((image, index) => {
    window.setTimeout(() => {
      const link = document.createElement('a');
      link.href = getImageUrl(image.url);
      link.download = image.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
    }, index * 180);
  });
}

backToAlbumList.addEventListener('click', () => {
  albumView.classList.add('is-hidden');
  currentAlbum = null;
  history.replaceState(null, '', 'galeria.html');
});

downloadAlbumButton.addEventListener('click', () => downloadAlbum());
lightboxClose.addEventListener('click', closeLightbox);
photoLightbox.addEventListener('click', (event) => {
  if (event.target === photoLightbox) closeLightbox();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeLightbox();
    setMenuState(false);
  }
});

[albumSearch, venueFilter, dateFilter].forEach((control) => {
  control.addEventListener('input', renderAlbums);
  control.addEventListener('change', renderAlbums);
});

clearAlbumFilters.addEventListener('click', () => {
  albumSearch.value = '';
  venueFilter.value = '';
  dateFilter.value = '';
  renderAlbums();
});

if (navToggle && navMenu) {
  navToggle.addEventListener('click', () => {
    const isOpen = navToggle.getAttribute('aria-expanded') !== 'true';
    setMenuState(isOpen);
  });

  navMenu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => setMenuState(false));
  });
}

loadAlbums();
