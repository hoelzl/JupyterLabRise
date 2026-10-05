// Cache headers the RISE app's static files are served with.
//   npx tsx src/probe-headers.ts <dir>
import { startServer } from './servers.js';
import { TOKEN } from './config.js';

async function main() {
  const server = await startServer('new', process.argv[2]);
  try {
    const page = await (await fetch(`${server.baseUrl}/rise/t.ipynb?token=${TOKEN}`)).text();
    console.log('script tags:', page.match(/<script[^>]*src="[^"]*"/g));
    for (const p of ['/static/rise/bundle.js', '/static/rise/3924.bundle.js']) {
      const r = await fetch(`${server.baseUrl}${p}`, { headers: { Authorization: `token ${TOKEN}` } });
      console.log(p, r.status, ['cache-control', 'etag', 'last-modified', 'expires'].map(h => `${h}=${r.headers.get(h)}`).join(' '));
    }
  } finally {
    server.stop();
  }
}
main().catch(e => { console.error(e); process.exit(1); });
