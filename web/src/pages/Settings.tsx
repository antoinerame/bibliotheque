import { useRef, useState } from 'react';
import { api, useData } from '../api';
import { getThemeMode, setThemeMode, type ThemeMode } from '../designs';
import { ErrorLine, PageHead } from '../ui';

const MODES: [ThemeMode, string][] = [['auto', 'Automatique'], ['light', 'Clair'], ['dark', 'Sombre']];

export default function Settings({ me, onLogout }: { me: { authRequired: boolean; mcpTokenSet: boolean }; onLogout: () => void }) {
  const [mode, setMode] = useState<ThemeMode>(getThemeMode());
  const { data: settings } = useData<{ yearlyGoal: number }>('/settings');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const origin = window.location.origin;

  const importFile = async (replace: boolean) => {
    const f = file.current?.files?.[0];
    if (!f) { setError('Choisis d’abord un fichier.'); return; }
    if (replace && !window.confirm('Remplacer TOUTE la bibliothèque par le contenu de ce fichier ? C’est définitif.')) return;
    try {
      const data = JSON.parse(await f.text());
      const r = await api<{ books: number; notes: number; words: number }>('/import', { body: { data, mode: replace ? 'replace' : 'merge' } });
      setError(null);
      setMessage(`Import terminé : ${r.books} livres, ${r.notes} notes, ${r.words} mots.`);
    } catch (err: any) { setMessage(null); setError(err instanceof SyntaxError ? 'Ce fichier n’est pas un JSON valide.' : err.message); }
  };

  return (
    <div className="settings">
      <PageHead title="Réglages" />

      <section className="settings-section">
        <h2 className="section-title">Apparence</h2>
        <div className="chips" role="group" aria-label="Thème clair ou sombre">
          {MODES.map(([m, l]) => (
            <button key={m} type="button" className={`chip${mode === m ? ' chip-on' : ''}`} aria-pressed={mode === m} onClick={() => { setThemeMode(m); setMode(m); }}>{l}</button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h2 className="section-title">Objectif de lecture</h2>
        <label className="goal-setting">
          <input
            key={settings?.yearlyGoal ?? 'x'} className="input input-short" inputMode="numeric" defaultValue={settings?.yearlyGoal || ''}
            aria-label="Nombre de livres par an"
            onBlur={(e) => api('/settings', { method: 'PUT', body: { yearlyGoal: e.target.value } })}
          />
          <span>livres par an</span>
        </label>
      </section>

      <section className="settings-section">
        <h2 className="section-title">Brancher Claude</h2>
        <p>Claude peut ajouter des livres, des résumés, des idées, des citations et des mots pendant vos discussions, et t’interroger sur ce que tu as retenu.</p>
        <p>Adresse du connecteur : <code className="code">{origin}/mcp/&lt;MCP_TOKEN&gt;</code></p>
        <p className="settings-note">
          {me.mcpTokenSet ? 'Un jeton MCP est défini sur le serveur : remplace <MCP_TOKEN> par sa valeur.'
            : me.authRequired ? 'Aucun jeton MCP n’est défini : le connecteur est désactivé.'
            : 'Aucun jeton défini : en local, l’adresse ' + origin + '/mcp est ouverte.'}
        </p>
      </section>

      <section className="settings-section">
        <h2 className="section-title">Sauvegarde</h2>
        <div className="form-actions">
          <a className="btn btn-ghost" href="/api/export" download>Exporter tout (JSON)</a>
        </div>
        <div className="import">
          <input ref={file} type="file" accept="application/json,.json" className="file-input" aria-label="Fichier à importer" />
          <button type="button" className="btn btn-ghost" onClick={() => importFile(false)}>Importer en ajout</button>
          <button type="button" className="btn btn-ghost btn-danger" onClick={() => importFile(true)}>Importer en remplacement</button>
        </div>
        {message && <p className="success" role="status">{message}</p>}
        <ErrorLine error={error} />
      </section>

      {me.authRequired && (
        <section className="settings-section">
          <button type="button" className="btn btn-ghost" onClick={async () => { await api('/logout', { method: 'POST' }); onLogout(); }}>Se déconnecter</button>
        </section>
      )}
    </div>
  );
}
