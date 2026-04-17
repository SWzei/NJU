import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import HttpError from '../utils/httpError.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROXY_SCRIPT = path.resolve(__dirname, '../../scripts/imslp_proxy.py');
const PYTHON_CMD = process.env.PYTHON_PATH || 'python3';
const DEFAULT_TIMEOUT_MS = 60000;

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
