const express = require('express');
const path = require('path');
const db = require('./db');
const { seed } = require('./seed');
const auth = require('./auth');
const { loadSettings } = require('./views');

async function main() {
  await db.init();
  await seed();

  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: '1h' }));
  app.use(express.urlencoded({ extended: false, limit: '3mb' }));
  app.use('/api', express.json({ limit: '1mb' }));
  app.get('/healthz', (req, res) => res.send('ok'));
  app.use(async (req, res, next) => {
    try { req.S = await loadSettings(); next(); } catch (e) { next(e); }
  });
  app.use(auth.loadSession);
  app.use(require('./routes/public').router);
  app.use('/admin', require('./routes/admin').router);
  app.use(require('./routes/portal').router);
  app.use((req, res) => res.status(404).redirect('/'));
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).send(`<meta charset="utf-8"><p style="font:12px sans-serif">처리 중 오류가 발생했습니다. ${err.message ? String(err.message).replace(/</g, '&lt;') : ''}</p><p><a href="/">처음으로</a></p>`);
  });

  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`충월시 서버 시작: http://localhost:${port} (${db.isPg ? 'PostgreSQL' : 'SQLite'})`));
}

main().catch((e) => { console.error(e); process.exit(1); });
