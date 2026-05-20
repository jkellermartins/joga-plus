/**
 * JOGA+ — shared client-side lead submitter.
 *
 * Every lead form on the site funnels through window.JogaSubmit(payload, opts).
 * Behavior:
 *   1. POSTs JSON to the Apps Script webhook (text/plain to skip CORS preflight).
 *   2. Mirrors the submission to localStorage so /admin-leads.html can show it.
 *   3. On endpoint failure, opens a mailto fallback so no lead is ever lost.
 *
 * Usage:
 *   const ok = await JogaSubmit({ formType: 'training_plan', name, phone, ... });
 *   if (ok) location.href = 'thankyou.html';
 */
(function () {
  const ENDPOINT = 'https://script.google.com/macros/s/AKfycbyAeH6UsViMaJF42DrZnR_ebT4vgjhx0xAVX-KIsAji4LdpVj9aM-nGWipS2KRpb3XL/exec';
  const LEADS_EMAIL = 'Operations@jogaplusacademy.com';
  const ARCHIVE_KEY = 'joga_apply_submissions';

  function archive(payload) {
    try {
      const list = JSON.parse(localStorage.getItem(ARCHIVE_KEY) || '[]');
      list.unshift(payload);
      localStorage.setItem(ARCHIVE_KEY, JSON.stringify(list.slice(0, 50)));
    } catch (e) { /* private mode / quota — ignore */ }
  }

  function buildMailto(payload) {
    const subject = `New JOGA+ ${payload.formType || 'lead'} — ${payload.name || payload.athleteName || payload.full_name || payload.firstName || payload.childFirst || 'Lead'}`;
    const body = Object.entries(payload)
      .filter(([k]) => k !== 'website')
      .map(([k, v]) => `${k.padEnd(18)}: ${Array.isArray(v) ? v.join(', ') : (v ?? '')}`)
      .join('\n');
    return `mailto:${encodeURIComponent(LEADS_EMAIL)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  async function submit(payload) {
    const enriched = Object.assign({
      submittedAt: new Date().toISOString(),
      source: window.location.origin + window.location.pathname,
      referrer: document.referrer || '',
    }, payload);

    archive(enriched);

    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(enriched),
        redirect: 'follow',
      });
      if (!res.ok) throw new Error('Endpoint returned ' + res.status);
      return { ok: true, mode: 'endpoint' };
    } catch (err) {
      console.warn('[Joga+] webhook failed, opening mailto fallback', err);
      try { window.location.href = buildMailto(enriched); } catch (e) {}
      return { ok: false, mode: 'mailto', error: String(err) };
    }
  }

  /**
   * Fetches live pickup sessions from the Apps Script Web App.
   * Normalizes the `date` field — when a sheet cell is typed as a date,
   * Apps Script returns an ISO timestamp; we render it as e.g. "May 16".
   * Returns [] on failure so pages can fall back to a friendly empty state.
   */
  async function fetchSessions(audience) {
    try {
      const url = ENDPOINT + '?action=sessions' + (audience ? '&audience=' + encodeURIComponent(audience) : '');
      const res = await fetch(url, { method: 'GET', redirect: 'follow' });
      if (!res.ok) throw new Error('Sessions fetch returned ' + res.status);
      const list = await res.json();
      return Array.isArray(list) ? list.map(normalizeSession) : [];
    } catch (err) {
      console.warn('[Joga+] fetchSessions failed', err);
      return [];
    }
  }

  function normalizeSession(s) {
    return Object.assign({}, s, { date: prettyDate(s.date) });
  }

  function prettyDate(v) {
    if (v == null || v === '') return '';
    // Sheets-typed-as-date → ISO string like "2026-05-16T04:00:00.000Z"
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
      const d = new Date(v);
      if (!isNaN(d)) return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    }
    return String(v);
  }

  window.JogaSubmit = submit;
  window.JogaFetchSessions = fetchSessions;
})();
