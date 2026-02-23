import './config/env.js';
import app from './app.js';
import { HOST, PORT } from './config/env.js';

app.listen(PORT, HOST, () => {
  const publicHost = HOST === '0.0.0.0' ? 'localhost' : HOST;
  // eslint-disable-next-line no-console
  console.log(`NJU林泉钢琴社 backend listening on http://${publicHost}:${PORT}`);
});
