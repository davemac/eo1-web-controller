/**
 * EO1 Web Controller - Main Application
 *
 * This is a single-page application that provides a web interface for controlling
 * the Electric Objects EO1 digital art display. It communicates with a Node.js
 * backend which in turn talks to the EO1 device via TCP and the Flickr API via HTTPS.
 *
 * Key features:
 * - Browse Flickr photos by user, tag, group, gallery, or album
 * - Display images/videos on the EO1 device
 * - Control brightness and slideshow settings
 * - Save custom Flickr sources as presets
 * - Portrait orientation detection (EO1 is a vertical display)
 */

// ============================================================================
// Application State
// ============================================================================

/**
 * Global application state
 * All UI state is managed here rather than in the DOM
 */
const state = {
  connected: false,
  presets: {},
  activePreset: null,
  currentSearch: null,
  currentPage: 1,
  totalPages: 1,
  photos: [],
  albums: [],
  currentAlbum: null,
  selectedPhoto: null,
  flickrUserId: null,
  // Filter state - defaults for EO1 display
  filters: {
    portrait: true,      // orientation: 'portrait'
    minSize: true,       // min_width/min_height: 1024
    recent: true,        // min_taken_date: 3 months ago
    interesting: false,  // sort: 'interestingness-desc'
    inGallery: false,    // in_gallery: true
    isGetty: false,      // is_getty: true
    isCommons: false,    // is_commons: true
    styleBW: false,      // styles includes 'blackandwhite'
    styleDOF: false,     // styles includes 'depthoffield'
    styleMinimal: false, // styles includes 'minimalism'
    stylePattern: false  // styles includes 'pattern'
  }
};

// ============================================================================
// DOM Element References
// ============================================================================

/**
 * Cached references to DOM elements
 * Populated once at startup for performance
 */
const elements = {
  statusIndicator: document.getElementById('statusIndicator'),
  // Current source
  currentSourceCard: document.getElementById('currentSourceCard'),
  currentSourceThumb: document.getElementById('currentSourceThumb'),
  currentSourceImage: document.getElementById('currentSourceImage'),
  currentSourceType: document.getElementById('currentSourceType'),
  currentSourceName: document.getElementById('currentSourceName'),
  currentSourceLink: document.getElementById('currentSourceLink'),
  // Quick controls
  btnSkip: document.getElementById('btnSkip'),
  btnScreenToggle: document.getElementById('btnScreenToggle'),
  screenIcon: document.getElementById('screenIcon'),
  screenLabel: document.getElementById('screenLabel'),
  autoBrightness: document.getElementById('autoBrightness'),
  brightnessSlider: document.getElementById('brightnessSlider'),
  brightnessSliderRow: document.getElementById('brightnessSliderRow'),
  brightnessValue: document.getElementById('brightnessValue'),
  presetGrid: document.getElementById('presetGrid'),
  btnAddPreset: document.getElementById('btnAddPreset'),
  interval: document.getElementById('interval'),
  quietStart: document.getElementById('quietStart'),
  quietEnd: document.getElementById('quietEnd'),
  btnApplySettings: document.getElementById('btnApplySettings'),
  searchInput: document.getElementById('searchInput'),
  btnSearch: document.getElementById('btnSearch'),
  photoGrid: document.getElementById('photoGrid'),
  paginationTop: document.getElementById('paginationTop'),
  paginationBottom: document.getElementById('paginationBottom'),
  deviceIp: document.getElementById('deviceIp'),
  btnTestConnection: document.getElementById('btnTestConnection'),
  btnScanNetwork: document.getElementById('btnScanNetwork'),
  scanStatus: document.getElementById('scanStatus'),
  scanResults: document.getElementById('scanResults'),
  foundDevices: document.getElementById('foundDevices'),
  btnUseDevice: document.getElementById('btnUseDevice'),
  btnSaveDevice: document.getElementById('btnSaveDevice'),
  // Flickr settings
  flickrStatus: document.getElementById('flickrStatus'),
  flickrSource: document.getElementById('flickrSource'),
  flickrApiKey: document.getElementById('flickrApiKey'),
  flickrUserId: document.getElementById('flickrUserId'),
  btnSaveFlickr: document.getElementById('btnSaveFlickr'),
  // Modals
  previewModal: document.getElementById('previewModal'),
  btnClosePreview: document.getElementById('btnClosePreview'),
  previewImage: document.getElementById('previewImage'),
  previewVideo: document.getElementById('previewVideo'),
  previewTitle: document.getElementById('previewTitle'),
  previewMeta: document.getElementById('previewMeta'),
  btnDisplayOnEO1: document.getElementById('btnDisplayOnEO1'),
  addPresetModal: document.getElementById('addPresetModal'),
  btnCloseAddPreset: document.getElementById('btnCloseAddPreset'),
  presetUrl: document.getElementById('presetUrl'),
  presetName: document.getElementById('presetName'),
  presetPreview: document.getElementById('presetPreview'),
  btnSavePreset: document.getElementById('btnSavePreset'),
  toastContainer: document.getElementById('toastContainer'),
  // Filter elements
  filterBar: document.getElementById('filterBar'),
  filterPortrait: document.getElementById('filterPortrait'),
  filterMinSize: document.getElementById('filterMinSize'),
  filterRecent: document.getElementById('filterRecent'),
  filterInteresting: document.getElementById('filterInteresting'),
  filterGallery: document.getElementById('filterGallery'),
  filterGetty: document.getElementById('filterGetty'),
  filterCommons: document.getElementById('filterCommons'),
  filterBW: document.getElementById('filterBW'),
  filterDOF: document.getElementById('filterDOF'),
  filterMinimal: document.getElementById('filterMinimal'),
  filterPattern: document.getElementById('filterPattern'),
  // Preset filter elements
  presetUseFilters: document.getElementById('presetUseFilters'),
  presetFilterOptions: document.getElementById('presetFilterOptions'),
  presetFilterPortrait: document.getElementById('presetFilterPortrait'),
  presetFilterMinSize: document.getElementById('presetFilterMinSize'),
  presetFilterRecent: document.getElementById('presetFilterRecent'),
  presetFilterInteresting: document.getElementById('presetFilterInteresting'),
  presetFilterGallery: document.getElementById('presetFilterGallery'),
  presetFilterGetty: document.getElementById('presetFilterGetty'),
  presetFilterCommons: document.getElementById('presetFilterCommons'),
  presetFilterBW: document.getElementById('presetFilterBW'),
  presetFilterDOF: document.getElementById('presetFilterDOF'),
  presetFilterMinimal: document.getElementById('presetFilterMinimal'),
  presetFilterPattern: document.getElementById('presetFilterPattern')
};

// ============================================================================
// UI Helper Functions
// ============================================================================

/**
 * Update the screen on/off button to reflect current state
 */
function updateScreenButton(isOn) {
  if (isOn) {
    elements.screenIcon.textContent = '☀️';
    elements.screenLabel.textContent = 'On';
    elements.btnScreenToggle.classList.remove('screen-off');
  } else {
    elements.screenIcon.textContent = '🌙';
    elements.screenLabel.textContent = 'Off';
    elements.btnScreenToggle.classList.add('screen-off');
  }
}

// Toast notifications
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span class="toast-message">${message}</span>
  `;

  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/**
 * Format an error message with context
 * Handles common API error patterns and provides user-friendly messages
 * @param {string} context - What operation was being attempted
 * @param {Error} error - The caught error
 * @returns {string} - User-friendly error message
 */
function formatError(context, error) {
  const msg = error.message || 'Unknown error';

  // Handle common Flickr API errors
  if (msg.includes('User not found')) {
    return `${context}: Flickr user not found. Check the user ID or URL.`;
  }
  if (msg.includes('Invalid API Key')) {
    return `${context}: Invalid Flickr API key. Check your settings.`;
  }
  if (msg.includes('Photoset not found')) {
    return `${context}: Album not found or is private.`;
  }
  if (msg.includes('Group not found')) {
    return `${context}: Group not found. It may be private or the URL is incorrect.`;
  }

  // Handle network errors
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
    return `${context}: Network error. Check your connection.`;
  }
  if (msg.includes('ECONNREFUSED') || msg.includes('connect ETIMEDOUT')) {
    return `${context}: Could not reach EO1 device. Check if it's powered on.`;
  }

  // Default: include context with original message
  return `${context}: ${msg}`;
}

// Update connection status
function updateStatus(connected) {
  state.connected = connected;
  const dot = elements.statusIndicator.querySelector('.status-dot');
  const text = elements.statusIndicator.querySelector('.status-text');

  if (connected) {
    dot.className = 'status-dot connected';
    text.textContent = 'Connected';
  } else {
    dot.className = 'status-dot disconnected';
    text.textContent = 'Disconnected';
  }
}

// ============================================================================
// Filter Functions
// ============================================================================

/**
 * Build searchParams object from current filter state
 * @param {string} baseQuery - The text query to search for
 * @returns {Object} - searchParams object for advancedSearch API
 */
function buildSearchParams(baseQuery) {
  const params = { text: baseQuery };
  const { filters } = state;

  if (filters.portrait) params.orientation = 'portrait';
  if (filters.minSize) {
    params.min_width = 1024;
    params.min_height = 1024;
  }
  if (filters.recent) {
    // 3 months ago in Unix timestamp
    params.min_taken_date = Math.floor(Date.now() / 1000) - (90 * 24 * 60 * 60);
  }
  if (filters.interesting) params.sort = 'interestingness-desc';
  if (filters.inGallery) params.in_gallery = true;
  if (filters.isGetty) params.is_getty = true;
  if (filters.isCommons) params.is_commons = true;

  const styles = [];
  if (filters.styleBW) styles.push('blackandwhite');
  if (filters.styleDOF) styles.push('depthoffield');
  if (filters.styleMinimal) styles.push('minimalism');
  if (filters.stylePattern) styles.push('pattern');
  if (styles.length) params.styles = styles.join(',');

  return params;
}

/**
 * Sync filter checkboxes to match current state
 */
function syncFiltersToUI() {
  const { filters } = state;
  elements.filterPortrait.checked = filters.portrait;
  elements.filterMinSize.checked = filters.minSize;
  elements.filterRecent.checked = filters.recent;
  elements.filterInteresting.checked = filters.interesting;
  elements.filterGallery.checked = filters.inGallery;
  elements.filterGetty.checked = filters.isGetty;
  elements.filterCommons.checked = filters.isCommons;
  elements.filterBW.checked = filters.styleBW;
  elements.filterDOF.checked = filters.styleDOF;
  elements.filterMinimal.checked = filters.styleMinimal;
  elements.filterPattern.checked = filters.stylePattern;
}

/**
 * Read filter checkboxes and update state
 */
function syncUIToFilters() {
  state.filters.portrait = elements.filterPortrait.checked;
  state.filters.minSize = elements.filterMinSize.checked;
  state.filters.recent = elements.filterRecent.checked;
  state.filters.interesting = elements.filterInteresting.checked;
  state.filters.inGallery = elements.filterGallery.checked;
  state.filters.isGetty = elements.filterGetty.checked;
  state.filters.isCommons = elements.filterCommons.checked;
  state.filters.styleBW = elements.filterBW.checked;
  state.filters.styleDOF = elements.filterDOF.checked;
  state.filters.styleMinimal = elements.filterMinimal.checked;
  state.filters.stylePattern = elements.filterPattern.checked;
}

/**
 * Set filter state from a preset's searchParams
 * @param {Object} searchParams - The preset's searchParams object
 */
function setFiltersFromSearchParams(searchParams) {
  if (!searchParams) {
    // Reset to defaults
    state.filters = {
      portrait: true,
      minSize: true,
      recent: true,
      interesting: false,
      inGallery: false,
      isGetty: false,
      isCommons: false,
      styleBW: false,
      styleDOF: false,
      styleMinimal: false,
      stylePattern: false
    };
  } else {
    state.filters.portrait = searchParams.orientation === 'portrait';
    state.filters.minSize = searchParams.min_width >= 1024 || searchParams.min_height >= 1024;
    state.filters.recent = !!searchParams.min_taken_date;
    state.filters.interesting = searchParams.sort === 'interestingness-desc';
    state.filters.inGallery = !!searchParams.in_gallery;
    state.filters.isGetty = !!searchParams.is_getty;
    state.filters.isCommons = !!searchParams.is_commons;

    const styles = searchParams.styles ? searchParams.styles.split(',') : [];
    state.filters.styleBW = styles.includes('blackandwhite');
    state.filters.styleDOF = styles.includes('depthoffield');
    state.filters.styleMinimal = styles.includes('minimalism');
    state.filters.stylePattern = styles.includes('pattern');
  }
  syncFiltersToUI();
}

/**
 * Show or hide the filter bar
 * @param {boolean} show - Whether to show the filter bar
 */
function showFilterBar(show) {
  elements.filterBar.style.display = show ? 'block' : 'none';
}

/**
 * Handle filter checkbox change - reload photos with new filters
 */
function onFilterChange() {
  syncUIToFilters();
  // Reload current search from page 1 with new filters
  if (state.currentSearch) {
    if (state.currentSearch.type === 'tag') {
      // Convert tag search to advanced search with filters
      const searchParams = buildSearchParams(state.currentSearch.value);
      state.currentSearch = { type: 'search', value: state.currentSearch.value, searchParams };
      loadPhotos(searchParams, 'search', 1);
    } else if (state.currentSearch.type === 'search') {
      // Update searchParams with new filters
      const searchParams = buildSearchParams(state.currentSearch.value);
      state.currentSearch.searchParams = searchParams;
      loadPhotos(searchParams, 'search', 1);
    }
  }
}

// Load and display current source
async function loadCurrentSource() {
  try {
    const result = await API.settings.getCurrentSource();
    updateCurrentSourceDisplay(result.currentSource);
  } catch (error) {
    console.error('Failed to load current source:', error);
  }
}

// Update the current source display
function updateCurrentSourceDisplay(source) {
  if (!source) {
    // Show default state
    elements.currentSourceType.textContent = '—';
    elements.currentSourceName.textContent = 'Select a source below';
    elements.currentSourceLink.style.display = 'none';
    elements.currentSourceThumb.style.display = 'none';
    return;
  }

  // Set type label
  const typeLabels = {
    tag: 'Tag',
    user: 'User',
    photo: 'Photo',
    video: 'Video',
    explore: 'Explore',
    search: 'Search'
  };
  elements.currentSourceType.textContent = typeLabels[source.type] || source.type;

  // Set name
  elements.currentSourceName.textContent = source.name || source.value;

  // Set link
  if (source.url) {
    elements.currentSourceLink.href = source.url;
    elements.currentSourceLink.style.display = 'inline';
  } else {
    elements.currentSourceLink.style.display = 'none';
  }

  // Set thumbnail (only for photos/videos)
  if (source.thumbnailUrl) {
    elements.currentSourceImage.src = source.thumbnailUrl;
    elements.currentSourceThumb.style.display = 'block';
  } else {
    elements.currentSourceThumb.style.display = 'none';
  }
}

// Get device info (doesn't actually test connection to avoid crashing EO1)
async function getDeviceInfo() {
  try {
    const result = await API.device.status();
    if (result.ip) {
      elements.deviceIp.value = result.ip;
    }
    return result;
  } catch (error) {
    console.error('Failed to get device info:', error);
    return null;
  }
}

// ============================================================================
// Preset Management
// ============================================================================

/**
 * Load all presets (built-in + custom) from the server
 */
async function loadPresets() {
  try {
    const result = await API.settings.getPresets();
    state.presets = result.presets;
    renderPresets();
  } catch (error) {
    console.error('Failed to load presets:', error);
  }
}

// Render presets
function renderPresets() {
  elements.presetGrid.innerHTML = '';

  for (const [id, preset] of Object.entries(state.presets)) {
    const card = document.createElement('div');
    card.className = `preset-card ${state.activePreset === id ? 'active' : ''}`;
    card.dataset.id = id;

    const typeLabels = {
      'tag': 'Tag',
      'user': 'User',
      'group': 'Group',
      'gallery': 'Gallery',
      'album': 'Album',
      'explore': 'Explore',
      'search': 'Search',
      'my-photos': 'You',
      'my-albums': 'Albums'
    };
    const typeLabel = typeLabels[preset.type] || preset.type;

    card.innerHTML = `
      <div class="preset-name">${preset.name}</div>
      <div class="preset-type-badge">${typeLabel}</div>
      ${!preset.builtin ? '<button class="delete-btn" title="Delete">×</button>' : ''}
    `;

    // Click to activate preset
    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('delete-btn')) {
        e.stopPropagation();
        deletePreset(id);
        return;
      }
      activatePreset(id, preset);
    });

    elements.presetGrid.appendChild(card);
  }
}

// Activate a preset
async function activatePreset(id, preset) {
  state.activePreset = id;
  renderPresets();

  // Load photos from this preset
  try {
    if (preset.type === 'tag') {
      // Skip filters for built-in community presets
      const noFilterPresets = ['community'];
      const useFilters = !noFilterPresets.includes(id);

      if (useFilters) {
        // Convert tag search to advanced search with current filters
        const searchParams = buildSearchParams(preset.tag);
        state.currentSearch = { type: 'search', value: preset.tag, searchParams };
        showFilterBar(true);
        syncFiltersToUI();
        await loadPhotos(searchParams, 'search');
      } else {
        // Use simple tag search without filters
        state.currentSearch = { type: 'tag', value: preset.tag };
        showFilterBar(false);
        await loadPhotos(preset.tag, 'tag');
      }

      // Also update the EO1 device
      await API.device.setTag(preset.tag, preset.name);
      showToast(`Switched to ${preset.name}`, 'success');

      // Update current source display
      updateCurrentSourceDisplay({
        type: 'tag',
        value: preset.tag,
        name: preset.name,
        url: `https://www.flickr.com/photos/tags/${encodeURIComponent(preset.tag)}/`
      });
    } else if (preset.type === 'my-photos') {
      // Get user's own photos using configured User ID
      const flickrSettings = await API.settings.getFlickr();
      if (!flickrSettings.userId) {
        showToast('Please add your Flickr User ID in Flickr API Settings', 'error');
        // Expand the Flickr settings section
        const flickrSettingsSection = document.getElementById('flickrSettings');
        if (flickrSettingsSection) {
          flickrSettingsSection.classList.remove('collapsed');
        }
        return;
      }
      state.flickrUserId = flickrSettings.userId;
      state.currentAlbum = null;
      state.currentSearch = { type: 'user', value: flickrSettings.userId };
      showFilterBar(false);
      await loadPhotos(flickrSettings.userId, 'user');
      showToast('Browsing your photos', 'success');
    } else if (preset.type === 'my-albums') {
      // Get user's albums
      const flickrSettings = await API.settings.getFlickr();
      if (!flickrSettings.userId) {
        showToast('Please add your Flickr User ID in Flickr API Settings', 'error');
        const flickrSettingsSection = document.getElementById('flickrSettings');
        if (flickrSettingsSection) {
          flickrSettingsSection.classList.remove('collapsed');
        }
        return;
      }
      state.flickrUserId = flickrSettings.userId;
      state.currentAlbum = null;
      showFilterBar(false);
      await loadAlbums(flickrSettings.userId);
      showToast('Browsing your albums', 'success');
    } else if (preset.type === 'explore') {
      // Get Flickr Explore (interestingness) photos
      state.currentSearch = { type: 'explore', value: 'explore' };
      showFilterBar(false);
      await loadPhotos('explore', 'explore');
      showToast(`Browsing ${preset.name}`, 'success');
    } else if (preset.type === 'search') {
      // Advanced text search with filters
      setFiltersFromSearchParams(preset.searchParams);
      state.currentSearch = { type: 'search', value: preset.searchParams.text, searchParams: preset.searchParams };
      showFilterBar(true);
      await loadPhotos(preset.searchParams, 'search');
      showToast(`Browsing ${preset.name}`, 'success');
    } else if (preset.type === 'group') {
      // Get group pool photos
      state.currentSearch = { type: 'group', value: preset.groupId };
      showFilterBar(false);
      await loadPhotos(preset.groupId, 'group');
      showToast(`Browsing ${preset.name}`, 'success');
    } else if (preset.type === 'gallery') {
      // Get gallery photos
      state.currentSearch = { type: 'gallery', value: preset.galleryId };
      showFilterBar(false);
      await loadPhotos(preset.galleryId, 'gallery');
      showToast(`Browsing ${preset.name}`, 'success');
    } else if (preset.type === 'album') {
      // Get album photos (needs both album ID and user ID)
      state.currentSearch = { type: 'album', value: preset.albumId, userId: preset.userId };
      showFilterBar(false);
      await loadAlbumPhotos(preset.albumId, preset.userId);
      showToast(`Browsing ${preset.name}`, 'success');
    } else {
      state.currentSearch = { type: 'user', value: preset.userId };
      showFilterBar(false);
      await loadPhotos(preset.userId, 'user');
      showToast(`Browsing ${preset.name}`, 'success');
    }
  } catch (error) {
    showToast(formatError('Failed to load photos', error), 'error');
  }
}

// Delete a preset
async function deletePreset(id) {
  if (!confirm('Delete this preset?')) return;

  try {
    await API.settings.deletePreset(id);
    delete state.presets[id];
    if (state.activePreset === id) {
      state.activePreset = null;
    }
    renderPresets();
    showToast('Preset deleted', 'success');
  } catch (error) {
    showToast(formatError('Failed to delete preset', error), 'error');
  }
}

// ============================================================================
// Photo Browsing
// ============================================================================

/**
 * Load photos from Flickr based on query and type
 * @param {string} query - Search term, user ID, group ID, or gallery ID
 * @param {string} type - 'tag', 'user', 'group', 'gallery', or 'album'
 * @param {number} page - Page number for pagination
 */
async function loadPhotos(query, type = 'tag', page = 1) {
  elements.photoGrid.innerHTML = '<div class="photo-grid-empty">Loading...</div>';
  elements.photoGrid.classList.add('loading');
  disablePaginationButtons();

  try {
    let result;
    if (type === 'tag') {
      result = await API.flickr.searchByTag(query, page);
    } else if (type === 'explore') {
      result = await API.flickr.getExplorePhotos(page);
    } else if (type === 'search') {
      // Advanced search - query is the searchParams object
      result = await API.flickr.advancedSearch(query, page);
    } else if (type === 'group') {
      result = await API.flickr.getGroupPhotos(query, page);
    } else if (type === 'gallery') {
      result = await API.flickr.getGalleryPhotos(query, page);
    } else {
      result = await API.flickr.getUserPhotos(query, page);
    }

    state.photos = result.photos;
    state.currentPage = result.page;
    state.totalPages = result.pages;

    renderPhotos();
    updatePagination();
  } catch (error) {
    elements.photoGrid.innerHTML = `<div class="photo-grid-empty">Error: ${error.message}</div>`;
    hidePagination();
  } finally {
    elements.photoGrid.classList.remove('loading');
  }
}

// Load albums
async function loadAlbums(userId) {
  elements.photoGrid.innerHTML = '<div class="photo-grid-empty">Loading albums...</div>';
  elements.photoGrid.classList.add('loading');
  hidePagination();

  try {
    const result = await API.flickr.getUserAlbums(userId);
    state.albums = result.albums;
    state.photos = [];
    renderAlbums();
  } catch (error) {
    elements.photoGrid.innerHTML = `<div class="photo-grid-empty">Error: ${error.message}</div>`;
  } finally {
    elements.photoGrid.classList.remove('loading');
  }
}

// Render albums
function renderAlbums() {
  if (!state.albums.length) {
    elements.photoGrid.innerHTML = '<div class="photo-grid-empty">No albums found</div>';
    return;
  }

  elements.photoGrid.innerHTML = '';

  for (const album of state.albums) {
    const card = document.createElement('div');
    card.className = 'album-card';
    card.dataset.id = album.id;

    const thumbUrl = album.primaryPhoto.thumbnailUrl || '';
    const count = album.photoCount + album.videoCount;

    card.innerHTML = `
      <div class="album-thumb" style="background-image: url('${thumbUrl}')"></div>
      <div class="album-info">
        <div class="album-title">${album.title || 'Untitled'}</div>
        <div class="album-count">${count} items</div>
      </div>
    `;

    card.addEventListener('click', () => openAlbum(album));
    elements.photoGrid.appendChild(card);
  }
}

// Open an album
async function openAlbum(album) {
  state.currentAlbum = album;
  state.currentSearch = { type: 'album', value: album.id, userId: state.flickrUserId };
  await loadAlbumPhotos(album.id, state.flickrUserId, 1);
}

// Load photos from album
async function loadAlbumPhotos(albumId, userId, page = 1) {
  elements.photoGrid.innerHTML = '<div class="photo-grid-empty">Loading...</div>';
  elements.photoGrid.classList.add('loading');
  disablePaginationButtons();

  try {
    const result = await API.flickr.getAlbumPhotos(albumId, userId, page);
    state.photos = result.photos;
    state.currentPage = result.page;
    state.totalPages = result.pages;
    renderPhotos();
    updatePagination();
  } catch (error) {
    elements.photoGrid.innerHTML = `<div class="photo-grid-empty">Error: ${error.message}</div>`;
    hidePagination();
  } finally {
    elements.photoGrid.classList.remove('loading');
  }
}

// Render photos
function renderPhotos() {
  if (!state.photos.length) {
    elements.photoGrid.innerHTML = '<div class="photo-grid-empty">No photos found</div>';
    return;
  }

  elements.photoGrid.innerHTML = '';

  // If viewing an album, show back button
  if (state.currentAlbum) {
    const backBar = document.createElement('div');
    backBar.className = 'album-back-bar';
    backBar.innerHTML = `
      <button class="btn btn-outline btn-sm" id="btnBackToAlbums">← Back to Albums</button>
      <span class="album-current-title">${state.currentAlbum.title}</span>
    `;
    elements.photoGrid.appendChild(backBar);

    backBar.querySelector('#btnBackToAlbums').addEventListener('click', () => {
      state.currentAlbum = null;
      renderAlbums();
    });
  }

  for (const photo of state.photos) {
    const card = document.createElement('div');
    card.dataset.id = photo.id;

    // Check orientation - portrait is optimised for EO1's 1080x1920 display
    const isPortrait = photo.width && photo.height && photo.height > photo.width;
    const isLandscape = photo.width && photo.height && photo.width > photo.height;

    // Add orientation class
    card.className = 'photo-card' + (isPortrait ? ' portrait' : '') + (isLandscape ? ' landscape' : '');

    card.innerHTML = `
      <img src="${photo.thumbnailUrl}" alt="${photo.title}" loading="lazy">
      ${photo.media === 'video' ? '<span class="media-badge">Video</span>' : ''}
      ${isPortrait ? '<span class="orientation-badge portrait" title="Portrait - optimised for EO1">▮</span>' : ''}
    `;

    card.addEventListener('click', () => openPreview(photo));
    elements.photoGrid.appendChild(card);
  }
}

// Hide both pagination elements
function hidePagination() {
  elements.paginationTop.style.display = 'none';
  elements.paginationBottom.style.display = 'none';
}

// Disable pagination buttons during loading
function disablePaginationButtons() {
  document.querySelectorAll('.pagination .btn-prev-page, .pagination .btn-next-page')
    .forEach(btn => btn.disabled = true);
}

// Update pagination (both top and bottom)
function updatePagination() {
  const paginationElements = [elements.paginationTop, elements.paginationBottom];

  if (state.totalPages <= 1) {
    paginationElements.forEach(el => el.style.display = 'none');
    return;
  }

  const prevDisabled = state.currentPage <= 1;
  const nextDisabled = state.currentPage >= state.totalPages;
  const pageText = `Page ${state.currentPage} of ${state.totalPages}`;

  paginationElements.forEach(el => {
    el.style.display = 'flex';
    el.querySelector('.btn-prev-page').disabled = prevDisabled;
    el.querySelector('.btn-next-page').disabled = nextDisabled;
    el.querySelector('.page-info').textContent = pageText;
  });
}

// ============================================================================
// Preview Modal & EO1 Display
// ============================================================================

/**
 * Open the preview modal for a photo
 * Shows larger image, dimensions, and orientation info
 */
function openPreview(photo) {
  state.selectedPhoto = photo;

  elements.previewTitle.textContent = photo.title || 'Untitled';

  // Build meta info with orientation
  const mediaType = photo.media === 'video' ? 'Video' : 'Photo';
  let metaText = mediaType;

  if (photo.width && photo.height) {
    const isPortrait = photo.height > photo.width;
    metaText += ` · ${photo.width}×${photo.height}`;
    if (isPortrait) {
      metaText += ' · Portrait ✓';
    } else {
      metaText += ' · Landscape';
    }
  }
  elements.previewMeta.textContent = metaText;

  // Show appropriate media
  if (photo.media === 'video') {
    elements.previewImage.style.display = 'none';
    elements.previewVideo.style.display = 'block';
    elements.previewVideo.src = photo.largeUrl || photo.mediumUrl;
  } else {
    elements.previewVideo.style.display = 'none';
    elements.previewImage.style.display = 'block';
    elements.previewImage.src = photo.largeUrl || photo.mediumUrl || photo.thumbnailUrl;
  }

  elements.previewModal.classList.add('open');
}

// Close preview modal
function closePreview() {
  elements.previewModal.classList.remove('open');
  elements.previewVideo.pause();
  elements.previewVideo.src = '';
  state.selectedPhoto = null;
}

// Display on EO1
async function displayOnEO1() {
  if (!state.selectedPhoto) return;

  const photo = state.selectedPhoto;

  // Check if landscape - warn user but allow display
  // EO1 display is 1080x1920 portrait
  if (photo.width && photo.height && photo.width > photo.height) {
    const proceed = confirm(
      'This image is landscape orientation.\n\n' +
      'The EO1 display is portrait (1080×1920), so this image may not look optimal.\n\n' +
      'Display anyway?'
    );
    if (!proceed) return;
  }

  try {
    const title = photo.title || 'Untitled';
    const mediaType = photo.media === 'video' ? 'video' : 'photo';

    if (photo.media === 'video') {
      await API.device.displayVideo(photo.id, title, photo.thumbnailUrl);
    } else {
      await API.device.displayImage(photo.id, title, photo.thumbnailUrl);
    }

    // Update current source display
    updateCurrentSourceDisplay({
      type: mediaType,
      value: photo.id,
      name: title,
      url: `https://www.flickr.com/photos/any/${photo.id}/`,
      thumbnailUrl: photo.thumbnailUrl
    });

    showToast('Displaying on EO1!', 'success');
    closePreview();
  } catch (error) {
    showToast(formatError('Failed to send to EO1', error), 'error');
  }
}

// ============================================================================
// Add Preset Modal
// ============================================================================

/**
 * Open the modal for adding a custom preset
 */
function openAddPresetModal() {
  elements.presetUrl.value = '';
  elements.presetName.value = '';
  elements.presetPreview.style.display = 'none';
  elements.addPresetModal.classList.add('open');
}

// Close add preset modal
function closeAddPresetModal() {
  elements.addPresetModal.classList.remove('open');
}

// Parse preset URL
async function parsePresetUrl() {
  const url = elements.presetUrl.value.trim();
  if (!url) {
    elements.presetPreview.style.display = 'none';
    return;
  }

  try {
    const result = await API.settings.parseUrl(url);
    elements.presetPreview.style.display = 'flex';
    elements.presetPreview.querySelector('.preset-type').textContent = result.type;
    elements.presetPreview.querySelector('.preset-value').textContent = result.value;
  } catch (error) {
    elements.presetPreview.style.display = 'none';
  }
}

// Save preset
async function savePreset() {
  const url = elements.presetUrl.value.trim();
  const name = elements.presetName.value.trim();

  if (!url || !name) {
    showToast('Please enter both URL and name', 'error');
    return;
  }

  try {
    const presetData = { url, name };

    // If "Apply filters" is checked, build searchParams from preset filter checkboxes
    if (elements.presetUseFilters.checked) {
      const searchParams = {};

      if (elements.presetFilterPortrait.checked) searchParams.orientation = 'portrait';
      if (elements.presetFilterMinSize.checked) {
        searchParams.min_width = 1024;
        searchParams.min_height = 1024;
      }
      if (elements.presetFilterRecent.checked) {
        searchParams.min_taken_date = Math.floor(Date.now() / 1000) - (90 * 24 * 60 * 60);
      }
      if (elements.presetFilterInteresting.checked) searchParams.sort = 'interestingness-desc';
      if (elements.presetFilterGallery.checked) searchParams.in_gallery = true;
      if (elements.presetFilterGetty.checked) searchParams.is_getty = true;
      if (elements.presetFilterCommons.checked) searchParams.is_commons = true;

      const styles = [];
      if (elements.presetFilterBW.checked) styles.push('blackandwhite');
      if (elements.presetFilterDOF.checked) styles.push('depthoffield');
      if (elements.presetFilterMinimal.checked) styles.push('minimalism');
      if (elements.presetFilterPattern.checked) styles.push('pattern');
      if (styles.length) searchParams.styles = styles.join(',');

      presetData.searchParams = searchParams;
    }

    const result = await API.settings.addPreset(presetData);
    state.presets[result.preset.id] = result.preset;
    renderPresets();
    closeAddPresetModal();
    showToast('Preset saved!', 'success');
  } catch (error) {
    showToast(formatError('Failed to save preset', error), 'error');
  }
}

// Populate quiet hours dropdowns
function populateHourDropdowns() {
  for (let i = 0; i < 24; i++) {
    const hour = i.toString().padStart(2, '0') + ':00';
    elements.quietStart.innerHTML += `<option value="${i}">${hour}</option>`;
    elements.quietEnd.innerHTML += `<option value="${i}">${hour}</option>`;
  }
}

// ============================================================================
// Settings Management
// ============================================================================

/**
 * Load and display Flickr API settings
 */
async function loadFlickrSettings() {
  try {
    const flickr = await API.settings.getFlickr();

    // Update status badge
    const statusBadge = elements.flickrStatus.querySelector('.status-badge');
    if (flickr.hasApiKey) {
      statusBadge.textContent = 'Configured';
      statusBadge.className = 'status-badge configured';

      // Show source of configuration
      if (flickr.source) {
        elements.flickrSource.textContent = `from ${flickr.source}`;
        elements.flickrSource.style.display = 'inline';
      }
    } else {
      statusBadge.textContent = 'Not Configured';
      statusBadge.className = 'status-badge not-configured';
      elements.flickrSource.style.display = 'none';
    }

    // Show masked values in inputs as placeholders
    if (flickr.apiKey) {
      elements.flickrApiKey.placeholder = flickr.apiKey;
    }
    if (flickr.userId) {
      elements.flickrUserId.value = flickr.userId;
    }
  } catch (error) {
    console.error('Failed to load Flickr settings:', error);
  }
}

// Save Flickr settings
async function saveFlickrSettings() {
  const apiKey = elements.flickrApiKey.value.trim();
  const userId = elements.flickrUserId.value.trim();

  // Only send values that were entered (not empty)
  const updates = {};
  if (apiKey) updates.apiKey = apiKey;
  if (userId !== undefined) updates.userId = userId;

  if (Object.keys(updates).length === 0) {
    showToast('No changes to save', 'info');
    return;
  }

  try {
    const result = await API.settings.updateFlickr(updates);

    // Clear the input field (it'll show masked value as placeholder)
    elements.flickrApiKey.value = '';

    // Update placeholder with new masked value
    if (result.flickr.apiKey) {
      elements.flickrApiKey.placeholder = result.flickr.apiKey;
    }

    // Update status
    const statusBadge = elements.flickrStatus.querySelector('.status-badge');
    if (result.flickr.hasApiKey) {
      statusBadge.textContent = 'Configured';
      statusBadge.className = 'status-badge configured';
    }

    showToast('Flickr settings saved!', 'success');
  } catch (error) {
    showToast(formatError('Failed to save Flickr settings', error), 'error');
  }
}

// Setup collapsible sections
function setupCollapsibles() {
  document.querySelectorAll('.collapsible-header').forEach(header => {
    header.addEventListener('click', () => {
      const targetId = header.dataset.target;
      const content = document.getElementById(targetId);
      content.classList.toggle('collapsed');
    });
  });
}

// ============================================================================
// Event Listeners
// ============================================================================

/**
 * Set up all event listeners for UI interactions
 */
function setupEventListeners() {
  // Quick controls
  elements.btnSkip.addEventListener('click', async () => {
    try {
      await API.device.skip();
      showToast('Skipped to next', 'success');
    } catch (error) {
      showToast(formatError('Skip failed', error), 'error');
    }
  });

  elements.btnScreenToggle.addEventListener('click', async () => {
    try {
      // Switch to manual brightness mode
      elements.autoBrightness.checked = false;
      elements.brightnessSlider.disabled = false;

      // Toggle between off (0%) and on (50%)
      const current = parseInt(elements.brightnessSlider.value) / 100;
      if (current === 0) {
        await API.device.setBrightness(0.5);
        elements.brightnessSlider.value = 50;
        elements.brightnessValue.textContent = '50%';
        updateScreenButton(true);
        showToast('Screen on', 'success');
      } else {
        await API.device.setBrightness(0);
        elements.brightnessSlider.value = 0;
        elements.brightnessValue.textContent = '0%';
        updateScreenButton(false);
        showToast('Screen off', 'success');
      }
    } catch (error) {
      showToast(formatError('Screen toggle failed', error), 'error');
    }
  });

  // Brightness
  elements.autoBrightness.addEventListener('change', async () => {
    const auto = elements.autoBrightness.checked;
    elements.brightnessSlider.disabled = auto;

    try {
      if (auto) {
        await API.device.setBrightness(null);
      } else {
        await API.device.setBrightness(parseInt(elements.brightnessSlider.value) / 100);
      }
    } catch (error) {
      showToast(formatError('Brightness failed', error), 'error');
    }
  });

  let brightnessTimeout;
  elements.brightnessSlider.addEventListener('input', () => {
    const value = parseInt(elements.brightnessSlider.value);
    elements.brightnessValue.textContent = value + '%';
    updateScreenButton(value > 0);

    clearTimeout(brightnessTimeout);
    brightnessTimeout = setTimeout(async () => {
      try {
        await API.device.setBrightness(value / 100);
      } catch (error) {
        showToast(formatError('Brightness failed', error), 'error');
      }
    }, 300);
  });

  // Presets
  elements.btnAddPreset.addEventListener('click', openAddPresetModal);
  elements.btnCloseAddPreset.addEventListener('click', closeAddPresetModal);
  elements.addPresetModal.querySelector('.modal-backdrop').addEventListener('click', closeAddPresetModal);
  elements.presetUrl.addEventListener('input', parsePresetUrl);
  elements.btnSavePreset.addEventListener('click', savePreset);

  // Preset filter toggle
  elements.presetUseFilters.addEventListener('change', () => {
    elements.presetFilterOptions.style.display = elements.presetUseFilters.checked ? 'block' : 'none';
  });

  // Filter checkboxes
  const filterCheckboxes = [
    elements.filterPortrait, elements.filterMinSize, elements.filterRecent,
    elements.filterInteresting, elements.filterGallery, elements.filterGetty,
    elements.filterCommons, elements.filterBW, elements.filterDOF,
    elements.filterMinimal, elements.filterPattern
  ];
  filterCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', onFilterChange);
  });

  // Search
  elements.btnSearch.addEventListener('click', () => {
    const query = elements.searchInput.value.trim();
    if (query) {
      // Use advanced search with current filters
      const searchParams = buildSearchParams(query);
      state.currentSearch = { type: 'search', value: query, searchParams };
      state.activePreset = null;
      renderPresets();
      showFilterBar(true);
      syncFiltersToUI();
      loadPhotos(searchParams, 'search');
    }
  });

  elements.searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      elements.btnSearch.click();
    }
  });

  // Pagination (both top and bottom)
  document.querySelectorAll('.pagination .btn-prev-page').forEach(btn => {
    btn.addEventListener('click', () => {
      if (state.currentSearch && state.currentPage > 1) {
        if (state.currentSearch.type === 'album') {
          loadAlbumPhotos(state.currentSearch.value, state.currentSearch.userId, state.currentPage - 1);
        } else if (state.currentSearch.type === 'search') {
          // Advanced search needs full searchParams object, not just the text value
          loadPhotos(state.currentSearch.searchParams, state.currentSearch.type, state.currentPage - 1);
        } else {
          loadPhotos(state.currentSearch.value, state.currentSearch.type, state.currentPage - 1);
        }
      }
    });
  });

  document.querySelectorAll('.pagination .btn-next-page').forEach(btn => {
    btn.addEventListener('click', () => {
      if (state.currentSearch && state.currentPage < state.totalPages) {
        if (state.currentSearch.type === 'album') {
          loadAlbumPhotos(state.currentSearch.value, state.currentSearch.userId, state.currentPage + 1);
        } else if (state.currentSearch.type === 'search') {
          // Advanced search needs full searchParams object, not just the text value
          loadPhotos(state.currentSearch.searchParams, state.currentSearch.type, state.currentPage + 1);
        } else {
          loadPhotos(state.currentSearch.value, state.currentSearch.type, state.currentPage + 1);
        }
      }
    });
  });

  // Preview modal
  elements.btnClosePreview.addEventListener('click', closePreview);
  elements.previewModal.querySelector('.modal-backdrop').addEventListener('click', closePreview);
  elements.btnDisplayOnEO1.addEventListener('click', displayOnEO1);

  // Slideshow settings
  elements.btnApplySettings.addEventListener('click', async () => {
    try {
      const brightness = elements.autoBrightness.checked ? -1 : parseInt(elements.brightnessSlider.value) / 100;
      const interval = parseInt(elements.interval.value) || 5;
      const startHour = parseInt(elements.quietStart.value);
      const endHour = parseInt(elements.quietEnd.value);

      await API.device.setOptions({ brightness, interval, startHour, endHour });
      showToast('Settings applied!', 'success');
    } catch (error) {
      showToast(formatError('Failed to apply settings', error), 'error');
    }
  });

  // Device settings
  elements.btnTestConnection.addEventListener('click', async () => {
    const ip = elements.deviceIp.value.trim();
    if (!ip) {
      showToast('Please enter an IP address', 'error');
      return;
    }
    try {
      await API.settings.update({ deviceIp: ip });
      // Try sending a skip command to test - if it works, device is connected
      await API.device.skip();
      showToast('Connected! Skipped to next image.', 'success');
    } catch (error) {
      showToast(formatError('Connection failed', error), 'error');
    }
  });

  elements.btnSaveDevice.addEventListener('click', async () => {
    const ip = elements.deviceIp.value.trim();
    if (ip) {
      try {
        await API.settings.update({ deviceIp: ip });
        showToast('Device IP saved!', 'success');
      } catch (error) {
        showToast(formatError('Failed to save device IP', error), 'error');
      }
    }
  });

  // Network scanning
  elements.btnScanNetwork.addEventListener('click', async () => {
    elements.btnScanNetwork.disabled = true;
    elements.scanStatus.textContent = 'Scanning for EO1 on port 12345...';
    elements.scanResults.style.display = 'none';

    try {
      const result = await API.device.scanNetwork();

      if (result.devices && result.devices.length > 0) {
        elements.foundDevices.innerHTML = '';
        for (const ip of result.devices) {
          const option = document.createElement('option');
          option.value = ip;
          option.textContent = ip;
          elements.foundDevices.appendChild(option);
        }
        elements.scanResults.style.display = 'flex';
        elements.scanStatus.textContent = `Found ${result.devices.length} EO1 on ${result.subnet}.*`;
        showToast(`Found ${result.devices.length} EO1 device(s)`, 'success');
      } else {
        elements.scanStatus.textContent = `No EO1 found on ${result.subnet}.*`;
        showToast('No EO1 found on network', 'info');
      }
    } catch (error) {
      elements.scanStatus.textContent = 'Scan failed';
      showToast('EO1 scan failed: ' + error.message, 'error');
    } finally {
      elements.btnScanNetwork.disabled = false;
    }
  });

  elements.btnUseDevice.addEventListener('click', () => {
    const selectedIp = elements.foundDevices.value;
    if (selectedIp) {
      elements.deviceIp.value = selectedIp;
      showToast(`Selected ${selectedIp}`, 'success');
    }
  });

  // Flickr settings
  elements.btnSaveFlickr.addEventListener('click', saveFlickrSettings);
}

// ============================================================================
// Application Initialisation
// ============================================================================

/**
 * Initialise the application
 * Called once when the page loads
 */
async function init() {
  populateHourDropdowns();
  setupCollapsibles();
  setupEventListeners();

  // Initialize filter checkboxes to match default state
  syncFiltersToUI();

  // Load data (skip connection check - it can crash the EO1 app)
  await Promise.all([
    getDeviceInfo(),
    loadPresets(),
    loadFlickrSettings(),
    loadCurrentSource()
  ]);

  // Don't auto-check connection - it opens/closes sockets which can crash EO1
  // User can manually test connection in Device Settings
}

// Start the app
init();
