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
  const LEADS_EMAIL = 'jogaplusacademy@gmail.com';
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

  window.JogaSubmit = submit;
})();
