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
   * Advanced text search with filters
   * @param {Object} searchParams - Search parameters
   * @param {string} searchParams.text - Text to search for
   * @param {string} [searchParams.orientation] - square, landscape, portrait, panorama
   * @param {number} [searchParams.min_width] - Minimum width
   * @param {number} [searchParams.min_height] - Minimum height
   * @param {number} [searchParams.content_type] - 1=photos, 2=screenshots, 3=other, 4=photos+screenshots
   * @param {number} page - Page number
   * @param {number} perPage - Items per page
   * @returns {Promise<Object>}
   */
  async advancedSearch(searchParams, page = 1, perPage = 24) {
    const params = {
      text: searchParams.text,
      per_page: Math.min(perPage, 500),
      page,
      extras: 'media,url_sq,url_m,url_l,url_o,original_format,o_dims,width_l,height_l,width_m,height_m',
      sort: 'relevance'  // Most relevant for text search
    };

    // Add optional filters
    if (searchParams.orientation) {
      params.orientation = searchParams.orientation;
    }
    if (searchParams.min_width) {
      params.min_upload_date = undefined;  // Clear any defaults
      params.dimension_search_mode = 'min';
      params.width = searchParams.min_width;
    }
    if (searchParams.min_height) {
      params.dimension_search_mode = 'min';
      params.height = searchParams.min_height;
    }
    if (searchParams.content_type) {
      params.content_type = searchParams.content_type;
    }

    return this.request('flickr.photos.search', params);
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
   * Resolve a username to an NSID
   * @param {string} username - Flickr username or path name
   * @returns {Promise<string>} - The user's NSID (e.g., "12345678@N00")
   */
  async resolveUserId(username) {
    // If it already looks like an NSID, return it
    if (username.includes('@')) {
      return username;
    }

    // Look up the user by their profile URL
    const profileUrl = `https://www.flickr.com/photos/${username}/`;
    const result = await this.lookupUser(profileUrl);
    return result.user.id;
  }

  /**
   * Look up a group by URL (to get group ID from group URL)
   * @param {string} url - Flickr group URL
   * @returns {Promise<Object>}
   */
  async lookupGroup(url) {
    return this.request('flickr.urls.lookupGroup', {
      url
    });
  }

  /**
   * Resolve a group path/slug to an NSID
   * @param {string} groupPath - Flickr group path or NSID
   * @returns {Promise<string>} - The group's NSID (e.g., "12345678@N00")
   */
  async resolveGroupId(groupPath) {
    // If it already looks like an NSID, return it
    if (groupPath.includes('@')) {
      return groupPath;
    }

    // Look up the group by their URL
    const groupUrl = `https://www.flickr.com/groups/${groupPath}/`;
    const result = await this.lookupGroup(groupUrl);
    return result.group.id;
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
   * Get interesting photos from Flickr Explore
   * @param {number} page - Page number
   * @param {number} perPage - Items per page
   * @returns {Promise<Object>}
   */
  async getInterestingPhotos(page = 1, perPage = 24) {
    return this.request('flickr.interestingness.getList', {
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

      // Search URL: flickr.com/search/?text=...
      if (path.match(/^\/search\/?$/i)) {
        const params = parsed.searchParams;
        const searchParams = {};

        // Text query (required)
        const text = params.get('text');
        if (!text) {
          return null;  // Search URL without text query
        }
        searchParams.text = text;

        // Orientation filter
        const orientation = params.get('orientation');
        if (orientation) {
          searchParams.orientation = orientation;  // square, landscape, portrait, panorama
        }

        // Dimension filters
        const minWidth = params.get('width');
        const minHeight = params.get('height');
        if (minWidth) searchParams.min_width = parseInt(minWidth);
        if (minHeight) searchParams.min_height = parseInt(minHeight);

        // Content type (0=photos, 2=screenshots)
        const contentTypes = params.get('content_types');
        if (contentTypes) {
          // Map Flickr web content_types to API content_type
          // Web uses 0=photos, 2=screenshots; API uses 1=photos, 2=screenshots, 3=other
          const types = contentTypes.split(',').map(t => parseInt(t));
          if (types.includes(0) && types.includes(2)) {
            searchParams.content_type = 4;  // photos and screenshots
          } else if (types.includes(0)) {
            searchParams.content_type = 1;  // photos only
          } else if (types.includes(2)) {
            searchParams.content_type = 2;  // screenshots only
          }
        }

        return {
          type: 'search',
          value: text,
          searchParams
        };
      }

      // Explore URL: flickr.com/explore/
      if (path.match(/^\/explore\/?$/i)) {
        return { type: 'explore', value: 'explore' };
      }

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

      // Album URL: flickr.com/photos/USERNAME/albums/ALBUM_ID/
      const albumMatch = path.match(/\/photos\/([^/]+)\/albums\/(\d+)/i);
      if (albumMatch) {
        return {
          type: 'album',
          value: decodeURIComponent(albumMatch[2]),
          userId: decodeURIComponent(albumMatch[1])
        };
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
