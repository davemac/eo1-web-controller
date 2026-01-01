/**
 * Device Control API Routes
 * Handles communication with the EO1 device
 */

const express = require('express');
const router = express.Router();
const settingsManager = require('../../services/settings-manager');
const EO1Socket = require('../../services/eo1-socket');

/**
 * Middleware to get the EO1 socket client from the app
 */
const getSocket = (req) => {
  return req.app.get('eo1Socket');
};

/**
 * GET /api/device/status
 * Get configured device info (doesn't actually test connection to avoid crashing EO1)
 */
router.get('/status', async (req, res, next) => {
  try {
    const socket = getSocket(req);
    const info = await socket.checkConnection();
    res.json({
      ip: info.host,
      port: info.port
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/device/skip
 * Skip to next slideshow item
 */
router.post('/skip', async (req, res, next) => {
  try {
    const socket = getSocket(req);
    await socket.resume();
    res.json({ success: true, action: 'skip' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/device/resume
 * Resume slideshow (alias for skip)
 */
router.post('/resume', async (req, res, next) => {
  try {
    const socket = getSocket(req);
    await socket.resume();
    res.json({ success: true, action: 'resume' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/device/image/:photoId
 * Display a specific image
 * Body: { title?: string }
 */
router.post('/image/:photoId', async (req, res, next) => {
  try {
    const { photoId } = req.params;
    const { title, thumbnailUrl, owner } = req.body || {};

    if (!photoId || !/^\d+$/.test(photoId)) {
      return res.status(400).json({ error: 'Invalid photo ID' });
    }

    const socket = getSocket(req);
    await socket.displayImage(photoId);

    // Track current source
    await settingsManager.setCurrentSource({
      type: 'photo',
      value: photoId,
      name: title || `Photo ${photoId}`,
      url: `https://www.flickr.com/photos/${owner || 'any'}/${photoId}/`,
      thumbnailUrl: thumbnailUrl || null
    });

    // Add to display history
    await settingsManager.addToHistory({
      id: photoId,
      owner: owner || null,
      title: title || `Photo ${photoId}`,
      thumbnailUrl: thumbnailUrl || null,
      media: 'photo'
    });

    res.json({ success: true, action: 'displayImage', photoId });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/device/video/:photoId
 * Display a specific video
 * Body: { title?: string }
 */
router.post('/video/:photoId', async (req, res, next) => {
  try {
    const { photoId } = req.params;
    const { title, thumbnailUrl, owner } = req.body || {};

    if (!photoId || !/^\d+$/.test(photoId)) {
      return res.status(400).json({ error: 'Invalid photo ID' });
    }

    const socket = getSocket(req);
    await socket.displayVideo(photoId);

    // Track current source
    await settingsManager.setCurrentSource({
      type: 'video',
      value: photoId,
      name: title || `Video ${photoId}`,
      url: `https://www.flickr.com/photos/${owner || 'any'}/${photoId}/`,
      thumbnailUrl: thumbnailUrl || null
    });

    // Add to display history
    await settingsManager.addToHistory({
      id: photoId,
      owner: owner || null,
      title: title || `Video ${photoId}`,
      thumbnailUrl: thumbnailUrl || null,
      media: 'video'
    });

    res.json({ success: true, action: 'displayVideo', photoId });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/device/url
 * Display an image from any URL
 * Body: { url: string, title?: string }
 */
router.post('/url', async (req, res, next) => {
  try {
    const { url, title } = req.body;

    if (!url || !/^https?:\/\/.+/i.test(url)) {
      return res.status(400).json({ error: 'Invalid URL. Must start with http:// or https://' });
    }

    const socket = getSocket(req);
    await socket.displayUrl(url);

    // Track current source
    await settingsManager.setCurrentSource({
      type: 'url',
      value: url,
      name: title || 'External Image',
      url: url,
      thumbnailUrl: url
    });

    // Add to display history
    await settingsManager.addToHistory({
      id: url,
      owner: null,
      title: title || 'External Image',
      thumbnailUrl: url,
      media: 'url'
    });

    res.json({ success: true, action: 'displayUrl', url });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/device/brightness
 * Set screen brightness
 * Body: { level: number (0.0-1.0) } or { auto: true }
 */
router.post('/brightness', async (req, res, next) => {
  try {
    const { level, auto } = req.body;

    if (auto) {
      // Send -1 to indicate auto brightness
      const socket = getSocket(req);
      await socket.setBrightness(-1);
      res.json({ success: true, action: 'brightness', auto: true });
    } else if (typeof level === 'number' && level >= 0 && level <= 1) {
      const socket = getSocket(req);
      await socket.setBrightness(level);
      res.json({ success: true, action: 'brightness', level });
    } else {
      res.status(400).json({ error: 'Invalid brightness level. Must be 0.0-1.0 or { auto: true }' });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/device/tag
 * Change the Flickr tag
 * Body: { tag: string, name?: string }
 */
router.post('/tag', async (req, res, next) => {
  try {
    const { tag, name } = req.body;

    if (!tag || typeof tag !== 'string' || tag.length > 100) {
      return res.status(400).json({ error: 'Invalid tag' });
    }

    const socket = getSocket(req);
    await socket.setTag(tag.trim());

    // Track current source
    await settingsManager.setCurrentSource({
      type: 'tag',
      value: tag.trim(),
      name: name || tag.trim(),
      url: `https://www.flickr.com/photos/tags/${encodeURIComponent(tag.trim())}/`
    });

    res.json({ success: true, action: 'setTag', tag: tag.trim() });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/device/options
 * Update multiple settings at once
 * Body: { brightness: number, interval: number, startHour: number, endHour: number }
 */
router.post('/options', async (req, res, next) => {
  try {
    const { brightness = -1, interval = 5, startHour = -1, endHour = -1 } = req.body;

    // Validate brightness (-1 for auto, or 0.0-1.0)
    if (brightness !== -1 && (brightness < 0 || brightness > 1)) {
      return res.status(400).json({ error: 'Brightness must be -1 (auto) or 0.0-1.0' });
    }

    // Validate interval (1-60 minutes)
    if (!Number.isInteger(interval) || interval < 1 || interval > 60) {
      return res.status(400).json({ error: 'Interval must be 1-60 minutes' });
    }

    // Validate quiet hours (-1 to disable, or 0-23)
    if (startHour !== -1 && (!Number.isInteger(startHour) || startHour < 0 || startHour > 23)) {
      return res.status(400).json({ error: 'Start hour must be -1 (disabled) or 0-23' });
    }
    if (endHour !== -1 && (!Number.isInteger(endHour) || endHour < 0 || endHour > 23)) {
      return res.status(400).json({ error: 'End hour must be -1 (disabled) or 0-23' });
    }

    const socket = getSocket(req);
    await socket.setOptions(brightness, interval, startHour, endHour);
    res.json({
      success: true,
      action: 'setOptions',
      options: { brightness, interval, startHour, endHour }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/device/scan
 * Scan network for EO1 devices (port 12345)
 * Body: { subnet?: string } - Optional subnet override
 */
router.post('/scan', async (req, res, next) => {
  try {
    const { subnet } = req.body;

    // Auto-detect subnet if not provided
    const targetSubnet = subnet || EO1Socket.detectSubnet();

    if (!targetSubnet) {
      return res.status(400).json({ error: 'Could not detect network subnet' });
    }

    console.log(`Scanning ${targetSubnet}.* for EO1 devices...`);
    const devices = await EO1Socket.scanNetwork(targetSubnet, 500);

    res.json({
      success: true,
      subnet: targetSubnet,
      devices,
      found: devices.length
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
