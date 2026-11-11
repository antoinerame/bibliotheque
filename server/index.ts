import express, { type Request, type Response, type NextFunction } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import './db.ts';
import * as repo from './repo.ts';
import { APP_PASSWORD, MCP_TOKEN, isAuthed, login, logout, mcpAllowed, requireAuth } from './auth.ts';
import { buildMcpServer } from './mcp.ts';
import { lookupBooks } from './lookup.ts';
import { seedIfEmpty } from './seed.ts';

seedIfEmpty();

const app = express();
app.set('trust proxy', true);
app.disable('x-powered-by');
app.use(express.json({ limit: '20mb' }));

/* ---------- MCP (Streamable HTTP, sans état) ---------- */
async function handleMcp(req: Request, res: Response) {
  if (!mcpAllowed(req, req.params.token as string | undefined)) {
    res.status(401).json({ jsonrpc: '2.0', error: { code: -32001, message: 'Jeton MCP manquant ou invalide' }, id: null });
    return;
  }
  const server = buildMcpServer();
  try {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (e) {
    console.error('Erreur MCP :', e);
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Erreur interne' }, id: null });
    }
  }
}
const mcpNotAllowed = (_req: Request, res: Response) => {
  res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Méthode non autorisée' }, id: null });
};
for (const p of ['/mcp', '/mcp/:token']) {
  app.post(p, handleMcp);
  app.get(p, mcpNotAllowed);
  app.delete(p, mcpNotAllowed);
}

/* ---------- auth ---------- */
app.get('/api/me', (req, res) => {
  res.json({ authRequired: !!APP_PASSWORD, authed: isAuthed(req), mcpTokenSet: !!MCP_TOKEN });
});
app.post('/api/login', login);
app.post('/api/logout', logout);

const api = express.Router();
api.use(requireAuth);
const id = (req: Request, name = 'id') => {
  const n = Number(req.params[name]);
  if (!Number.isInteger(n)) throw new repo.HttpError(400, 'Identifiant invalide');
  return n;
};
const num = (v: unknown) => (v === undefined || v === '' ? undefined : Number(v));
const ok = { ok: true };

api.get('/home', (_req, res) => res.json(repo.home()));
api.get('/stats', (_req, res) => res.json(repo.stats()));
api.get('/search', (req, res) => res.json(repo.search(String(req.query.q ?? ''))));
api.get('/lookup', async (req, res) => res.json(await lookupBooks(String(req.query.q ?? ''))));
api.get('/incomplete', (_req, res) => res.json(repo.incomplete()));

api.get('/books', (req, res) => res.json(repo.listBooks({ status: req.query.status ? String(req.query.status) : undefined })));
api.post('/books', (req, res) => res.json(repo.createBook(req.body)));
api.get('/books/:id', (req, res) => res.json(repo.getBook(id(req))));
api.patch('/books/:id', (req, res) => res.json(repo.updateBook(id(req), req.body)));
api.delete('/books/:id', (req, res) => { repo.deleteBook(id(req)); res.json(ok); });
api.post('/books/:id/notes', (req, res) => res.json(repo.createNote(id(req), req.body)));

api.patch('/notes/:id', (req, res) => res.json(repo.updateNote(id(req), req.body)));
api.delete('/notes/:id', (req, res) => { repo.deleteNote(id(req)); res.json(ok); });

api.get('/words', (req, res) => res.json(repo.listWords({ q: req.query.q ? String(req.query.q) : undefined, bookId: num(req.query.bookId) })));
api.post('/words', (req, res) => res.json(repo.createWord(req.body)));
api.patch('/words/:id', (req, res) => res.json(repo.updateWord(id(req), req.body)));
api.delete('/words/:id', (req, res) => { repo.deleteWord(id(req)); res.json(ok); });

api.get('/themes', (_req, res) => res.json(repo.listThemes()));
api.post('/themes', (req, res) => res.json(repo.createTheme(req.body)));
api.get('/themes/:id', (req, res) => res.json(repo.getTheme(id(req))));
api.patch('/themes/:id', (req, res) => { repo.updateTheme(id(req), req.body); res.json(ok); });
api.delete('/themes/:id', (req, res) => { repo.deleteTheme(id(req)); res.json(ok); });

api.get('/review', (req, res) => res.json(repo.dueCards({
  kind: req.query.kind ? String(req.query.kind) : undefined,
  bookId: num(req.query.bookId), limit: num(req.query.limit), all: req.query.all === '1',
})));
api.post('/review', (req, res) => res.json(repo.gradeCard(String(req.body?.kind), Number(req.body?.id), Number(req.body?.grade))));

api.get('/settings', (_req, res) => res.json(repo.getSettings()));
api.put('/settings', (req, res) => res.json(repo.setSettings(req.body)));

api.get('/export', (_req, res) => {
  res.setHeader('Content-Disposition', `attachment; filename="bibliotheque-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json(repo.exportAll());
});
api.post('/import', (req, res) => res.json(repo.importAll(req.body?.data, req.body?.mode === 'replace' ? 'replace' : 'merge')));

// Flux d'événements : l'interface se rafraîchit quand Claude écrit via le MCP.
api.get('/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(': ok\n\n');
  let timer: NodeJS.Timeout | null = null;
  const off = repo.onChange(() => {
    if (timer) return;
    timer = setTimeout(() => { timer = null; res.write('data: change\n\n'); }, 150);
  });
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => { off(); clearInterval(ping); if (timer) clearTimeout(timer); });
});

app.use('/api', api);
app.use('/api', (_req, res) => { res.status(404).json({ error: 'Route inconnue' }); });

/* ---------- interface ---------- */
const webDir = [path.resolve(process.cwd(), 'dist/web'), path.resolve(import.meta.dirname ?? '.', 'web')]
  .find((d) => fs.existsSync(path.join(d, 'index.html')));
if (webDir) {
  app.use(express.static(webDir, { index: false, maxAge: '1h' }));
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    res.sendFile(path.join(webDir, 'index.html'));
  });
}

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err?.status ?? (err?.type === 'entity.parse.failed' ? 400 : 500);
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Erreur interne' : err.message });
});

const PORT = Number(process.env.PORT) || 3100;
app.listen(PORT, () => {
  console.log(`La Bibliothèque écoute sur http://localhost:${PORT}`);
  if (!APP_PASSWORD) console.warn('⚠ APP_PASSWORD non défini : le site est accessible sans mot de passe.');
  if (!MCP_TOKEN) console.warn(APP_PASSWORD
    ? '⚠ MCP_TOKEN non défini : le point d’accès MCP est désactivé.'
    : '⚠ MCP_TOKEN non défini : le point d’accès MCP est ouvert à tous.');
});
