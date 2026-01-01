/**
 * EO1 Web Controller - API Client
 * Handles all REST API communication with the backend
 */

const API = {
  baseUrl: '',  // Same origin

  /**
   * Make an API request
   */
  async request(method, endpoint, data = null) {
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, options);
    const json = await response.json();

    if (!response.ok) {
      throw new Error(json.error || json.message || `API Error: ${response.status}`);
    }

    return json;
  },

  // Device Control
  device: {
    /**
     * Check device connection status
     */
    status: () => API.request('GET', '/api/device/status'),

    /**
     * Skip to next slideshow item
     */
    skip: () => API.request('POST', '/api/device/skip'),

    /**
     * Resume slideshow
     */
    resume: () => API.request('POST', '/api/device/resume'),

    /**
     * Display a specific image
     */
    displayImage: (photoId, title, thumbnailUrl, owner) => API.request('POST', `/api/device/image/${photoId}`, { title, thumbnailUrl, owner }),

    /**
     * Display a specific video
     */
    displayVideo: (photoId, title, thumbnailUrl, owner) => API.request('POST', `/api/device/video/${photoId}`, { title, thumbnailUrl, owner }),

    /**
     * Set brightness level
     * @param {number|null} level - 0.0-1.0, or null for auto
     */
    setBrightness: (level) => {
      if (level === null) {
        return API.request('POST', '/api/device/brightness', { auto: true });
      }
      return API.request('POST', '/api/device/brightness', { level });
    },

    /**
     * Change the Flickr tag
     */
    setTag: (tag, name) => API.request('POST', '/api/device/tag', { tag, name }),

    /**
     * Update multiple settings at once
     */
    setOptions: (options) => API.request('POST', '/api/device/options', options),

    /**
     * Scan network for EO1 devices
     */
    scanNetwork: (subnet) => API.request('POST', '/api/device/scan', { subnet })
  },

  // Flickr Browser
  flickr: {
    /**
     * Get photos from a user
     */
    getUserPhotos: (userId, page = 1) =>
      API.request('GET', `/api/flickr/user/${encodeURIComponent(userId)}/photos?page=${page}`),

    /**
     * Search photos by tag
     */
    searchByTag: (tag, page = 1) =>
      API.request('GET', `/api/flickr/search?tags=${encodeURIComponent(tag)}&page=${page}`),

    /**
     * Get available sizes for a photo
     */
    getPhotoSizes: (photoId) =>
      API.request('GET', `/api/flickr/photo/${photoId}/sizes`),

    /**
     * Get photo info
     */
    getPhotoInfo: (photoId) =>
      API.request('GET', `/api/flickr/photo/${photoId}/info`),

    /**
     * Get user's albums/photosets
     */
    getUserAlbums: (userId) =>
      API.request('GET', `/api/flickr/user/${encodeURIComponent(userId)}/albums`),

    /**
     * Get photos from an album
     */
    getAlbumPhotos: (albumId, userId, page = 1) =>
      API.request('GET', `/api/flickr/album/${albumId}/photos?user_id=${encodeURIComponent(userId)}&page=${page}`),

    /**
     * Get photos from a group pool
     */
    getGroupPhotos: (groupId, page = 1) =>
      API.request('GET', `/api/flickr/group/${encodeURIComponent(groupId)}/photos?page=${page}`),

    /**
     * Get photos from a gallery
     */
    getGalleryPhotos: (galleryId, page = 1) =>
      API.request('GET', `/api/flickr/gallery/${encodeURIComponent(galleryId)}/photos?page=${page}`),

    /**
     * Get interesting photos from Flickr Explore
     */
    getExplorePhotos: (page = 1) =>
      API.request('GET', `/api/flickr/explore?page=${page}`),

    /**
     * Advanced text search with filters
     */
    advancedSearch: (searchParams, page = 1) =>
      API.request('POST', `/api/flickr/search/advanced?page=${page}`, searchParams)
  },

  // Settings
  settings: {
    /**
     * Get current settings
     */
    get: () => API.request('GET', '/api/settings'),

    /**
     * Update settings
     */
    update: (settings) => API.request('PUT', '/api/settings', settings),

    /**
     * Get Flickr settings
     */
    getFlickr: () => API.request('GET', '/api/settings/flickr'),

    /**
     * Update Flickr settings
     */
    updateFlickr: (settings) => API.request('PUT', '/api/settings/flickr', settings),

    /**
     * Get slideshow settings
     */
    getSlideshow: () => API.request('GET', '/api/settings/slideshow'),

    /**
     * Update slideshow settings
     */
    updateSlideshow: (settings) => API.request('PUT', '/api/settings/slideshow', settings),

    /**
     * Get all presets
     */
    getPresets: () => API.request('GET', '/api/settings/presets'),

    /**
     * Add a new preset
     */
    addPreset: (preset) => API.request('POST', '/api/settings/presets', preset),

    /**
     * Delete a preset
     */
    deletePreset: (id) => API.request('DELETE', `/api/settings/presets/${id}`),

    /**
     * Parse a Flickr URL
     */
    parseUrl: (url) => API.request('POST', '/api/settings/parse-url', { url }),

    /**
     * Get current source being displayed on EO1
     */
    getCurrentSource: () => API.request('GET', '/api/settings/current-source'),

    /**
     * Update current source
     */
    setCurrentSource: (source) => API.request('PUT', '/api/settings/current-source', source),

    /**
     * Get display history
     */
    getHistory: () => API.request('GET', '/api/settings/history'),

    /**
     * Clear all display history
     */
    clearHistory: () => API.request('DELETE', '/api/settings/history'),

    /**
     * Remove a single photo from history
     */
    removeFromHistory: (photoId) => API.request('DELETE', `/api/settings/history/${photoId}`)
  }
};
