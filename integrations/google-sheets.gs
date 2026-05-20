/**
 * JOGA+ — Unified Google Sheets webhook
 *
 * One Apps Script Web App handles ALL lead-capture forms on the site.
 * Each submission carries a `formType` that routes it to the correct sheet tab:
 *
 *   formType: 'application'    → "Applications"            (apply.html)
 *   formType: 'training_plan'  → "Training Plan Requests"  (index.html homepage form)
 *   formType: 'booking'        → "Bookings"                (booking.html)
 *   formType: 'pickup'         → "Pickups"                 (pickup-booking-adult/kids.html)
 *
 * SETUP — bind this script to a Google Sheet (one time):
 *   1. Open the JOGA+ Applications sheet → Extensions → Apps Script.
 *   2. Replace ALL existing code with this file. Save (💾).
 *   3. Deploy → Manage deployments → ✏️ on the existing deployment →
 *      Version: "New version" → Deploy. (Don't create a new deployment — the URL would change.)
 *   4. Right-click the existing "Applications" tab → Delete (so new headers regenerate cleanly).
 *
 * IMPORTANT: every form on the site posts JSON with Content-Type: text/plain;charset=utf-8.
 * That's deliberate — it skips the CORS preflight Apps Script Web Apps reject.
 */

const NOTIFY_EMAIL = 'Operations@jogaplusacademy.com';

// Replace with the Google Drive shareable link for the free PDF.
// 1. Upload the PDF to Drive → right-click → Share → "Anyone with the link" → Viewer
// 2. Copy the link and paste below (anything starting with https://drive.google.com/...)
const FREE_GUIDE_DOWNLOAD_URL = 'https://drive.google.com/REPLACE_WITH_YOUR_PDF_LINK';

// Master "All Leads" tab — every submission, regardless of which form, also lands here
// with normalized columns so the owner sees one unified pipeline. Status is a dropdown.
const LEADS_MASTER_TAB = 'All Leads';
const LEADS_HEADERS = [
  'Submitted At', 'Name', 'Phone', 'Email',
  'Sport', 'Level', 'Goal', 'Location', 'Availability',
  'Source Form', 'Page', 'Referrer', 'UTM',
  'Notes', 'Status', 'Last Contact',
];
const LEADS_STATUS_OPTIONS = ['New', 'Contacted', 'Trial Booked', 'Joined', 'Lost'];

// Sessions tab — drives the live pickup schedule on /pickup-booking-*.html.
// Owner edits this tab in the sheet; pages fetch via doGet({action:'sessions',audience:...}).
const SESSIONS_TAB = 'Sessions';
const SESSIONS_HEADERS = ['id','audience','sport','location','day','date','time','price','spots','stripeUrl','active'];
const SESSIONS_SEED = [
  { id:'ad-sc-01', audience:'adult', sport:'Soccer',    location:'Rockville, MD',    day:'Saturday',  date:'May 16', time:'9:00 AM – 11:00 AM',  price:12, spots:'8 spots left',   stripeUrl:'', active:'yes' },
  { id:'ad-sc-02', audience:'adult', sport:'Soccer',    location:'Arlington, VA',    day:'Sunday',    date:'May 17', time:'10:00 AM – 12:00 PM', price:15, spots:'Filling fast',   stripeUrl:'', active:'yes' },
  { id:'ad-fv-01', audience:'adult', sport:'Futvolley', location:'Rockville, MD',    day:'Saturday',  date:'May 16', time:'1:00 PM – 3:00 PM',   price:15, spots:'4 spots left',   stripeUrl:'', active:'yes' },
  { id:'ad-fv-02', audience:'adult', sport:'Futvolley', location:'Washington DC',    day:'Wednesday', date:'May 20', time:'7:00 PM – 9:00 PM',   price:10, spots:'10 spots left',  stripeUrl:'', active:'yes' },
  { id:'ad-sc-03', audience:'adult', sport:'Soccer',    location:'Bethesda, MD',     day:'Friday',    date:'May 22', time:'6:30 PM – 8:30 PM',   price:12, spots:'15 spots left',  stripeUrl:'', active:'yes' },
  { id:'ad-fv-03', audience:'adult', sport:'Futvolley', location:'Falls Church, VA', day:'Saturday',  date:'May 23', time:'11:00 AM – 1:00 PM',  price:15, spots:'Filling fast',   stripeUrl:'', active:'yes' },
  { id:'kd-sc-01', audience:'kids',  sport:'Soccer',    location:'Rockville, MD',    day:'Saturday',  date:'May 16', time:'10:00 AM – 11:30 AM', price:12, spots:'12 spots left',  stripeUrl:'', active:'yes' },
  { id:'kd-sc-02', audience:'kids',  sport:'Soccer',    location:'Arlington, VA',    day:'Sunday',    date:'May 17', time:'9:00 AM – 10:30 AM',  price:10, spots:'Filling fast',   stripeUrl:'', active:'yes' },
  { id:'kd-fv-01', audience:'kids',  sport:'Futvolley', location:'Rockville, MD',    day:'Saturday',  date:'May 16', time:'12:00 PM – 1:30 PM',  price:15, spots:'5 spots left',   stripeUrl:'', active:'yes' },
  { id:'kd-fv-02', audience:'kids',  sport:'Futvolley', location:'Washington DC',    day:'Sunday',    date:'May 17', time:'11:00 AM – 12:30 PM', price:12, spots:'8 spots left',   stripeUrl:'', active:'yes' },
  { id:'kd-sc-03', audience:'kids',  sport:'Soccer',    location:'Bethesda, MD',     day:'Saturday',  date:'May 23', time:'10:00 AM – 11:30 AM', price:12, spots:'20 spots left',  stripeUrl:'', active:'yes' },
  { id:'kd-fv-03', audience:'kids',  sport:'Futvolley', location:'Falls Church, VA', day:'Saturday',  date:'May 23', time:'1:00 PM – 2:30 PM',   price:15, spots:'Filling fast',   stripeUrl:'', active:'yes' },
];

// One row of metadata per form type: tab name, ordered headers, row builder, alert subject builder.
const FORM_TYPES = {
  application: {
    sheet: 'Applications',
    headers: [
      'Submitted At', 'Athlete Name', 'Parent / Guardian', 'Phone', 'Email',
      'Age', 'Sport', 'Level', 'Goals', 'Location', 'Availability', 'Notes',
      'Consent', 'Source', 'Referrer', 'UTM',
    ],
    row: (d, t) => [
      t, d.athleteName || '', d.parentName || '', d.phone || '', d.email || '',
      d.age || '', d.sport || '', d.level || '', (d.goals || []).join(', '),
      d.location || '', (d.availability || []).join(', '), d.notes || '',
      d.consent ? 'Yes' : 'No', d.source || '', d.referrer || '', d.utm || '',
    ],
    subject: d => `New JOGA+ application — ${d.athleteName || 'Athlete'} (${d.sport || 'sport TBD'})`,
    master: d => ({
      name: d.athleteName || '',
      sport: d.sport || '',
      level: d.level || '',
      goal: (d.goals || []).join(', '),
      location: d.location || '',
      availability: (d.availability || []).join(', '),
      notes: d.notes || '',
    }),
  },

  training_plan: {
    sheet: 'Training Plan Requests',
    headers: [
      'Submitted At', 'Name', 'Athlete Age', 'Sport', 'Skill Level',
      'Goal', 'Phone', 'Source', 'Referrer',
    ],
    row: (d, t) => [
      t, d.name || '', d.athlete_age || '', d.sport || '', d.skill_level || '',
      d.goal || '', d.phone || '', d.source || '', d.referrer || '',
    ],
    subject: d => `New Training Plan Request — ${d.name || 'Lead'} (${d.sport || 'sport TBD'})`,
    master: d => ({
      name: d.name || '',
      sport: d.sport || '',
      level: d.skill_level || '',
      goal: d.goal || '',
      location: '',
      availability: '',
      notes: d.athlete_age ? `Athlete age: ${d.athlete_age}` : '',
    }),
  },

  booking: {
    sheet: 'Bookings',
    headers: [
      'Submitted At', 'Program', 'Full Name', 'Athlete Name', 'Email', 'Phone',
      'Age', 'Level', 'Position', 'Team',
      'Footvolley Experience', 'Sports Background',
      'Tennis Experience', 'Tennis Goal',
      'Goal', 'Type', 'Notes', 'Source',
    ],
    row: (d, t) => [
      t, d.program || '', d.full_name || '', d.athlete_name || '', d.email || '', d.phone || '',
      d.age || '', d.level || '', d.position || '', d.team || '',
      d.footvolley_experience || '', d.sports_background || '',
      d.tennis_experience || '', d.tennis_goal || '',
      d.goal || '', d.type || '', d.notes || '', d.source || '',
    ],
    subject: d => `New Booking — ${d.full_name || d.athlete_name || 'Lead'} (${d.program || 'program TBD'})`,
    master: d => ({
      name: d.athlete_name || d.full_name || '',
      sport: d.program || '',
      level: d.level || '',
      goal: d.goal || d.tennis_goal || '',
      location: '',
      availability: '',
      notes: [d.notes, d.position && `Position: ${d.position}`, d.team && `Team: ${d.team}`,
              d.footvolley_experience && `FV exp: ${d.footvolley_experience}`,
              d.tennis_experience && `Tennis exp: ${d.tennis_experience}`,
              d.type && `Type: ${d.type}`].filter(Boolean).join(' | '),
    }),
  },

  free_guide: {
    sheet: 'Free Guide Downloads',
    headers: [
      'Submitted At', 'Parent Name', 'Email', 'Player Age', 'Skill Level',
      'Source', 'Referrer', 'UTM',
    ],
    row: (d, t) => [
      t, d.parentName || d.name || '', d.email || '', d.playerAge || '',
      d.skillLevel || '', d.source || '', d.referrer || '', d.utm || '',
    ],
    subject: d => `New Free Guide Download — ${d.parentName || d.name || 'Lead'}${d.playerAge ? ' (player age ' + d.playerAge + ')' : ''}`,
    master: d => ({
      name: d.parentName || d.name || '',
      sport: 'Soccer',
      level: d.skillLevel || '',
      goal: 'Free Ball Mastery Guide download',
      location: '',
      availability: '',
      notes: d.playerAge ? `Player age: ${d.playerAge}` : '',
    }),
    autoReply: d => {
      if (!d.email) return null;
      const firstName = (d.parentName || '').split(' ')[0] || 'there';
      return {
        to: d.email,
        subject: 'Your Joga+ 7-Day Ball Mastery Challenge is here',
        body: [
          'Hi ' + firstName + ',',
          '',
          "Thanks for joining the Joga+ 7-Day Ball Mastery Challenge — your guide is ready.",
          '',
          'Download it here: ' + FREE_GUIDE_DOWNLOAD_URL,
          '',
          'A few tips to get the most out of it:',
          '  • 10 minutes a day beats 2 hours once a week — show up daily',
          '  • Same ball, same routine, same time of day if possible',
          '  • Day 7 is a benchmark check — celebrate the wins',
          '',
          "Questions? Just reply to this email or message us on WhatsApp at +1 (301) 818-1797.",
          '',
          'Train hard.',
          'Joga+ Academy',
          'jogaplusacademy.com',
        ].join('\n'),
      };
    },
  },

  footvolley_apply: {
    sheet: 'Footvolley Apply',
    headers: [
      'Submitted At', 'Name', 'Phone', 'Email',
      'Played Before', 'Skill Level',
      'Preferred Location', 'Availability',
      'Notes', 'Source', 'Referrer', 'UTM',
    ],
    row: (d, t) => [
      t, d.name || '', d.phone || '', d.email || '',
      d.playedBefore || '', d.skillLevel || '',
      d.location || '', (d.availability || []).join(', '),
      d.notes || '', d.source || '', d.referrer || '', d.utm || '',
    ],
    subject: d => `New Footvolley Apply — ${d.name || 'Lead'}${d.skillLevel ? ' (' + d.skillLevel + ')' : ''}`,
    master: d => ({
      name: d.name || '',
      sport: 'Footvolley',
      level: d.skillLevel || '',
      goal: d.playedBefore ? `Footvolley flyer (played before: ${d.playedBefore})` : 'Footvolley flyer',
      location: d.location || '',
      availability: (d.availability || []).join(', '),
      notes: d.notes || '',
    }),
  },

  pickup: {
    sheet: 'Pickups',
    headers: [
      'Submitted At', 'Flow', 'Session ID', 'Sport', 'Location',
      'Date', 'Time', 'Price',
      'Athlete First', 'Athlete Last', 'Athlete Age', 'Skill Level',
      'Email', 'Phone',
      'Parent First', 'Parent Last', 'Parent Email', 'Parent Phone',
      'Notes', 'Source',
    ],
    row: (d, t) => {
      const isKids = d.flow === 'kids';
      return [
        t, d.flow || '', d.sessionId || '', d.sessionSport || d.sportSelected || '',
        d.sessionLocation || '', d.sessionDate || '', d.sessionTime || '', d.sessionPrice || '',
        isKids ? (d.childFirst || '') : (d.firstName || ''),
        isKids ? (d.childLast  || '') : (d.lastName  || ''),
        isKids ? (d.childAge   || '') : (d.age       || ''),
        d.level || '',
        isKids ? (d.parentEmail || '') : (d.email || ''),
        isKids ? (d.parentPhone || '') : (d.phone || ''),
        isKids ? (d.parentFirst || '') : '',
        isKids ? (d.parentLast  || '') : '',
        isKids ? (d.parentEmail || '') : '',
        isKids ? (d.parentPhone || '') : '',
        d.notes || '', d.source || '',
      ];
    },
    subject: d => {
      const who = d.flow === 'kids'
        ? (d.childFirst ? `${d.childFirst} ${d.childLast || ''}`.trim() : 'Kids pickup')
        : (d.firstName  ? `${d.firstName}  ${d.lastName  || ''}`.trim() : 'Adult pickup');
      const when = [d.sessionDate, d.sessionTime].filter(Boolean).join(' ');
      return `New Pickup Reservation — ${who} (${d.sessionSport || d.sportSelected || 'sport TBD'}${when ? ', ' + when : ''})`;
    },
    master: d => {
      const isKids = d.flow === 'kids';
      const first  = isKids ? d.childFirst : d.firstName;
      const last   = isKids ? d.childLast  : d.lastName;
      const name   = [first, last].filter(Boolean).join(' ');
      return {
        name: name + (isKids && d.parentFirst ? ` (parent: ${d.parentFirst} ${d.parentLast || ''})` : ''),
        sport: d.sessionSport || d.sportSelected || '',
        level: d.level || '',
        goal: 'Pickup session',
        location: d.sessionLocation || '',
        availability: [d.sessionDate, d.sessionTime].filter(Boolean).join(' · '),
        notes: d.notes || '',
      };
    },
  },
};

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    if (data.website) {
      return jsonOut_({ ok: true, spam: true });
    }

    const formType = data.formType || 'application';
    const meta = FORM_TYPES[formType];
    if (!meta) {
      return jsonOut_({ ok: false, error: 'Unknown formType: ' + formType });
    }

    const submittedAt = data.submittedAt ? new Date(data.submittedAt) : new Date();

    const sheet = getOrCreateSheet_(meta.sheet, meta.headers);
    sheet.appendRow(meta.row(data, submittedAt));

    appendToMasterLeads_(formType, meta, data, submittedAt);
    sendOwnerAlert_(meta, data, submittedAt);
    sendAutoReply_(meta, data);

    return jsonOut_({ ok: true, formType: formType });
  } catch (err) {
    console.error(err);
    return jsonOut_({ ok: false, error: String(err) });
  }
}

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || '';
  if (action === 'sessions') {
    return jsonOut_(getSessions_(e.parameter.audience));
  }
  return ContentService
    .createTextOutput('JOGA+ application endpoint is live.')
    .setMimeType(ContentService.MimeType.TEXT);
}

function getSessions_(audience) {
  const sheet = getOrCreateSessionsSheet_();
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0].map(h => String(h));
  return data.slice(1)
    .map(row => {
      const o = {};
      headers.forEach((h, i) => { o[h] = row[i]; });
      return o;
    })
    .filter(r => String(r.active || '').toLowerCase() === 'yes')
    .filter(r => !audience || String(r.audience || '').toLowerCase() === String(audience).toLowerCase());
}

function getOrCreateSessionsSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SESSIONS_TAB);
  if (!sheet) {
    sheet = ss.insertSheet(SESSIONS_TAB);
    sheet.appendRow(SESSIONS_HEADERS);
    SESSIONS_SEED.forEach(s => sheet.appendRow(SESSIONS_HEADERS.map(h => s[h] !== undefined ? s[h] : '')));
    sheet.getRange(1, 1, 1, SESSIONS_HEADERS.length)
      .setFontWeight('bold')
      .setBackground('#000000')
      .setFontColor('#C5F73A');
    sheet.setFrozenRows(1);
    sheet.setColumnWidths(1, SESSIONS_HEADERS.length, 140);
  }
  return sheet;
}

function sendOwnerAlert_(meta, data, submittedAt) {
  try {
    const subject = meta.subject(data);
    const lines = [`Submitted: ${submittedAt}`, `Form: ${meta.sheet}`, ''];
    Object.keys(data).forEach(k => {
      if (k === 'website' || k === 'submittedAt' || k === 'formType') return;
      const v = data[k];
      const printable = Array.isArray(v) ? v.join(', ') : (v === null || v === undefined ? '' : String(v));
      lines.push(`${k.padEnd(18)}: ${printable}`);
    });
    MailApp.sendEmail({ to: NOTIFY_EMAIL, subject: subject, body: lines.join('\n') });
  } catch (err) {
    console.error('Email alert failed: ' + err);
  }
}

function sendAutoReply_(meta, data) {
  if (!meta.autoReply) return;
  try {
    const reply = meta.autoReply(data);
    if (!reply || !reply.to) return;
    MailApp.sendEmail({
      to: reply.to,
      subject: reply.subject,
      body: reply.body,
      name: 'Joga+ Academy',
      replyTo: NOTIFY_EMAIL,
    });
  } catch (err) {
    console.error('Auto-reply failed: ' + err);
  }
}

function appendToMasterLeads_(formType, meta, data, submittedAt) {
  try {
    const m = meta.master ? meta.master(data) : {};
    const phone = data.phone || data.parentPhone || '';
    const email = data.email || data.parentEmail || '';
    const sheet = getOrCreateLeadsMasterSheet_();
    sheet.appendRow([
      submittedAt,
      m.name || '', phone, email,
      m.sport || '', m.level || '', m.goal || '',
      m.location || '', m.availability || '',
      formType, data.source || '', data.referrer || '', data.utm || '',
      m.notes || '', 'New', '',
    ]);
  } catch (err) {
    console.error('Master leads append failed: ' + err);
  }
}

function getOrCreateLeadsMasterSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(LEADS_MASTER_TAB);
  if (!sheet) {
    sheet = ss.insertSheet(LEADS_MASTER_TAB, 0);  // pinned as the leftmost (first) tab
    sheet.appendRow(LEADS_HEADERS);
    sheet.getRange(1, 1, 1, LEADS_HEADERS.length)
      .setFontWeight('bold')
      .setBackground('#000000')
      .setFontColor('#C5F73A');
    sheet.setFrozenRows(1);
    sheet.setColumnWidths(1, LEADS_HEADERS.length, 150);

    // Status dropdown for the next 1000 rows
    const statusCol = LEADS_HEADERS.indexOf('Status') + 1;
    const range = sheet.getRange(2, statusCol, 1000, 1);
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(LEADS_STATUS_OPTIONS, true)
      .setAllowInvalid(false)
      .build();
    range.setDataValidation(rule);
  }
  return sheet;
}

function getOrCreateSheet_(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#000000')
      .setFontColor('#C5F73A');
    sheet.setFrozenRows(1);
    sheet.setColumnWidths(1, headers.length, 160);
  }
  return sheet;
}

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
