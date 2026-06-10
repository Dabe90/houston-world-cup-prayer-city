'use strict';

const fs = require('fs');
const path = require('path');
const { buildServeDayFlowBlock } = require('../serveDayFlowContent');

const block = buildServeDayFlowBlock({
  roleIds: [
    'prayer-partners',
    'counselors',
    'logistics-welfare',
    'photography-video',
    'social-media',
  ],
  tent: 'Tent A (example)',
});

const doc =
  '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/>' +
  '<meta name="viewport" content="width=device-width,initial-scale=1"/>' +
  '<title>Serve day flow — email preview</title></head>' +
  '<body style="margin:0;background:#e2e8f0;padding:24px 12px;font-family:system-ui,sans-serif;">' +
  '<div style="max-width:640px;margin:0 auto;">' +
  '<p style="font-size:13px;color:#64748b;margin:0 0 16px;">Preview — serve-day block (also included in daily volunteer digest)</p>' +
  block.html +
  '</div></body></html>';

const out = path.join(__dirname, '..', '..', '..', 'outreach', 'serve-day-email-preview.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, doc, 'utf8');
console.log('Wrote:', out);
