# EO1 Web Controller - Architecture Documentation

## Overview

The EO1 Web Controller is a Node.js web application that provides a browser-based interface for controlling an Electric Objects EO1 digital art display. It replaces the discontinued Android Partner app, enabling control from any device with a web browser.

## System Architecture

```
┌─────────────────────┐     HTTP      ┌─────────────────────┐     TCP:12345     ┌─────────────────┐
│  Browser (Client)   │◄────────────►│  Node.js Server     │◄───────────────►│  EO1 Device     │
│  - iPhone/Mac       │               │  - Express.js       │                   │  - Android 4.4  │
│  - Single Page App  │               │  - REST API         │                   │  - spalt/EO1    │
└─────────────────────┘               └─────────────────────┘                   └─────────────────┘
                                              │
                                              │ HTTPS
                                              ▼
                                      ┌─────────────────┐
                                      │  Flickr API     │
                                      │  - Photos       │
                                      │  - Groups       │
                                      │  - Galleries    │
                                      └─────────────────┘
```

## Technology Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework for REST API
- **net** (built-in) - TCP socket client for EO1 communication
- **axios** - HTTP client for Flickr API
- **config** - Configuration management
- **dotenv** - Environment variable loading

### Frontend
- **Vanilla JavaScript** - No frameworks, simple and fast
- **CSS3** - Custom properties (CSS variables), flexbox, grid
- **Mobile-first responsive design** - Works on phones and desktops

## Directory Structure

```
web/
├── server.js                    # Application entry point
├── package.json                 # Dependencies and scripts
├── .env                         # Environment variables (gitignored)
├── .env.example                 # Template for environment setup
│
├── config/
│   ├── default.json             # Default configuration and built-in presets
│   ├── settings.json            # Saved user settings (gitignored)
│   └── presets.json             # User custom presets (gitignored)
│
├── src/
│   ├── routes/
│   │   └── api/
│   │       ├── device.js        # /api/device/* endpoints
│   │       ├── flickr.js        # /api/flickr/* endpoints
│   │       └── settings.js      # /api/settings/* endpoints
│   │
│   └── services/
│       ├── eo1-socket.js        # TCP client for EO1 device
│       ├── flickr-client.js     # Flickr REST API wrapper
│       └── settings-manager.js  # Persistent settings storage
│
└── public/                      # Static files served to browser
    ├── index.html               # Single page application
    ├── css/
    │   └── styles.css           # All styles, mobile-first
    └── js/
        ├── api-client.js        # REST API wrapper
        └── app.js               # Main application logic
```

## Backend Components

### server.js
The main entry point that:
- Loads environment variables from `.env`
- Initialises the EO1Socket and FlickrClient services
- Mounts API routes under `/api/*`
- Serves static files from `public/`
- Displays startup banner with connection info

### EO1Socket (`src/services/eo1-socket.js`)
Handles TCP communication with the EO1 device:

**Protocol**: The EO1 runs a TCP server on port 12345. Commands are plain text, comma-delimited.

| Command | Description |
|---------|-------------|
| `image,<photoId>` | Display a specific Flickr photo |
| `video,<photoId>` | Display a specific Flickr video |
| `resume,` | Skip to next slideshow item |
| `tag,<tagname>` | Change the Flickr tag source |
| `brightness,<0.0-1.0>` | Set screen brightness |
| `options,<b>,<i>,<s>,<e>` | Bulk update (brightness, interval, quiet start/end) |

**Important**: Connecting to the EO1 without sending a command can crash the app. The socket client opens, sends, waits briefly, then closes.

**Network Scanner**: Can scan a /24 subnet for devices with port 12345 open.

### FlickrClient (`src/services/flickr-client.js`)
Wraps the Flickr REST API:

**Features**:
- User public photos with pagination
- Tag search
- Albums/photosets
- Group pools
- Galleries
- URL parsing (extracts type and ID from Flickr URLs)

**Dimension Data**: Requests `width_l`, `height_l`, `width_m`, `height_m` extras to get image dimensions for portrait/landscape detection.

### SettingsManager (`src/services/settings-manager.js`)
Persists settings to `config/settings.json`:
- Flickr API credentials
- Device IP address
- Current source (what's displaying)

Falls back to environment variables if settings file is empty.

## API Routes

### Device Routes (`/api/device`)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/status` | GET | Get device IP (doesn't test connection) |
| `/skip` | POST | Skip to next image |
| `/resume` | POST | Resume slideshow |
| `/image/:photoId` | POST | Display specific image |
| `/video/:photoId` | POST | Display specific video |
| `/brightness` | POST | Set brightness level or auto |
| `/tag` | POST | Change tag source |
| `/options` | POST | Bulk update settings |
| `/scan` | POST | Scan network for EO1 devices |

### Flickr Routes (`/api/flickr`)
All responses include pagination info and transformed photo objects with:
- `id`, `title`, `media` (photo/video)
- `thumbnailUrl`, `mediumUrl`, `largeUrl`, `originalUrl`
- `width`, `height` (for orientation detection)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/user/:userId/photos` | GET | User's public photos |
| `/user/:userId/albums` | GET | User's albums |
| `/album/:albumId/photos` | GET | Photos from an album |
| `/group/:groupId/photos` | GET | Photos from a group pool |
| `/gallery/:galleryId/photos` | GET | Photos from a gallery |
| `/search` | GET | Search by tag(s) |
| `/photo/:photoId/sizes` | GET | Available sizes |
| `/photo/:photoId/info` | GET | Photo metadata |

### Settings Routes (`/api/settings`)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/` | GET | Get all settings (masked API keys) |
| `/` | PUT | Update settings |
| `/flickr` | GET | Get Flickr settings with source info |
| `/flickr` | PUT | Update Flickr API credentials |
| `/presets` | GET | Get all presets (built-in + custom) |
| `/presets` | POST | Add custom preset from URL |
| `/presets/:id` | DELETE | Delete custom preset |
| `/parse-url` | POST | Parse Flickr URL to type + value |
| `/current-source` | GET | What's currently displaying |
| `/current-source` | PUT | Update current source |

## Frontend Architecture

### State Management (`app.js`)
Uses a simple `state` object:
```javascript
const state = {
  connected: false,      // Device connection status
  presets: {},           // All presets (built-in + custom)
  activePreset: null,    // Currently selected preset ID
  currentSearch: null,   // Current browse context {type, value}
  currentPage: 1,        // Pagination
  totalPages: 1,
  photos: [],            // Current photo list
  albums: [],            // Current album list
  currentAlbum: null,    // Selected album
  selectedPhoto: null,   // Photo in preview modal
  flickrUserId: null     // User's Flickr ID
};
```

### DOM Element References
All interactive elements are cached in an `elements` object at startup for performance.

### Key Functions

| Function | Purpose |
|----------|---------|
| `loadPresets()` | Fetch and render preset grid |
| `activatePreset(id, preset)` | Load photos from a preset, update EO1 |
| `loadPhotos(query, type, page)` | Fetch photos from Flickr |
| `renderPhotos()` | Render photo grid with orientation badges |
| `openPreview(photo)` | Show photo in modal with dimensions |
| `displayOnEO1()` | Send photo to device (with landscape warning) |
| `loadFlickrSettings()` | Populate settings form |

### UI Components

**Now Displaying Card**
- Shows current source with thumbnail
- Quick controls: Skip, Screen On/Off
- Brightness slider with auto toggle

**Preset Grid**
- 2-3 column grid of source options
- Built-in presets (protected from deletion)
- Custom presets (with delete button)
- "+ Add Custom Source" button

**Photo Grid**
- 3-4 column responsive grid
- Portrait photos: green border, `▮` icon
- Landscape photos: reduced opacity (60%)
- Click to open preview modal

**Preview Modal**
- Larger image/video preview
- Title, dimensions, orientation status
- "Display on EO1" button
- Landscape warning confirmation

**Settings Sections** (collapsible)
- Device Settings: IP input, test/scan buttons
- Flickr API Settings: API key, source indicator
- Slideshow Settings: interval, quiet hours

## Styling

### CSS Architecture
- **CSS Variables**: Colour palette, spacing, border-radius defined in `:root`
- **Mobile-first**: Base styles for mobile, `@media` queries for larger screens
- **Dark theme**: Background `#0f0f1a`, cards `#1a1a2e`

### Key Classes

| Class | Purpose |
|-------|---------|
| `.card` | Content container with padding and shadow |
| `.btn`, `.btn-primary`, `.btn-outline` | Button variants |
| `.photo-card` | Grid item for photos |
| `.photo-card.portrait` | Green border for portrait images |
| `.photo-card.landscape` | Reduced opacity for landscape |
| `.modal`, `.modal.open` | Modal dialog |
| `.toast` | Notification messages |

## Data Flow Examples

### Displaying a Photo on EO1
1. User clicks photo in grid
2. `openPreview(photo)` shows modal with details
3. User clicks "Display on EO1"
4. `displayOnEO1()` checks orientation, shows warning if landscape
5. Calls `API.device.displayImage(photoId, title, thumbnail)`
6. Backend sends `image,<photoId>` to EO1 via TCP
7. Updates `currentSource` in settings
8. Updates "Now Displaying" card

### Adding a Custom Preset
1. User clicks "+ Add Custom Source"
2. Pastes Flickr URL, enters name
3. `parsePresetUrl()` calls `/api/settings/parse-url`
4. `FlickrClient.parseFlickrUrl()` extracts type and ID
5. User clicks Save
6. `savePreset()` calls `/api/settings/presets` POST
7. Backend saves to `config/presets.json`
8. Preset appears in grid

## Configuration

### Environment Variables (`.env`)
```
FLICKR_API_KEY=xxx      # Flickr API key (requires Flickr Pro to create app)
FLICKR_USER_ID=xxx      # Your Flickr user ID
EO1_IP=192.168.1.43     # EO1 device IP address
PORT=3000               # Server port
HOST=0.0.0.0            # Server host (0.0.0.0 for network access)
```

### Built-in Presets (`config/default.json`)
Pre-configured community sources that cannot be deleted:
- Community Art (tag: electricobjectslives)
- Video Loops (tag: jadsmp4s)
- crushingcodes Gallery (user: 157826401@N07)

## Error Handling

### Backend
- Express error middleware catches exceptions
- Device connection errors return 503
- Flickr API errors return 502
- Validation errors return 400

### Frontend
- Toast notifications for success/error feedback
- Graceful degradation if device unreachable
- Form validation before API calls

## Security Considerations

- API keys are masked in settings responses (show last 4 chars only)
- `.env` and settings files are gitignored
- No authentication (intended for local/Tailscale network only)
- Input validation on all API endpoints
