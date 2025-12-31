/**
 * Flickr API Routes
 * Handles Flickr photo browsing and search
 */

const express = require('express');
const router = express.Router();

/**
 * Middleware to get the Flickr client from the app
 */
const getFlickr = (req) => {
  return req.app.get('flickrClient');
};

/**
 * GET /api/flickr/user/:userId/photos
 * Get public photos from a Flickr user
 * Query params: page (default: 1), per_page (default: 24)
 */
router.get('/user/:userId/photos', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.per_page) || 24;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const flickr = getFlickr(req);
    const result = await flickr.getUserPhotos(userId, page, perPage);

    // Transform response for easier frontend consumption
    const photos = result.photos.photo.map(photo => {
      // Get dimensions - prefer original, fall back to large, then medium
      const width = photo.o_width ? parseInt(photo.o_width) :
                    photo.width_l ? parseInt(photo.width_l) :
                    photo.width_m ? parseInt(photo.width_m) : null;
      const height = photo.o_height ? parseInt(photo.o_height) :
                     photo.height_l ? parseInt(photo.height_l) :
                     photo.height_m ? parseInt(photo.height_m) : null;

      return {
        id: photo.id,
        title: photo.title,
        media: photo.media || 'photo',
        thumbnailUrl: photo.url_sq || photo.url_m,
        mediumUrl: photo.url_m,
        largeUrl: photo.url_l,
        originalUrl: photo.url_o,
        width,
        height
      };
    });

    res.json({
      photos,
      page: parseInt(result.photos.page),
      pages: parseInt(result.photos.pages),
      perPage: parseInt(result.photos.perpage),
      total: parseInt(result.photos.total)
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/flickr/search
 * Search photos by tag(s)
 * Query params: tags (required), page (default: 1), per_page (default: 24)
 */
router.get('/search', async (req, res, next) => {
  try {
    const { tags } = req.query;
    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.per_page) || 24;

    if (!tags) {
      return res.status(400).json({ error: 'Tags parameter is required' });
    }

    const flickr = getFlickr(req);
    const result = await flickr.searchByTag(tags, page, perPage);

    // Transform response for easier frontend consumption
    const photos = result.photos.photo.map(photo => {
      // Get dimensions - prefer original, fall back to large, then medium
      const width = photo.o_width ? parseInt(photo.o_width) :
                    photo.width_l ? parseInt(photo.width_l) :
                    photo.width_m ? parseInt(photo.width_m) : null;
      const height = photo.o_height ? parseInt(photo.o_height) :
                     photo.height_l ? parseInt(photo.height_l) :
                     photo.height_m ? parseInt(photo.height_m) : null;

      return {
        id: photo.id,
        title: photo.title,
        media: photo.media || 'photo',
        thumbnailUrl: photo.url_sq || photo.url_m,
        mediumUrl: photo.url_m,
        largeUrl: photo.url_l,
        originalUrl: photo.url_o,
        width,
        height
      };
    });

    res.json({
      photos,
      page: parseInt(result.photos.page),
      pages: parseInt(result.photos.pages),
      perPage: parseInt(result.photos.perpage),
      total: parseInt(result.photos.total),
      tags
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/flickr/photo/:photoId/sizes
 * Get available sizes for a photo
 */
router.get('/photo/:photoId/sizes', async (req, res, next) => {
  try {
    const { photoId } = req.params;

    if (!photoId || !/^\d+$/.test(photoId)) {
      return res.status(400).json({ error: 'Invalid photo ID' });
    }

    const flickr = getFlickr(req);
    const result = await flickr.getPhotoSizes(photoId);

    // Transform to a more usable format
    const sizes = {};
    if (result.sizes && result.sizes.size) {
      result.sizes.size.forEach(size => {
        sizes[size.label.toLowerCase().replace(/\s+/g, '_')] = {
          label: size.label,
          width: parseInt(size.width),
          height: parseInt(size.height),
          source: size.source,
          url: size.url
        };
      });
    }

    res.json({
      photoId,
      sizes,
      canDownload: result.sizes.candownload === 1
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/flickr/photo/:photoId/info
 * Get detailed info about a photo
 */
router.get('/photo/:photoId/info', async (req, res, next) => {
  try {
    const { photoId } = req.params;

    if (!photoId || !/^\d+$/.test(photoId)) {
      return res.status(400).json({ error: 'Invalid photo ID' });
    }

    const flickr = getFlickr(req);
    const result = await flickr.getPhotoInfo(photoId);

    res.json({
      id: result.photo.id,
      title: result.photo.title._content,
      description: result.photo.description._content,
      owner: {
        id: result.photo.owner.nsid,
        username: result.photo.owner.username,
        realname: result.photo.owner.realname
      },
      dates: {
        taken: result.photo.dates.taken,
        posted: result.photo.dates.posted
      },
      media: result.photo.media,
      tags: result.photo.tags.tag.map(t => t.raw)
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/flickr/user/:userId/albums
 * Get a user's photosets/albums
 */
router.get('/user/:userId/albums', async (req, res, next) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const flickr = getFlickr(req);
    const result = await flickr.getPhotosets(userId);

    // Transform response
    const albums = (result.photosets.photoset || []).map(album => ({
      id: album.id,
      title: album.title._content,
      description: album.description._content,
      photoCount: parseInt(album.photos),
      videoCount: parseInt(album.videos),
      primaryPhoto: {
        id: album.primary,
        thumbnailUrl: album.primary_photo_extras ? album.primary_photo_extras.url_sq : null,
        mediumUrl: album.primary_photo_extras ? album.primary_photo_extras.url_m : null
      }
    }));

    res.json({
      albums,
      total: parseInt(result.photosets.total)
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/flickr/album/:albumId/photos
 * Get photos from a photoset/album
 * Query params: user_id (required), page (default: 1)
 */
router.get('/album/:albumId/photos', async (req, res, next) => {
  try {
    const { albumId } = req.params;
    const { user_id: userId } = req.query;
    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.per_page) || 24;

    if (!albumId) {
      return res.status(400).json({ error: 'Album ID is required' });
    }
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const flickr = getFlickr(req);
    const result = await flickr.getPhotosetPhotos(albumId, userId, page, perPage);

    // Transform response
    const photos = result.photoset.photo.map(photo => {
      // Get dimensions - prefer original, fall back to large, then medium
      const width = photo.o_width ? parseInt(photo.o_width) :
                    photo.width_l ? parseInt(photo.width_l) :
                    photo.width_m ? parseInt(photo.width_m) : null;
      const height = photo.o_height ? parseInt(photo.o_height) :
                     photo.height_l ? parseInt(photo.height_l) :
                     photo.height_m ? parseInt(photo.height_m) : null;

      return {
        id: photo.id,
        title: photo.title,
        media: photo.media || 'photo',
        thumbnailUrl: photo.url_sq || photo.url_m,
        mediumUrl: photo.url_m,
        largeUrl: photo.url_l,
        originalUrl: photo.url_o,
        width,
        height
      };
    });

    res.json({
      photos,
      albumId,
      albumTitle: result.photoset.title,
      page: parseInt(result.photoset.page),
      pages: parseInt(result.photoset.pages),
      perPage: parseInt(result.photoset.perpage),
      total: parseInt(result.photoset.total)
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/flickr/group/:groupId/photos
 * Get photos from a group pool
 * Query params: page (default: 1), per_page (default: 24)
 */
router.get('/group/:groupId/photos', async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.per_page) || 24;

    if (!groupId) {
      return res.status(400).json({ error: 'Group ID is required' });
    }

    const flickr = getFlickr(req);
    const result = await flickr.getGroupPhotos(groupId, page, perPage);

    // Transform response
    const photos = result.photos.photo.map(photo => {
      // Get dimensions - prefer original, fall back to large, then medium
      const width = photo.o_width ? parseInt(photo.o_width) :
                    photo.width_l ? parseInt(photo.width_l) :
                    photo.width_m ? parseInt(photo.width_m) : null;
      const height = photo.o_height ? parseInt(photo.o_height) :
                     photo.height_l ? parseInt(photo.height_l) :
                     photo.height_m ? parseInt(photo.height_m) : null;

      return {
        id: photo.id,
        title: photo.title,
        media: photo.media || 'photo',
        thumbnailUrl: photo.url_sq || photo.url_m,
        mediumUrl: photo.url_m,
        largeUrl: photo.url_l,
        originalUrl: photo.url_o,
        width,
        height
      };
    });

    res.json({
      photos,
      groupId,
      page: parseInt(result.photos.page),
      pages: parseInt(result.photos.pages),
      perPage: parseInt(result.photos.perpage),
      total: parseInt(result.photos.total)
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/flickr/gallery/:galleryId/photos
 * Get photos from a gallery
 * Query params: page (default: 1), per_page (default: 24)
 */
router.get('/gallery/:galleryId/photos', async (req, res, next) => {
  try {
    const { galleryId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.per_page) || 24;

    if (!galleryId) {
      return res.status(400).json({ error: 'Gallery ID is required' });
    }

    const flickr = getFlickr(req);
    const result = await flickr.getGalleryPhotos(galleryId, page, perPage);

    // Transform response
    const photos = result.photos.photo.map(photo => {
      // Get dimensions - prefer original, fall back to large, then medium
      const width = photo.o_width ? parseInt(photo.o_width) :
                    photo.width_l ? parseInt(photo.width_l) :
                    photo.width_m ? parseInt(photo.width_m) : null;
      const height = photo.o_height ? parseInt(photo.o_height) :
                     photo.height_l ? parseInt(photo.height_l) :
                     photo.height_m ? parseInt(photo.height_m) : null;

      return {
        id: photo.id,
        title: photo.title,
        media: photo.media || 'photo',
        thumbnailUrl: photo.url_sq || photo.url_m,
        mediumUrl: photo.url_m,
        largeUrl: photo.url_l,
        originalUrl: photo.url_o,
        width,
        height
      };
    });

    res.json({
      photos,
      galleryId,
      page: parseInt(result.photos.page),
      pages: parseInt(result.photos.pages),
      perPage: parseInt(result.photos.perpage),
      total: parseInt(result.photos.total)
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
