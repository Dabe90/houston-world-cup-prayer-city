'use strict';

const fs = require('fs');
const path = require('path');
const volunteerDailyDigest = require('../volunteerDailyDigest');

(async () => {
  const previewDate = process.env.PREVIEW_DATE || volunteerDailyDigest.todayYmdChicago();

  const r = await volunteerDailyDigest.buildDailyVolunteerDigest({
    previewDate,
    name: 'Damilola Preview',
    email: 'preview@example.com',
    shifts:
      'prayer partners counselor logistics and welfare photography and video social media',
    siteBase: 'https://prayercityhtx.com/volunteer/',
    digestUnsubscribeSecret: 'local-preview-only',
    digestUnsubscribeBaseUrl: 'https://prayercityhtx.com/digest-unsub',
    digestResubscribeBaseUrl: 'https://prayercityhtx.com/digest-resub',
  });
  const doc =
    '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/>' +
    '<meta name="viewport" content="width=device-width,initial-scale=1"/>' +
    '<title>Volunteer digest — preview</title></head>' +
    '<body style="margin:0;background:#cbd5e1;">' +
    `<!-- Subject: ${r.subject.replace(/<!--|-->/g, '')} -->\n` +
    r.htmlBody +
    '</body></html>';
  const out = path.join(__dirname, '..', '..', '..', 'volunteer-digest-email-preview.html');
  fs.writeFileSync(out, doc, 'utf8');
  console.log('Wrote:', out);
  console.log('Subject:', r.subject);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
