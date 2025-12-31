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
          ip: process.env.EO1_IP || '192.168.1.43',
          port: parseInt(process.env.EO1_PORT) || 12345
        },
        currentSource: null  // Tracks what's currently displayed on EO1
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
}

module.exports = new SettingsManager();
