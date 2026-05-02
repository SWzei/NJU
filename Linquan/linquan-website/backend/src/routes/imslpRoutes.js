import express from 'express';
import https from 'https';
import http from 'http';
import path from 'path';
import { URL } from 'url';
import { callImslp, searchBingImslp } from '../services/imslpService.js';
import {
  getWorkMetadata,
  getComposerMetadata,
  searchWorksMeta,
  searchComposersMeta,
  getFilterOptions,
  getComposerTypeDistributionForChart,
  getComposerInstrumentDistributionForChart,
  getWorksMetadataBatch,
  tokenizeQuery,
  normalizeText,
  inferMetadataFromTitle,
  saveInferredWorkMetadata,
} from '../services/imslpMetadataService.js';
import { BING_SEARCH_KEY } from '../config/env.js';
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

function isRelevantToQuery(item, titleQuery, composerQuery) {
  const workTitle = normalizeText(item.intvals?.worktitle || item.id || '');
  const itemComposer = normalizeText(item.intvals?.composer || '');

  if (composerQuery) {
    const tokens = tokenizeQuery(composerQuery);
    if (tokens.length > 0 && !tokens.some((t) => itemComposer.includes(t))) {
      return false;
    }
  }

  if (titleQuery) {
    const tokens = tokenizeQuery(titleQuery);
    if (tokens.length > 0 && !tokens.some((t) => workTitle.includes(t))) {
      return false;
    }
  }

  return true;
}

router.get('/imslp/works', async (req, res, next) => {
  try {
    const { title, composer, period, instrument, type } = req.query;

    // 1. Always query metadata DB first (default list or filtered search)
    const metaItems = searchWorksMeta({
      title: title || undefined,
      composer: composer || undefined,
      period: period || undefined,
      instrument: instrument || undefined,
      type: type || undefined,
      limit: 50,
    });

    // 2. If metadata results are abundant, return them directly.
    //    If sparse, fall back to IMSLP proxy + Bing, but filter out irrelevant items.
    let merged = [...metaItems];
    if (metaItems.length < 10) {
      const bingQuery = [composer, title].filter(Boolean).join(' ');
      let bingPromise;
      if (BING_SEARCH_KEY && bingQuery) {
        bingPromise = searchBingImslp(bingQuery, 20);
      } else {
        bingPromise = Promise.resolve({ items: [] });
      }

      const [localData, bingData] = await Promise.all([
        callImslp('search_works', {
          title: title || undefined,
          composer: composer || undefined,
        }),
        bingPromise,
      ]);

      const seen = new Set(metaItems.map((i) => i.permlink));

      for (const item of localData?.items || []) {
        if (item.permlink && !seen.has(item.permlink) && isRelevantToQuery(item, title, composer)) {
          seen.add(item.permlink);
          const metadata = getWorkMetadata(item.id);
          if (metadata) {
            item.metadata = metadata;
          } else {
            const inferred = inferMetadataFromTitle(item.id);
            if (inferred) {
              item.metadata = inferred;
              try { saveInferredWorkMetadata(item.id, inferred); } catch {}
            }
          }
          merged.push(item);
        }
      }

      for (const item of bingData?.items || []) {
        if (item.permlink && !seen.has(item.permlink) && isRelevantToQuery(item, title, composer)) {
          seen.add(item.permlink);
          const inferred = inferMetadataFromTitle(item.id);
          if (inferred) {
            item.metadata = inferred;
            try { saveInferredWorkMetadata(item.id, inferred); } catch {}
          }
          merged.push(item);
        }
      }
    }

    res.json({ items: merged });
  } catch (err) {
    next(err);
  }
});

router.get('/imslp/people', async (req, res, next) => {
  try {
    const { name, period, instrument, type } = req.query;

    // 1. Query metadata DB first
    const metaItems = searchComposersMeta({
      name: name || undefined,
      period: period || undefined,
      instrument: instrument || undefined,
      type: type || undefined,
      limit: 50,
    });

    // 2. Fall back to existing search if metadata results are sparse
    let merged = metaItems;
    if (metaItems.length < 10) {
      let bingPromise;
      if (BING_SEARCH_KEY && name) {
        bingPromise = searchBingImslp(name, 20);
      } else {
        bingPromise = Promise.resolve({ items: [] });
      }

      const [localData, bingData] = await Promise.all([
        callImslp('search_people', {
          name: name || undefined,
        }),
        bingPromise,
      ]);

      const seen = new Set(metaItems.map((i) => i.permlink));

      for (const item of localData?.items || []) {
        if (item.permlink && !seen.has(item.permlink)) {
          seen.add(item.permlink);
          merged.push(item);
        }
      }

      for (const item of bingData?.items || []) {
        if (item.permlink && !seen.has(item.permlink)) {
          seen.add(item.permlink);
          merged.push(item);
        }
      }
    }

    res.json({ items: merged });
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
    // Preserve page-scraped metadata under a separate key so it doesn't
    // clash with the local SQLite metadata.
    if (data?.metadata) {
      data.pageMetadata = data.metadata;
    }
    const metadata = getWorkMetadata(data?.title);

    if (metadata) {
      data.metadata = metadata;
    }
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
    const name = permlink.replace(/_/g, ' ');
    const metadata = getComposerMetadata(name);
    const data = { permlink, name };
    if (metadata) {
      data.metadata = metadata;
      data.metadata.typeDistributionChartData = getComposerTypeDistributionForChart(name);
      data.metadata.instrumentDistributionChartData = getComposerInstrumentDistributionForChart(name);
    }
    res.json(data);
  } catch (err) {
    next(err);
  }
});

function extractAuthorFromTitle(title) {
  const m = String(title).match(/\(([^)]+)\)$/);
  return m ? m[1].trim() : '';
}

function groupCategoryRows(rows, composerName) {
  const self = [];
  const various = [];
  const others = [];
  for (const row of rows) {
    const author = extractAuthorFromTitle(row.Title);
    if (author === composerName) {
      self.push(row);
    } else if (author === 'Various') {
      various.push(row);
    } else {
      others.push(row);
    }
  }
  const result = {};
  if (self.length) result.self = self;
  if (others.length) result.others = others;
  if (various.length) result.various = various;
  return result;
}

router.get('/imslp/people/:permlink/works', async (req, res, next) => {
  try {
    const { permlink } = req.params;
    if (!permlink || permlink.length > 512) {
      throw new HttpError(400, 'Invalid permlink');
    }
    const composerName = permlink.replace(/_/g, ' ');
    const data = await callImslp('person_detail', { permlink });
    const rawTables = data?.categoryTables || {};
    const groupedTables = {};
    for (const [category, rows] of Object.entries(rawTables)) {
      if (!rows || !rows.length) continue;
      const groups = groupCategoryRows(rows, composerName);
      if (Object.keys(groups).length > 0) {
        groupedTables[category] = groups;
      }
    }

    // Batch-fetch metadata for all works
    const allTitles = [];
    for (const category of Object.values(groupedTables)) {
      for (const group of Object.values(category)) {
        for (const row of group) {
          if (row.Title) allTitles.push(row.Title);
        }
      }
    }
    const batchMeta = getWorksMetadataBatch(allTitles);
    for (const category of Object.values(groupedTables)) {
      for (const group of Object.values(category)) {
        for (const row of group) {
          if (row.Title && batchMeta[row.Title]) {
            row.__metadata = batchMeta[row.Title];
          } else if (row.Title) {
            const inferred = inferMetadataFromTitle(row.Title);
            if (inferred) {
              row.__metadata = inferred;
              try { saveInferredWorkMetadata(row.Title, inferred); } catch {}
            }
          }
        }
      }
    }

    res.json({ groupedTables });
  } catch (err) {
    next(err);
  }
});

router.get('/imslp/filters', (req, res) => {
  const options = getFilterOptions();
  res.json(options || { periods: [], instruments: [], types: [] });
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
