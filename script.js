const galleryGrid = document.getElementById('galleryGrid');
const galleryTitle = document.getElementById('galleryTitle');
const galleryDescription = document.getElementById('galleryDescription');
const calendarGrid = document.getElementById('calendarGrid');
const navToggle = document.getElementById('navToggle');
const navMenu = document.getElementById('navMenu');
const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:3000' : '';

function setMenuState(isOpen) {
  if (!navToggle || !navMenu) return;
  navMenu.classList.toggle('is-open', isOpen);
  navToggle.setAttribute('aria-expanded', String(isOpen));
  document.body.style.overflow = isOpen ? 'hidden' : '';
}

function renderEmptyGallery(message) {
  galleryGrid.innerHTML = `<p class="gallery-empty">${message}</p>`;
}

function getImageUrl(url) {
  return `${API_BASE}${url}`;
}

function renderCalendarEmpty(message) {
  if (!calendarGrid) return;
  calendarGrid.innerHTML = `<p class="calendar-empty">${message}</p>`;
}

function createCalendarCard(event) {
  const card = document.createElement('article');
  card.className = `calendar-card${event.flyerUrl ? '' : ' calendar-card-fallback'}`;

  if (event.flyerUrl) {
    card.style.backgroundImage = `linear-gradient(180deg, rgba(3, 3, 3, 0.12), rgba(3, 3, 3, 0.86)), linear-gradient(135deg, rgba(245, 0, 159, 0.28), rgba(0, 0, 0, 0.14) 48%, rgba(120, 201, 110, 0.18)), url("${getImageUrl(event.flyerUrl)}")`;
  }

  const date = document.createElement('span');
  date.className = 'calendar-date';

  const day = document.createElement('strong');
  day.textContent = event.day || '--';

  const month = document.createElement('small');
  month.textContent = event.month || 'Fecha';

  date.append(day, month);

  const content = document.createElement('div');
  content.className = 'calendar-card-content';

  const location = document.createElement('span');
  location.className = 'calendar-location';
  location.textContent = event.location || 'Ubicación por confirmar';

  const title = document.createElement('h3');
  title.textContent = event.title || 'Próximo Desmayo';

  const description = document.createElement('p');
  description.textContent = event.description || 'Muy pronto anunciaremos más detalles de esta fecha.';

  content.append(location, title, description);
  card.append(date, content);

  return card;
}

function renderFallbackEvents() {
  const events = [
    {
      day: '--',
      month: 'Pronto',
      location: 'Costa Brava',
      title: 'Open air Desmayo',
      description: 'Sunset, noche larga y la energía de siempre. Fecha por confirmar.',
    },
    {
      day: '--',
      month: 'Pronto',
      location: 'Barcelona',
      title: 'Club night',
      description: 'Lineup invitado, sala llena y ambiente Desmayo en la ciudad.',
    },
    {
      day: '--',
      month: 'Pronto',
      location: 'Menorca',
      title: 'Especial verano',
      description: 'Una nueva noche mediterránea para volver a juntar a la comunidad.',
    },
  ];

  calendarGrid.innerHTML = '';
  events.forEach((event) => calendarGrid.appendChild(createCalendarCard(event)));
}

async function loadEvents() {
  if (!calendarGrid) return;
  renderCalendarEmpty('Cargando próximas fechas...');

  try {
    const response = await fetch(`${API_BASE}/api/events`);
    if (!response.ok) throw new Error('No se pudieron cargar los eventos');

    const events = await response.json();
    if (!events.length) {
      renderFallbackEvents();
      return;
    }

    calendarGrid.innerHTML = '';
    events.forEach((event) => calendarGrid.appendChild(createCalendarCard(event)));
  } catch (error) {
    renderFallbackEvents();
  }
}

function renderAlbumCard(album) {
  const card = document.createElement('article');
  card.className = 'card album-card';

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

  const meta = document.createElement('small');
  meta.textContent = [album.venue, album.city, formatAlbumDate(album.date)].filter(Boolean).join(' · ') || 'Desmayo';

  const name = document.createElement('strong');
  name.textContent = album.name;

  const count = document.createElement('small');
  count.className = 'album-count';
  count.textContent = `${album.count} foto${album.count === 1 ? '' : 's'}`;

  const actions = document.createElement('span');
  actions.className = 'album-actions';

  const viewLink = document.createElement('a');
  viewLink.className = 'album-action';
  viewLink.href = `galeria.html#album=${encodeURIComponent(album.id)}`;
  viewLink.textContent = 'Ver fotos';

  const downloadLink = document.createElement('a');
  downloadLink.className = 'album-action album-action-secondary';
  downloadLink.href = `galeria.html#album=${encodeURIComponent(album.id)}`;
  downloadLink.textContent = 'Descargar';

  actions.append(viewLink, downloadLink);
  info.append(meta, name, count, actions);
  card.appendChild(info);

  return card;
}

function formatAlbumDate(value) {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('es', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

async function loadAlbums() {
  if (!galleryGrid) return;
  renderEmptyGallery('Cargando álbumes destacados...');

  try {
    const response = await fetch(`${API_BASE}/api/albums`);
    if (!response.ok) throw new Error('No se pudieron cargar los álbumes');

    const albums = await response.json();
    if (!albums.length) {
      renderEmptyGallery('Todavía no hay álbumes publicados.');
      return;
    }

    const featuredAlbums = albums.filter((album) => album.featured).concat(albums.filter((album) => !album.featured)).slice(0, 4);
    galleryGrid.innerHTML = '';
    featuredAlbums.forEach((album) => {
      galleryGrid.appendChild(renderAlbumCard(album));
    });
  } catch (error) {
    renderEmptyGallery('No se pudieron cargar los álbumes ahora mismo.');
  }
}

if (navToggle && navMenu) {
  navToggle.addEventListener('click', () => {
    const isOpen = navToggle.getAttribute('aria-expanded') !== 'true';
    setMenuState(isOpen);
  });

  navMenu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      setMenuState(false);
    });
  });

  navMenu.addEventListener('click', (event) => {
    if (event.target === navMenu) {
      setMenuState(false);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      setMenuState(false);
    }
  });
}

loadAlbums();
loadEvents();
