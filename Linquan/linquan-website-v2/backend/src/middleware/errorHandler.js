import HttpError from '../utils/httpError.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  // Keep detailed server-side logs for production debugging.
  // eslint-disable-next-line no-console
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, err);

  if (err instanceof HttpError) {
    return res.status(err.status).json({
      message: err.message,
      details: err.details
    });
  }

  return res.status(500).json({
    message: 'Internal server error',
    details: process.env.NODE_ENV === 'production' ? undefined : err.message
  });
}
