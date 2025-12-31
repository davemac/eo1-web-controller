/**
 * EO1 Web Controller
 * Web interface for Electric Objects EO1 digital art display
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const config = require('config');
const path = require('path');
const { execSync } = require('child_process');

const EO1Socket = require('./src/services/eo1-socket');
const FlickrClient = require('./src/services/flickr-client');
const settingsManager = require('./src/services/settings-manager');

const deviceRoutes = require('./src/routes/api/device');
const flickrRoutes = require('./src/routes/api/flickr');
const settingsRoutes = require('./src/routes/api/settings');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/device', deviceRoutes);
app.use('/api/flickr', flickrRoutes);
app.use('/api/settings', settingsRoutes);

// Serve SPA for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.message);

  // Handle specific error types
  if (err.message.includes('Connection failed') || err.message.includes('Connection timeout')) {
    return res.status(503).json({
      error: 'Device not reachable',
      message: err.message
    });
  }

  if (err.message.includes('Flickr API error')) {
    return res.status(502).json({
      error: 'Flickr API error',
      message: err.message
    });
  }

  // Generic error
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
async function startServer() {
  // Load settings
  const settings = await settingsManager.load();

  // Initialise services with settings (fallback to env vars)
  const eo1Ip = settings.device.ip || process.env.EO1_IP || config.get('eo1.defaultIp');
  const eo1Port = settings.device.port || parseInt(process.env.EO1_PORT) || config.get('eo1.port');
  const eo1Socket = new EO1Socket(eo1Ip, eo1Port);

  const flickrApiKey = settings.flickr.apiKey || process.env.FLICKR_API_KEY;
  if (!flickrApiKey) {
    console.warn('Warning: No Flickr API key configured. Add one in Settings.');
  }
  const flickrClient = new FlickrClient(flickrApiKey);

  // Store services in app for routes to access
  app.set('eo1Socket', eo1Socket);
  app.set('flickrClient', flickrClient);

  const port = parseInt(process.env.PORT) || config.get('server.port');
  const host = process.env.HOST || config.get('server.host');

  const server = app.listen(port, host, () => {
    // Get Tailscale IP if available
    let tailscaleIp = null;
    try {
      tailscaleIp = execSync('tailscale ip -4 2>/dev/null', { encoding: 'utf8' }).trim();
    } catch (e) {
      // Tailscale not available or not connected
    }

    const localUrl = `http://localhost:${port}`;
    const tailscaleUrl = tailscaleIp ? `http://${tailscaleIp}:${port}` : null;

    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║           EO1 Web Controller                              ║');
    console.log('╠═══════════════════════════════════════════════════════════╣');
    console.log(`║  Device:    ${eo1Ip}:${eo1Port}`.padEnd(62) + '║');
    console.log(`║  Flickr:    ${flickrApiKey ? 'API key configured' : 'No API key - add in Settings'}`.padEnd(62) + '║');
    console.log('╠═══════════════════════════════════════════════════════════╣');
    console.log('║  Local:     ' + localUrl.padEnd(48) + '║');
    if (tailscaleUrl) {
      console.log('║  Tailscale: ' + tailscaleUrl.padEnd(48) + '║');
    }
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('');
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
