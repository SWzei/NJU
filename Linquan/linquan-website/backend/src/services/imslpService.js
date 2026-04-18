import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import https from 'https';
import path from 'path';
import { URL } from 'url';
import HttpError from '../utils/httpError.js';
import { BING_SEARCH_KEY } from '../config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROXY_SCRIPT = path.resolve(__dirname, '../../scripts/imslp_proxy.py');
const PYTHON_CMD = process.env.PYTHON_PATH || 'python3';
const DEFAULT_TIMEOUT_MS = 60000;

const BING_API_HOST = 'api.bing.microsoft.com';
const BING_API_PATH = '/v7.0/search';

export function callImslp(action, args = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const input = JSON.stringify({ action, args });
  const result = spawnSync(PYTHON_CMD, [PROXY_SCRIPT], {
    input,
    encoding: 'utf-8',
    timeout: timeoutMs,
    maxBuffer: 50 * 1024 * 1024, // 50 MB
  });

  if (result.error) {
    if (result.error.code === 'ETIMEDOUT' || result.error.code === 'ENOBUFS') {
      throw new HttpError(504, 'IMSLP request timed out. Please try again.');
    }
    throw new HttpError(502, `IMSLP proxy failed: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const detail = result.stderr?.trim() || `Process exited with code ${result.status}`;
    throw new HttpError(502, `IMSLP proxy failed: ${detail}`);
  }

  const stdout = result.stdout?.trim();
  if (!stdout) {
    throw new HttpError(502, 'IMSLP proxy returned empty output');
  }

  try {
    const parsed = JSON.parse(stdout);
    if (!parsed.ok) {
      throw new HttpError(502, parsed.error || 'IMSLP proxy returned an error');
    }
    return parsed.data;
  } catch (err) {
    throw new HttpError(502, `Invalid response from IMSLP proxy: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Optional Bing Web Search API integration for better IMSLP search coverage
// (especially Chinese queries). Free tier: 1,000 transactions/month.
// ---------------------------------------------------------------------------

function _bingRequest(query, count = 20) {
  return new Promise((resolve, reject) => {
    const encoded = encodeURIComponent(query);
    const url = new URL(`https://${BING_API_HOST}${BING_API_PATH}?q=${encoded}&count=${count}&mkt=en-US`);

    const req = https.get(
      url,
      {
        headers: {
          'Ocp-Apim-Subscription-Key': BING_SEARCH_KEY,
          'User-Agent': 'LinquanBot/1.0',
        },
        timeout: 15000,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 400) {
            reject(new Error(`Bing API returned ${res.statusCode}: ${body.slice(0, 200)}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(new Error(`Invalid JSON from Bing: ${e.message}`));
          }
        });
      }
    );

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Bing API request timed out'));
    });
  });
}

const IMSLP_URL_RE = /^https?:\/\/imslp\.org\/wiki\/(.+)$/;

function _extractImslpPermlink(url) {
  try {
    const m = url.match(IMSLP_URL_RE);
    if (!m) return null;
    let permlink = decodeURIComponent(m[1]);
    // Strip Category: prefix for person pages
    if (permlink.startsWith('Category:')) {
      permlink = permlink.slice('Category:'.length);
    }
    return permlink;
  } catch {
    return null;
  }
}

/**
 * Search IMSLP via Bing Web Search API (site-scoped).
 * Returns items in the same shape as the Python proxy: { items: [...] }
 */
export async function searchBingImslp(rawQuery, count = 20) {
  if (!BING_SEARCH_KEY) {
    return { items: [] };
  }

  const query = `site:imslp.org ${rawQuery}`;
  const data = await _bingRequest(query, count);

  const items = [];
  const seen = new Set();

  const webPages = data?.webPages?.value || [];
  for (const page of webPages) {
    const permlink = _extractImslpPermlink(page.url);
    if (!permlink || seen.has(permlink)) continue;
    seen.add(permlink);

    // Try to extract work title / composer from the Bing snippet or title
    const title = page.name || permlink.replace(/_/g, ' ');
    const snippet = page.snippet || '';

    // Composer heuristic: look for "(ComposerName, FirstName)" in title
    const composerMatch = title.match(/\(([^,)]+,\s*[^)]+)\)$/);
    const composer = composerMatch ? composerMatch[1].trim() : '';
    const worktitle = composerMatch
      ? title.slice(0, composerMatch.index).trim()
      : title;

    items.push({
      id: title,
      permlink,
      intvals: {
        worktitle,
        composer,
      },
      __source: 'bing',
      __snippet: snippet,
    });
  }

  return { items };
}

/**
 * Merge local-cache results with Bing results, deduplicating by permlink
 * and keeping local results first (they have richer metadata).
 */
export function mergeSearchResults(localItems = [], bingItems = []) {
  const seen = new Set();
  const merged = [];

  // Prefer local results first (richer metadata)
  for (const item of localItems) {
    const p = item.permlink;
    if (p && !seen.has(p)) {
      seen.add(p);
      merged.push(item);
    }
  }

  // Append Bing results that are not already present
  for (const item of bingItems) {
    const p = item.permlink;
    if (p && !seen.has(p)) {
      seen.add(p);
      merged.push(item);
    }
  }

  return merged;
}
