/**
 * EO1 Socket Client
 * Handles TCP socket communication with the EO1 device on port 12345
 *
 * Protocol: Plain text, comma-delimited commands
 * - image,<flickr_photo_id> - Display specific image
 * - video,<flickr_photo_id> - Display specific video
 * - resume, - Skip to next / resume slideshow
 * - tag,<tagname> - Change Flickr tag
 * - brightness,<float> - Set brightness (0.0-1.0)
 * - options,<brightness>,<interval>,<startHour>,<endHour> - Bulk settings
 */

const net = require('net');

class EO1Socket {
  constructor(host, port = 12345, timeout = 5000) {
    this.host = host;
    this.port = port;
    this.timeout = timeout;
  }

  /**
   * Send a raw command to the EO1 device
   * @param {string} command - The command to send
   * @returns {Promise<{success: boolean, command: string}>}
   */
  async sendCommand(command) {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      socket.setTimeout(this.timeout);

      socket.on('error', (err) => {
        socket.destroy();
        reject(new Error(`Connection failed: ${err.message}`));
      });

      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error('Connection timeout'));
      });

      socket.on('close', () => {
        resolve({ success: true, command });
      });

      socket.connect(this.port, this.host, () => {
        // Write command and wait for it to be flushed before closing
        socket.write(command + '\n', 'utf8', () => {
          // Give the EO1 a moment to process before we close
          setTimeout(() => {
            socket.end();
          }, 100);
        });
      });
    });
  }

  /**
   * Display a specific image by Flickr photo ID
   * @param {string} photoId - Flickr photo ID
   */
  async displayImage(photoId) {
    return this.sendCommand(`image,${photoId}`);
  }

  /**
   * Display a specific video by Flickr photo ID
   * @param {string} photoId - Flickr photo ID
   */
  async displayVideo(photoId) {
    return this.sendCommand(`video,${photoId}`);
  }

  /**
   * Skip to next slideshow item / resume slideshow
   */
  async resume() {
    return this.sendCommand('resume,');
  }

  /**
   * Change the Flickr tag to search
   * @param {string} tag - Flickr tag name
   */
  async setTag(tag) {
    return this.sendCommand(`tag,${tag}`);
  }

  /**
   * Set screen brightness
   * @param {number} level - Brightness level (0.0 to 1.0)
   */
  async setBrightness(level) {
    return this.sendCommand(`brightness,${level}`);
  }

  /**
   * Update multiple options at once
   * @param {number} brightness - Brightness level (0.0 to 1.0, or -1 for auto)
   * @param {number} interval - Slideshow interval in minutes
   * @param {number} startHour - Quiet hours start (0-23, or -1 to disable)
   * @param {number} endHour - Quiet hours end (0-23, or -1 to disable)
   */
  async setOptions(brightness, interval, startHour, endHour) {
    return this.sendCommand(`options,${brightness},${interval},${startHour},${endHour}`);
  }

  /**
   * Check if the device is reachable
   * Note: We don't actually test the socket because connecting without
   * sending a command can crash the EO1 app. Just return the configured values.
   * @returns {Promise<{host: string, port: number}>}
   */
  async checkConnection() {
    return {
      host: this.host,
      port: this.port
    };
  }

  /**
   * Update the device IP address
   * @param {string} host - New IP address
   */
  setHost(host) {
    this.host = host;
  }

  /**
   * Scan network for EO1 devices
   * Looks for devices with port 12345 open
   * @param {string} subnet - Subnet to scan (e.g., '192.168.1')
   * @param {number} timeout - Connection timeout per host in ms
   * @returns {Promise<string[]>} - Array of IPs with port 12345 open
   */
  static async scanNetwork(subnet = '192.168.1', timeout = 500) {
    const net = require('net');
    const found = [];
    const promises = [];

    // Scan IPs 1-254
    for (let i = 1; i <= 254; i++) {
      const ip = `${subnet}.${i}`;

      const promise = new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(timeout);

        socket.on('connect', () => {
          found.push(ip);
          socket.destroy();
          resolve();
        });

        socket.on('error', () => {
          socket.destroy();
          resolve();
        });

        socket.on('timeout', () => {
          socket.destroy();
          resolve();
        });

        socket.connect(12345, ip);
      });

      promises.push(promise);
    }

    await Promise.all(promises);
    return found;
  }

  /**
   * Detect local subnet from network interfaces
   * @returns {string|null} - Subnet like '192.168.1' or null
   */
  static detectSubnet() {
    const os = require('os');
    const interfaces = os.networkInterfaces();

    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        // Skip internal and non-IPv4
        if (iface.internal || iface.family !== 'IPv4') continue;

        // Extract subnet (first 3 octets)
        const parts = iface.address.split('.');
        if (parts.length === 4) {
          return `${parts[0]}.${parts[1]}.${parts[2]}`;
        }
      }
    }
    return null;
  }
}

module.exports = EO1Socket;
