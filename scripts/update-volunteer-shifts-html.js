'use strict';
const fs = require('fs');
const path = require('path');

const p = path.join(__dirname, '..', 'volunteer', 'index.html');
let s = fs.readFileSync(p, 'utf8');

const slotBlock =
  /<div class="space-y-1">\s*<label class="block text-sm text-gray-600">10:00 AM – 11:00 AM<\/label>\s*<select name="shift_[^"]+_10-11"[\s\S]*?<\/select>\s*<\/div>/g;
s = s.replace(slotBlock, '');

s = s.replace(
  /<div class="space-y-1">\s*<label class="block text-sm text-gray-600">4:00 PM – 5:00 PM<\/label>\s*<select name="shift_2026-06-26_16-17"[\s\S]*?<\/select>\s*<\/div>/g,
  ''
);
s = s.replace(
  /<div class="space-y-1">\s*<label class="block text-sm text-gray-600">5:00 PM – 6:00 PM<\/label>\s*<select name="shift_2026-06-26_17-18"[\s\S]*?<\/select>\s*<\/div>/g,
  ''
);

if (!s.includes('shift_2026-06-26_21-22')) {
  s = s.replace(
    /(<select name="shift_2026-06-26_20-21"[\s\S]*?<\/select>\s*<\/div>)/,
    `$1
                  <div class="space-y-1">
                    <label class="block text-sm text-gray-600">9:00 PM – 10:00 PM</label>
                    <select name="shift_2026-06-26_21-22" class="slot-select w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-linkedin focus:border-linkedin outline-none">
                      <option value="">-- Not volunteering this slot --</option>
                      <option value="Prayer Partners">Prayer Partners</option>
                      <option value="Counselors">Counselors</option>
                      <option value="Logistics and Welfare">Logistics and Welfare</option>
                      <option value="Photography and Video">Photography and Video</option>
                      <option value="Social Media and Virtual Support">Social Media and Virtual Support</option>
                    </select>
                  </div>`
  );
}

const newMeta = `      const SLOT_META = {
        'shift_2026-06-14_11-12': { date: 'June 14, 2026', time: '11:00 AM – 12:00 PM' },
        'shift_2026-06-14_12-13': { date: 'June 14, 2026', time: '12:00 PM – 1:00 PM' },
        'shift_2026-06-14_13-14': { date: 'June 14, 2026', time: '1:00 PM – 2:00 PM' },
        'shift_2026-06-14_14-15': { date: 'June 14, 2026', time: '2:00 PM – 3:00 PM' },
        'shift_2026-06-17_11-12': { date: 'June 17, 2026', time: '11:00 AM – 12:00 PM' },
        'shift_2026-06-17_12-13': { date: 'June 17, 2026', time: '12:00 PM – 1:00 PM' },
        'shift_2026-06-17_13-14': { date: 'June 17, 2026', time: '1:00 PM – 2:00 PM' },
        'shift_2026-06-17_14-15': { date: 'June 17, 2026', time: '2:00 PM – 3:00 PM' },
        'shift_2026-06-20_11-12': { date: 'June 20, 2026', time: '11:00 AM – 12:00 PM' },
        'shift_2026-06-20_12-13': { date: 'June 20, 2026', time: '12:00 PM – 1:00 PM' },
        'shift_2026-06-20_13-14': { date: 'June 20, 2026', time: '1:00 PM – 2:00 PM' },
        'shift_2026-06-20_14-15': { date: 'June 20, 2026', time: '2:00 PM – 3:00 PM' },
        'shift_2026-06-23_11-12': { date: 'June 23, 2026', time: '11:00 AM – 12:00 PM' },
        'shift_2026-06-23_12-13': { date: 'June 23, 2026', time: '12:00 PM – 1:00 PM' },
        'shift_2026-06-23_13-14': { date: 'June 23, 2026', time: '1:00 PM – 2:00 PM' },
        'shift_2026-06-23_14-15': { date: 'June 23, 2026', time: '2:00 PM – 3:00 PM' },
        'shift_2026-06-26_18-19': { date: 'June 26, 2026', time: '6:00 PM – 7:00 PM' },
        'shift_2026-06-26_19-20': { date: 'June 26, 2026', time: '7:00 PM – 8:00 PM' },
        'shift_2026-06-26_20-21': { date: 'June 26, 2026', time: '8:00 PM – 9:00 PM' },
        'shift_2026-06-26_21-22': { date: 'June 26, 2026', time: '9:00 PM – 10:00 PM' },
        'shift_2026-06-29_11-12': { date: 'June 29, 2026', time: '11:00 AM – 12:00 PM' },
        'shift_2026-06-29_12-13': { date: 'June 29, 2026', time: '12:00 PM – 1:00 PM' },
        'shift_2026-06-29_13-14': { date: 'June 29, 2026', time: '1:00 PM – 2:00 PM' },
        'shift_2026-06-29_14-15': { date: 'June 29, 2026', time: '2:00 PM – 3:00 PM' },
        'shift_2026-07-04_11-12': { date: 'July 4, 2026', time: '11:00 AM – 12:00 PM' },
        'shift_2026-07-04_12-13': { date: 'July 4, 2026', time: '12:00 PM – 1:00 PM' },
        'shift_2026-07-04_13-14': { date: 'July 4, 2026', time: '1:00 PM – 2:00 PM' },
        'shift_2026-07-04_14-15': { date: 'July 4, 2026', time: '2:00 PM – 3:00 PM' },
      }`;

s = s.replace(/const SLOT_META = \{[\s\S]*?\n      \};/, newMeta);

fs.writeFileSync(p, s);
console.log('Fixed', p);
