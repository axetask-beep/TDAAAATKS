// Meeting summary = the sections of AXE_DIGITAL_Modele_Rapport.docx. This one
// list drives the AI's JSON schema, the editor, the viewer and the exports.
// Mobile keeps a copy (AXETASK_mobile/src/lib/meetingReport.ts): keep in sync.

export type Section =
  | { key: string; label: string; type: 'text'; hint: string }
  | { key: string; label: string; type: 'list'; hint: string }
  | { key: string; label: string; type: 'table'; hint: string; cols: { key: string; label: string }[] };

export const NOT_DISCUSSED = 'Non abordé';

export const SECTIONS: Section[] = [
  { key: 'resume', label: '1. Résumé de la période', type: 'text',
    hint: "3 à 5 lignes : l'essentiel, ce qui a été accompli, les résultats clés, les points d'attention majeurs et ce qui est attendu de la hiérarchie." },
  { key: 'objectifs', label: '2. Objectifs de la période', type: 'list', hint: 'Les objectifs évoqués.' },
  { key: 'activites', label: '3. Activités réalisées', type: 'table',
    hint: 'Statut parmi : Terminé, En cours, En attente, Bloqué, Annulé.',
    cols: [
      { key: 'activite', label: 'Activité / Tâche' }, { key: 'projet', label: 'Projet / Client' },
      { key: 'statut', label: 'Statut' }, { key: 'observations', label: 'Observations' },
    ] },
  { key: 'indicateurs', label: '4. Résultats et indicateurs', type: 'table', hint: 'Chiffres cités en réunion uniquement.',
    cols: [
      { key: 'indicateur', label: 'Indicateur' }, { key: 'objectif', label: 'Objectif' }, { key: 'realise', label: 'Réalisé' },
      { key: 'ecart', label: 'Écart / Taux' }, { key: 'commentaire', label: 'Commentaire' },
    ] },
  { key: 'faits_marquants', label: 'Faits marquants', type: 'list', hint: 'Succès, retour client positif, nouvelle opportunité…' },
  { key: 'difficultes', label: '5. Difficultés rencontrées et solutions', type: 'table',
    hint: 'Impact : Faible, Moyen ou Élevé. Besoin d’arbitrage : Oui ou Non.',
    cols: [
      { key: 'difficulte', label: 'Difficulté / Risque' }, { key: 'impact', label: 'Impact' },
      { key: 'solution', label: 'Solution apportée ou proposée' }, { key: 'arbitrage', label: 'Besoin d’arbitrage' },
    ] },
  { key: 'plan_action', label: '6. Plan d’action — période suivante', type: 'table',
    hint: 'Chaque décision et chaque tâche attribuée, avec la personne et la date si elles ont été dites. Priorité : Haute, Moyenne ou Basse.',
    cols: [
      { key: 'action', label: 'Action prévue' }, { key: 'responsable', label: 'Responsable' },
      { key: 'echeance', label: 'Échéance' }, { key: 'priorite', label: 'Priorité' },
    ] },
  { key: 'besoins', label: '7. Besoins et demandes', type: 'text', hint: 'Ressources, validations, accès, budget, formation ou appui nécessaires.' },
  { key: 'observations', label: '8. Observations et recommandations', type: 'text', hint: 'Remarques libres, suggestions, idées.' },
];

// Header fields the AI fills from what was said (author, date… come from the app).
export const HEADER = [
  { key: 'intitule', label: 'Intitulé' },
  { key: 'projet_client', label: 'Projet / Client' },
  { key: 'participants', label: 'Participants' },
] as const;

export type Row = Record<string, string>;
export type MeetingSummary = Record<string, string | string[] | Row[]>;

export interface MeetingContent {
  summary: MeetingSummary;
  transcript: string;
  duration_s: number;
  recorded_at: string;
}

// JSON schema handed to the AI (structured output).
export function summarySchema() {
  const str = (description?: string) => ({ type: 'string', ...(description ? { description } : {}) });
  const properties: Record<string, unknown> = {};
  for (const h of HEADER) properties[h.key] = str(h.label);
  for (const s of SECTIONS) {
    if (s.type === 'text') properties[s.key] = str(s.hint);
    else if (s.type === 'list') properties[s.key] = { type: 'array', items: str(), description: s.hint };
    else properties[s.key] = {
      type: 'array', description: s.hint,
      items: { type: 'object', properties: Object.fromEntries(s.cols.map(c => [c.key, str(c.label)])), required: s.cols.map(c => c.key) },
    };
  }
  return { type: 'object', properties, required: Object.keys(properties) };
}

export const SUMMARY_PROMPT = `Tu es l'assistant d'AXE DIGITAL. Voici la transcription d'une réunion.
Rédige le compte rendu en français en suivant exactement le modèle de rapport d'activité AXE DIGITAL (schéma JSON fourni).
Règles :
- N'invente RIEN. Uniquement ce qui a été dit.
- Champ texte non abordé : « ${NOT_DISCUSSED} ». Liste ou tableau non abordé : tableau vide.
- Style professionnel, phrases courtes.
- Le plan d'action est la partie la plus importante : relève chaque décision et chaque tâche attribuée.`;

export const TRANSCRIBE_PROMPT = `Transcris fidèlement cet extrait audio d'une réunion en français.
Texte brut uniquement, sans commentaire. Si plusieurs voix se distinguent, commence chaque prise de parole par un tiret.
Si l'extrait est silencieux, réponds exactement : (silence)`;

const list = (v: unknown) => (Array.isArray(v) ? v.map(String).map(s => s.trim()).filter(Boolean) : []);
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

// Stand-alone HTML in the template's look: shown in print (PDF) and saved as .doc (Word opens it).
export function summaryHtml(c: MeetingContent, meta: { title: string; author: string; date: string }) {
  const s = c.summary;
  const td = 'border:1px solid #9CA3AF;padding:6px;vertical-align:top';
  const th = `${td};background:#1E3A8A;color:#fff;text-align:left`;
  const h2 = 'font-size:13pt;color:#1E3A8A;border-bottom:2px solid #1E3A8A;margin:18px 0 6px';
  const body = SECTIONS.map(sec => {
    const v = s[sec.key];
    let inner: string;
    if (sec.type === 'text') inner = `<p>${esc(v || NOT_DISCUSSED).replace(/\n/g, '<br>')}</p>`;
    else if (sec.type === 'list') inner = list(v).length ? `<ul>${list(v).map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : `<p>${NOT_DISCUSSED}</p>`;
    else {
      const rows = (v as Row[] | undefined) || [];
      inner = rows.length
        ? `<table style="border-collapse:collapse;width:100%;font-size:10pt"><tr>${sec.cols.map(col => `<th style="${th}">${esc(col.label)}</th>`).join('')}</tr>${rows.map(r => `<tr>${sec.cols.map(col => `<td style="${td}">${esc(r[col.key])}</td>`).join('')}</tr>`).join('')}</table>`
        : `<p>${NOT_DISCUSSED}</p>`;
    }
    return `<h2 style="${h2}">■ ${esc(sec.label)}</h2>${inner}`;
  }).join('');
  const head = [
    ['Intitulé', s.intitule || meta.title], ['Type de rapport', 'Réunion'], ['Rédigé par', meta.author],
    ['Date', meta.date], ['Projet / Client', s.projet_client], ['Participants', s.participants],
  ].map(([k, v]) => `<tr><td style="${td};width:30%;background:#EFF6FF;font-weight:bold">${esc(k)}</td><td style="${td}">${esc(v || '—')}</td></tr>`).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(meta.title)}</title></head>
<body style="font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#111;max-width:800px;margin:auto;padding:16px">
<h1 style="font-size:18pt;color:#1E3A8A">■ RAPPORT D'ACTIVITÉ — RÉUNION</h1>
<table style="border-collapse:collapse;width:100%;font-size:10pt">${head}</table>
${body}
<h2 style="${h2}">■ 9. Validation</h2>
<table style="border-collapse:collapse;width:100%;font-size:10pt"><tr><th style="${th}">Rédigé par</th><th style="${th}">Validé par</th></tr>
<tr><td style="${td};height:70px">Nom : ${esc(meta.author)}<br>Date : ${esc(meta.date)}<br>Signature :</td><td style="${td}">Nom :<br>Date :<br>Signature :</td></tr></table>
</body></html>`;
}

// Plain text (mobile viewer, sharing).
export function summaryText(c: MeetingContent) {
  const s = c.summary;
  const out: string[] = [];
  for (const h of HEADER) if (s[h.key]) out.push(`${h.label} : ${s[h.key]}`);
  for (const sec of SECTIONS) {
    out.push('', sec.label.toUpperCase());
    const v = s[sec.key];
    if (sec.type === 'text') out.push(String(v || NOT_DISCUSSED));
    else if (sec.type === 'list') out.push(...(list(v).length ? list(v).map(i => `• ${i}`) : [NOT_DISCUSSED]));
    else out.push(...((v as Row[])?.length ? (v as Row[]).map(r => `• ${sec.cols.map(col => r[col.key]).filter(Boolean).join(' — ')}`) : [NOT_DISCUSSED]));
  }
  return out.join('\n').trim();
}
