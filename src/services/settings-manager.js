/**
 * Settings Manager
 * Handles persistent storage of app settings (API keys, device config, etc.)
 */

const fs = require('fs').promises;
const path = require('path');

const SETTINGS_FILE = path.join(__dirname, '../../config/settings.json');

class SettingsManager {
  constructor() {
    this.settings = null;
    this.loaded = false;
  }

  /**
   * Load settings from file
   */
  async load() {
    try {
      const data = await fs.readFile(SETTINGS_FILE, 'utf8');
      this.settings = JSON.parse(data);
      this.loaded = true;
    } catch (error) {
      // Create default settings if file doesn't exist
      this.settings = {
        flickr: {
          apiKey: process.env.FLICKR_API_KEY || '',
          userId: process.env.FLICKR_USER_ID || ''
        },
        device: {
          ip: process.env.EO1_IP || '',
          port: parseInt(process.env.EO1_PORT) || 12345
        },
        currentSource: null,  // Tracks what's currently displayed on EO1
        displayHistory: []     // Recently displayed photos (max 30)
      };
      await this.save();
      this.loaded = true;
    }

    // Override with env vars if settings file values are empty
    if (!this.settings.flickr.apiKey && process.env.FLICKR_API_KEY) {
      this.settings.flickr.apiKey = process.env.FLICKR_API_KEY;
    }
    if (!this.settings.flickr.userId && process.env.FLICKR_USER_ID) {
      this.settings.flickr.userId = process.env.FLICKR_USER_ID;
    }

    return this.settings;
  }

  /**
   * Save settings to file
   */
  async save() {
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(this.settings, null, 2));
  }

  /**
   * Get all settings
   */
  async getAll() {
    if (!this.loaded) {
      await this.load();
    }
    return this.settings;
  }

  /**
   * Get Flickr settings with source information
   */
  async getFlickr() {
    if (!this.loaded) {
      await this.load();
    }

    // Determine the source of the API key
    let source = null;
    if (this.settings.flickr.apiKey) {
      // Check if it matches the env var (meaning it came from .env or was never changed)
      if (process.env.FLICKR_API_KEY && this.settings.flickr.apiKey === process.env.FLICKR_API_KEY) {
        source = '.env file';
      } else {
        source = 'saved settings';
      }
    }

    return {
      ...this.settings.flickr,
      source
    };
  }

  /**
   * Update Flickr settings
   */
  async updateFlickr(flickrSettings) {
    if (!this.loaded) {
      await this.load();
    }
    this.settings.flickr = {
      ...this.settings.flickr,
      ...flickrSettings
    };
    await this.save();
    return this.settings.flickr;
  }

  /**
   * Get device settings
   */
  async getDevice() {
    if (!this.loaded) {
      await this.load();
    }
    return this.settings.device;
  }

  /**
   * Update device settings
   */
  async updateDevice(deviceSettings) {
    if (!this.loaded) {
      await this.load();
    }
    this.settings.device = {
      ...this.settings.device,
      ...deviceSettings
    };
    await this.save();
    return this.settings.device;
  }

  /**
   * Get the current API key
   */
  async getApiKey() {
    if (!this.loaded) {
      await this.load();
    }
    return this.settings.flickr.apiKey;
  }

  /**
   * Get current source (what's displaying on EO1)
   */
  async getCurrentSource() {
    if (!this.loaded) {
      await this.load();
    }
    return this.settings.currentSource || null;
  }

  /**
   * Update current source
   * @param {Object} source - { type: 'tag'|'user'|'photo', value: string, name?: string, url?: string }
   */
  async setCurrentSource(source) {
    if (!this.loaded) {
      await this.load();
    }
    this.settings.currentSource = {
      ...source,
      updatedAt: new Date().toISOString()
    };
    await this.save();
    return this.settings.currentSource;
  }

  /**
   * Get display history
   * @returns {Array} - Array of recently displayed photos
   */
  async getHistory() {
    if (!this.loaded) {
      await this.load();
    }
    return this.settings.displayHistory || [];
  }

  /**
   * Add a photo to display history
   * @param {Object} photo - { id, owner, title, thumbnailUrl, media }
   */
  async addToHistory(photo) {
    if (!this.loaded) {
      await this.load();
    }

    // Ensure displayHistory exists
    if (!this.settings.displayHistory) {
      this.settings.displayHistory = [];
    }

    // Remove if already exists (to move to front)
    this.settings.displayHistory = this.settings.displayHistory.filter(p => p.id !== photo.id);

    // Add to front with timestamp
    this.settings.displayHistory.unshift({
      id: photo.id,
      owner: photo.owner,
      title: photo.title,
      thumbnailUrl: photo.thumbnailUrl,
      media: photo.media || 'photo',
      displayedAt: new Date().toISOString()
    });

    // Cap at 30 items
    if (this.settings.displayHistory.length > 30) {
      this.settings.displayHistory = this.settings.displayHistory.slice(0, 30);
    }

    await this.save();
    return this.settings.displayHistory;
  }

  /**
   * Remove a photo from history
   * @param {string} photoId - Photo ID to remove
   */
  async removeFromHistory(photoId) {
    if (!this.loaded) {
      await this.load();
    }

    if (!this.settings.displayHistory) {
      return [];
    }

    this.settings.displayHistory = this.settings.displayHistory.filter(p => p.id !== photoId);
    await this.save();
    return this.settings.displayHistory;
  }

  /**
   * Clear all display history
   */
  async clearHistory() {
    if (!this.loaded) {
      await this.load();
    }

    this.settings.displayHistory = [];
    await this.save();
    return [];
  }
}

module.exports = new SettingsManager();
