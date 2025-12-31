/**
 * Settings API Routes
 * Handles app configuration and preset management
 */

const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const config = require('config');
const FlickrClient = require('../../services/flickr-client');
const settingsManager = require('../../services/settings-manager');

const PRESETS_FILE = path.join(__dirname, '../../../config/presets.json');

/**
 * Load user presets from file
 */
async function loadUserPresets() {
  try {
    const data = await fs.readFile(PRESETS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // File doesn't exist or is invalid, return empty object
    return {};
  }
}

/**
 * Save user presets to file
 */
async function saveUserPresets(presets) {
  await fs.writeFile(PRESETS_FILE, JSON.stringify(presets, null, 2));
}

/**
 * GET /api/settings
 * Get current app settings
 */
router.get('/', async (req, res, next) => {
  try {
    const socket = req.app.get('eo1Socket');
    const settings = await settingsManager.getAll();

    // Mask the API key for security (show last 4 chars only)
    const maskedApiKey = settings.flickr.apiKey
      ? '••••••••' + settings.flickr.apiKey.slice(-4)
      : '';

    res.json({
      device: {
        ip: socket.host,
        port: socket.port
      },
      flickr: {
        apiKey: maskedApiKey,
        userId: settings.flickr.userId || '',
        hasApiKey: !!settings.flickr.apiKey
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/settings
 * Update app settings
 * Body: { deviceIp: string }
 */
router.put('/', async (req, res, next) => {
  try {
    const { deviceIp } = req.body;

    if (deviceIp) {
      // Validate IP address format
      const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (!ipRegex.test(deviceIp)) {
        return res.status(400).json({ error: 'Invalid IP address format' });
      }

      const socket = req.app.get('eo1Socket');
      socket.setHost(deviceIp);

      // Also save to settings
      await settingsManager.updateDevice({ ip: deviceIp });
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/settings/flickr
 * Get Flickr API settings (masked)
 */
router.get('/flickr', async (req, res, next) => {
  try {
    const flickr = await settingsManager.getFlickr();

    // Mask sensitive values
    res.json({
      apiKey: flickr.apiKey ? '••••••••' + flickr.apiKey.slice(-4) : '',
      userId: flickr.userId || '',
      hasApiKey: !!flickr.apiKey,
      source: flickr.source || null
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/settings/flickr
 * Update Flickr API settings
 * Body: { apiKey?: string, userId?: string }
 */
router.put('/flickr', async (req, res, next) => {
  try {
    const { apiKey, userId } = req.body;

    const updates = {};
    if (apiKey !== undefined) updates.apiKey = apiKey;
    if (userId !== undefined) updates.userId = userId;

    const updated = await settingsManager.updateFlickr(updates);

    // Update the Flickr client with new API key
    if (apiKey) {
      const flickrClient = req.app.get('flickrClient');
      flickrClient.setApiKey(apiKey);
    }

    // Mask sensitive values in response
    res.json({
      success: true,
      flickr: {
        apiKey: updated.apiKey ? '••••••••' + updated.apiKey.slice(-4) : '',
        userId: updated.userId || '',
        hasApiKey: !!updated.apiKey
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/settings/presets
 * Get all presets (built-in + user)
 */
router.get('/presets', async (req, res, next) => {
  try {
    // Get built-in presets from config
    const builtinPresets = config.get('presets');

    // Get user presets from file
    const userPresets = await loadUserPresets();

    // Combine them, marking which are built-in
    const allPresets = {};

    // Add built-in presets
    for (const [id, preset] of Object.entries(builtinPresets)) {
      allPresets[id] = { ...preset, id, builtin: true };
    }

    // Add user presets (these can override built-in if same ID)
    for (const [id, preset] of Object.entries(userPresets)) {
      allPresets[id] = { ...preset, id, builtin: false };
    }

    res.json({ presets: allPresets });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/settings/presets
 * Add a new user preset
 * Body: { name: string, url: string } or { name: string, type: 'tag'|'user', value: string }
 */
router.post('/presets', async (req, res, next) => {
  try {
    const { name, url, type, value } = req.body;

    if (!name || name.length > 50) {
      return res.status(400).json({ error: 'Name is required (max 50 characters)' });
    }

    let presetData;

    if (url) {
      // Parse Flickr URL
      const parsed = FlickrClient.parseFlickrUrl(url);
      if (!parsed) {
        return res.status(400).json({ error: 'Invalid Flickr URL' });
      }

      presetData = {
        name,
        type: parsed.type,
        url
      };

      // Add the appropriate ID field based on type
      if (parsed.type === 'tag') {
        presetData.tag = parsed.value;
      } else if (parsed.type === 'group') {
        // Groups need NSID - resolve slug to NSID if needed
        const flickr = req.app.get('flickrClient');
        try {
          presetData.groupId = await flickr.resolveGroupId(parsed.value);
        } catch (err) {
          return res.status(400).json({ error: `Could not resolve group "${parsed.value}": ${err.message}` });
        }
      } else if (parsed.type === 'gallery') {
        presetData.galleryId = parsed.value;
      } else if (parsed.type === 'album') {
        presetData.albumId = parsed.value;
        // Albums need user ID - resolve username to NSID if needed
        const flickr = req.app.get('flickrClient');
        try {
          presetData.userId = await flickr.resolveUserId(parsed.userId);
        } catch (err) {
          return res.status(400).json({ error: `Could not resolve user "${parsed.userId}": ${err.message}` });
        }
      } else {
        // User type - resolve username to NSID if needed
        const flickr = req.app.get('flickrClient');
        try {
          presetData.userId = await flickr.resolveUserId(parsed.value);
        } catch (err) {
          return res.status(400).json({ error: `Could not resolve user "${parsed.value}": ${err.message}` });
        }
      }
    } else if (type && value) {
      // Direct type and value
      if (!['tag', 'user', 'group', 'gallery', 'album'].includes(type)) {
        return res.status(400).json({ error: 'Type must be "tag", "user", "group", "gallery", or "album"' });
      }

      presetData = {
        name,
        type
      };

      if (type === 'tag') {
        presetData.tag = value;
      } else if (type === 'group') {
        presetData.groupId = value;
      } else if (type === 'gallery') {
        presetData.galleryId = value;
      } else if (type === 'album') {
        presetData.albumId = value;
      } else {
        presetData.userId = value;
      }
    } else {
      return res.status(400).json({ error: 'Either url or type+value is required' });
    }

    // Generate an ID from the name
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    if (!id) {
      return res.status(400).json({ error: 'Could not generate valid ID from name' });
    }

    // Load existing presets, add new one, save
    const userPresets = await loadUserPresets();
    userPresets[id] = presetData;
    await saveUserPresets(userPresets);

    res.json({
      success: true,
      preset: { ...presetData, id, builtin: false }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/settings/presets/:id
 * Delete a user preset
 */
router.delete('/presets/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if it's a built-in preset
    const builtinPresets = config.get('presets');
    if (builtinPresets[id] && builtinPresets[id].builtin) {
      return res.status(400).json({ error: 'Cannot delete built-in presets' });
    }

    // Load user presets
    const userPresets = await loadUserPresets();

    if (!userPresets[id]) {
      return res.status(404).json({ error: 'Preset not found' });
    }

    // Delete and save
    delete userPresets[id];
    await saveUserPresets(userPresets);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/settings/parse-url
 * Parse a Flickr URL without saving
 * Body: { url: string }
 */
router.post('/parse-url', (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  const parsed = FlickrClient.parseFlickrUrl(url);

  if (!parsed) {
    return res.status(400).json({ error: 'Invalid Flickr URL' });
  }

  res.json(parsed);
});

/**
 * GET /api/settings/current-source
 * Get what's currently being displayed on EO1
 */
router.get('/current-source', async (req, res, next) => {
  try {
    const currentSource = await settingsManager.getCurrentSource();
    res.json({ currentSource });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/settings/current-source
 * Update what's currently being displayed on EO1
 * Body: { type: 'tag'|'user'|'photo', value: string, name?: string, url?: string }
 */
router.put('/current-source', async (req, res, next) => {
  try {
    const { type, value, name, url } = req.body;

    if (!type || !value) {
      return res.status(400).json({ error: 'type and value are required' });
    }

    const currentSource = await settingsManager.setCurrentSource({ type, value, name, url });
    res.json({ success: true, currentSource });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
