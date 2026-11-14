import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(root, 'js/nigeria-units.js'), 'utf8');
const sandbox = { window: {}, console };
sandbox.global = sandbox;
sandbox.window = sandbox;
vm.runInNewContext(src, sandbox);
const NU = sandbox.NigeriaUnits;

const mary = {
  name: 'Mary Adeola',
  unitId: 'moderators-presenters',
  unitLabel: 'Moderators & Presenters',
  role: 'member',
  units: [
    { unitId: 'moderators-presenters', unitLabel: 'Moderators & Presenters', role: 'member' },
    { unitId: 'bible-study', unitLabel: 'Bible Study Team', role: 'member' },
    { unitId: 'media', unitLabel: 'Media Team', role: 'leader' },
    { unitId: 'group3', unitLabel: 'Group 3', role: 'member' },
  ],
};

function fail(msg) {
  console.error('FAIL', msg);
  process.exit(1);
}

if (!NU.getUnit('media') || NU.getUnit('media').label !== 'Media Team') {
  fail('NigeriaUnits is missing Media Team');
}

const droppedByOldDashboard = [
  {
    unitId: 'moderators-presenters',
    unitLabel: 'Moderators & Presenters',
    role: 'member',
    canSubmitReport: false,
  },
  { unitId: 'bible-study', unitLabel: 'Bible Study Team', role: 'member', canSubmitReport: false },
  { unitId: 'group3', unitLabel: 'Group 3', role: 'member', canSubmitReport: false },
];

const merged = NU.mergeUnitContexts(droppedByOldDashboard, mary, false);
const ids = merged.map((c) => c.unitId);
const media = merged.find((c) => c.unitId === 'media');

if (!ids.includes('media')) fail('Reports picker still missing media after merge: ' + ids.join(','));
if (ids[0] !== 'media') fail('For Mary, Media Team should be first (she leads it), got ' + ids[0]);
const abe = {
  name: 'damilola abe',
  units: [
    { unitId: 'group6', unitLabel: 'Group 6', role: 'leader' },
    { unitId: 'internal-leaders', unitLabel: 'Internal Leaders Meeting', role: 'leader' },
  ],
};
const abeMerged = NU.mergeUnitContexts(
  [
    { unitId: 'group6', unitLabel: 'Group 6', role: 'leader' },
    { unitId: 'internal-leaders', unitLabel: 'Internal Leaders Meeting', role: 'leader' },
  ],
  abe,
  true
);
if (abeMerged.some((c) => c.unitId === 'media')) {
  fail('Abe must not be attached to Media Team');
}
if (!media || media.role !== 'leader' || !media.canSubmitReport || !media.isLeaderView) {
  fail('Media Team is not marked as a unit she can submit for');
}

const reportJs = fs.readFileSync(path.join(root, 'js/nigeria-dashboard-report.js'), 'utf8');
if (!reportJs.includes('NigeriaUnits.mergeUnitContexts')) {
  fail('Reports tab does not call mergeUnitContexts');
}

const dashJs = fs.readFileSync(path.join(root, 'js/nigeria-dashboard.js'), 'utf8');
if (!dashJs.includes('NigeriaUnits.mergeUnitContexts')) {
  fail('Dashboard does not call mergeUnitContexts');
}

console.log('PASS Media Team is on Reports for Mary Adeola');
console.log('order:', merged.map((c) => c.unitLabel + (c.role === 'leader' ? ' (lead)' : '')).join(' → '));
