/**
 * Flickr API Client
 * Wrapper for Flickr REST API calls
 *
 * API Methods used:
 * - flickr.photos.search - Search photos by tags
 * - flickr.people.getPublicPhotos - Get user's public photos
 * - flickr.photos.getSizes - Get available sizes for a photo
 * - flickr.photos.getInfo - Get photo metadata
 */

const axios = require('axios');

class FlickrClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.flickr.com/services/rest/';
  }

  /**
   * Make a request to the Flickr API
   * @param {string} method - Flickr API method name
   * @param {Object} params - Additional query parameters
   * @returns {Promise<Object>}
   */
  async request(method, params = {}) {
    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          method,
          api_key: this.apiKey,
          format: 'json',
          nojsoncallback: 1,
          ...params
        },
        headers: {
          'User-Agent': 'EO1-Web-Controller/1.0'
        }
      });

      if (response.data.stat === 'fail') {
        throw new Error(response.data.message || 'Flickr API error');
      }

      return response.data;
    } catch (error) {
      if (error.response) {
        throw new Error(`Flickr API error: ${error.response.status}`);
      }
      throw error;
    }
  }

  /**
   * Get public photos from a user
   * @param {string} userId - Flickr user ID (e.g., "157826401@N07")
   * @param {number} page - Page number (default: 1)
   * @param {number} perPage - Items per page (default: 24, max: 500)
   * @returns {Promise<Object>}
   */
  async getUserPhotos(userId, page = 1, perPage = 24) {
    return this.request('flickr.people.getPublicPhotos', {
      user_id: userId,
      per_page: Math.min(perPage, 500),
      page,
      extras: 'media,url_sq,url_m,url_l,url_o,original_format,o_dims,width_l,height_l,width_m,height_m',
      sort: 'date-posted-desc'  // Newest first, matches Flickr website
    });
  }

  /**
   * Search photos by tag(s)
   * @param {string} tags - Comma-separated tag names
   * @param {number} page - Page number (default: 1)
   * @param {number} perPage - Items per page (default: 24, max: 500)
   * @returns {Promise<Object>}
   */
  async searchByTag(tags, page = 1, perPage = 24) {
    return this.request('flickr.photos.search', {
      tags,
      per_page: Math.min(perPage, 500),
      page,
      extras: 'media,url_sq,url_m,url_l,url_o,original_format,o_dims,width_l,height_l,width_m,height_m',
      sort: 'date-posted-desc'  // Newest first
    });
  }

  /**
   * Get available sizes for a photo
   * @param {string} photoId - Flickr photo ID
   * @returns {Promise<Object>}
   */
  async getPhotoSizes(photoId) {
    return this.request('flickr.photos.getSizes', {
      photo_id: photoId
    });
  }

  /**
   * Get detailed info about a photo
   * @param {string} photoId - Flickr photo ID
   * @returns {Promise<Object>}
   */
  async getPhotoInfo(photoId) {
    return this.request('flickr.photos.getInfo', {
      photo_id: photoId
    });
  }

  /**
   * Get a user's photosets/albums
   * @param {string} userId - Flickr user ID
   * @returns {Promise<Object>}
   */
  async getPhotosets(userId) {
    return this.request('flickr.photosets.getList', {
      user_id: userId,
      per_page: 100,
      primary_photo_extras: 'url_sq,url_m'
    });
  }

  /**
   * Get photos from a photoset/album
   * @param {string} photosetId - Photoset ID
   * @param {string} userId - Owner's user ID
   * @param {number} page - Page number
   * @param {number} perPage - Items per page
   * @returns {Promise<Object>}
   */
  async getPhotosetPhotos(photosetId, userId, page = 1, perPage = 24) {
    return this.request('flickr.photosets.getPhotos', {
      photoset_id: photosetId,
      user_id: userId,
      page,
      per_page: Math.min(perPage, 500),
      extras: 'media,url_sq,url_m,url_l,url_o,original_format,o_dims,width_l,height_l,width_m,height_m'
    });
  }

  /**
   * Look up a user by URL (to get user ID from profile URL)
   * @param {string} url - Flickr profile URL
   * @returns {Promise<Object>}
   */
  async lookupUser(url) {
    return this.request('flickr.urls.lookupUser', {
      url
    });
  }

  /**
   * Get photos from a group pool
   * @param {string} groupId - Flickr group ID (e.g., "14660092@N20")
   * @param {number} page - Page number
   * @param {number} perPage - Items per page
   * @returns {Promise<Object>}
   */
  async getGroupPhotos(groupId, page = 1, perPage = 24) {
    return this.request('flickr.groups.pools.getPhotos', {
      group_id: groupId,
      page,
      per_page: Math.min(perPage, 500),
      extras: 'media,url_sq,url_m,url_l,url_o,original_format,o_dims,width_l,height_l,width_m,height_m'
    });
  }

  /**
   * Get group info
   * @param {string} groupId - Flickr group ID
   * @returns {Promise<Object>}
   */
  async getGroupInfo(groupId) {
    return this.request('flickr.groups.getInfo', {
      group_id: groupId
    });
  }

  /**
   * Get photos from a gallery
   * @param {string} galleryId - Flickr gallery ID (e.g., "72157724539560761")
   * @param {number} page - Page number
   * @param {number} perPage - Items per page
   * @returns {Promise<Object>}
   */
  async getGalleryPhotos(galleryId, page = 1, perPage = 24) {
    return this.request('flickr.galleries.getPhotos', {
      gallery_id: galleryId,
      page,
      per_page: Math.min(perPage, 500),
      extras: 'media,url_sq,url_m,url_l,url_o,original_format,o_dims,width_l,height_l,width_m,height_m'
    });
  }

  /**
   * Parse a Flickr URL to extract type and identifier
   * @param {string} url - Flickr URL
   * @returns {Object} - { type: 'user'|'tag'|'group'|'gallery', value: string }
   */
  static parseFlickrUrl(url) {
    // Normalise URL
    let normalised = url.trim();
    if (!normalised.startsWith('http')) {
      normalised = 'https://' + normalised;
    }

    try {
      const parsed = new URL(normalised);

      // Check if it's a Flickr URL
      if (!parsed.hostname.includes('flickr.com')) {
        return null;
      }

      const path = parsed.pathname;

      // Group pool URL: flickr.com/groups/GROUP_ID/pool/
      const groupMatch = path.match(/\/groups\/([^/]+)/i);
      if (groupMatch) {
        return { type: 'group', value: decodeURIComponent(groupMatch[1]) };
      }

      // Gallery URL: flickr.com/photos/USERNAME/galleries/GALLERY_ID/
      const galleryMatch = path.match(/\/photos\/[^/]+\/galleries\/(\d+)/i);
      if (galleryMatch) {
        return { type: 'gallery', value: decodeURIComponent(galleryMatch[1]) };
      }

      // Tag URL: flickr.com/photos/tags/TAGNAME
      const tagMatch = path.match(/\/photos\/tags\/([^/]+)/i);
      if (tagMatch) {
        return { type: 'tag', value: decodeURIComponent(tagMatch[1]) };
      }

      // User URL: flickr.com/photos/USERNAME or flickr.com/photos/USER_ID
      const userMatch = path.match(/\/photos\/([^/]+)/i);
      if (userMatch) {
        const userId = decodeURIComponent(userMatch[1]);
        // Skip 'tags' as it's handled above
        if (userId !== 'tags') {
          return { type: 'user', value: userId };
        }
      }

      return null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Update the API key
   * @param {string} apiKey - New API key
   */
  setApiKey(apiKey) {
    this.apiKey = apiKey;
  }
}

module.exports = FlickrClient;
