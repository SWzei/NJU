import express from 'express';
import https from 'https';
import http from 'http';
import path from 'path';
import { URL } from 'url';
import { callImslp } from '../services/imslpService.js';
import HttpError from '../utils/httpError.js';

const router = express.Router();

const ALLOWED_DOWNLOAD_HOSTS = new Set([
  'imslp.org',
  'www.imslp.org',
  'imslp.nl',
  'www.imslp.nl',
  'petruccilibrary.org',
  'www.petruccilibrary.org',
]);

function validateImslpUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

router.get('/imslp/works', async (req, res, next) => {
  try {
    const { title, composer } = req.query;
    const data = await callImslp('search_works', {
      title: title || undefined,
      composer: composer || undefined,
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/imslp/people', async (req, res, next) => {
  try {
    const { name } = req.query;
    const data = await callImslp('search_people', {
      name: name || undefined,
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/imslp/works/:permlink', async (req, res, next) => {
  try {
    const { permlink } = req.params;
    if (!permlink || permlink.length > 512) {
      throw new HttpError(400, 'Invalid permlink');
    }
    const data = await callImslp('work_detail', { permlink });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/imslp/people/:permlink', async (req, res, next) => {
  try {
    const { permlink } = req.params;
    if (!permlink || permlink.length > 512) {
      throw new HttpError(400, 'Invalid permlink');
    }
    const data = await callImslp('person_detail', { permlink });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/imslp/download', async (req, res, next) => {
  try {
    const { url: rawUrl, filename: rawFilename } = req.query;
    if (!rawUrl || typeof rawUrl !== 'string') {
      throw new HttpError(400, 'Missing url parameter');
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      throw new HttpError(400, 'Invalid url parameter');
    }

    if (!ALLOWED_DOWNLOAD_HOSTS.has(parsedUrl.hostname)) {
      throw new HttpError(400, 'Disallowed download host');
    }

    const client = parsedUrl.protocol === 'https:' ? https : http;
    const filename = rawFilename && typeof rawFilename === 'string'
      ? rawFilename
      : (decodeURIComponent(path.basename(parsedUrl.pathname)) || 'score.pdf');

    const proxyReq = client.get(
      rawUrl,
      {
        headers: {
          Cookie: 'imslpdisclaimeraccepted=yes; imslp_wikiLanguageSelectorLanguage=en',
          'User-Agent': 'Mozilla/5.0 (compatible; LinquanBot/1.0)',
        },
        timeout: 30000,
      },
      (proxyRes) => {
        if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
          // Let frontend or caller follow redirects manually to keep validation
          res.status(302).setHeader('Location', proxyRes.headers.location).end();
          return;
        }

        if (proxyRes.statusCode && proxyRes.statusCode >= 400) {
          res.status(502).json({ message: `IMSLP returned status ${proxyRes.statusCode}` });
          return;
        }

        const fallbackName = filename.replace(/[^a-zA-Z0-9._-]+/g, '_') || 'score.pdf';
        const encodedName = encodeURIComponent(filename).replace(/['()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

        res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'application/pdf');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${fallbackName}"; filename*=UTF-8''${encodedName}`
        );
        proxyRes.pipe(res);
      }
    );

    proxyReq.on('error', (err) => {
      next(new HttpError(502, `Download request failed: ${err.message}`));
    });

    proxyReq.on('timeout', () => {
      proxyReq.destroy();
      next(new HttpError(504, 'Download request timed out'));
    });
  } catch (err) {
    next(err);
  }
});

export default router;
