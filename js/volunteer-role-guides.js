/**
 * Matches signup "shifts" text (column F / Firestore shifts) to role guides.
 * Option labels must match index.html select option values.
 */
(function () {
  var GUIDES = [
    {
      id: 'prayer-partners',
      label: 'Prayer Partners',
      patterns: ['prayer partners', 'prayer partner'],
      short:
        'You’ll welcome people into the tent, listen with care, and pray with them—gently pointing hearts to Jesus. Expect warm conversation, short prayers, and lots of “thank you for being here.”',
      page: 'training/prayer-partners.html',
      icon: 'fa-hands-praying',
    },
    {
      id: 'counselors',
      label: 'Counselors',
      patterns: ['counselors', 'counselor'],
      short:
        'You’ll offer a calm, confidential listening ear for guests who want to talk. You’re not a licensed therapist—you’re a caring presence who can pray, encourage, and refer when needed.',
      page: 'training/counselors.html',
      icon: 'fa-heart',
    },
    {
      id: 'logistics-welfare',
      label: 'Logistics and Welfare',
      patterns: ['logistics and welfare', 'logistics'],
      short:
        'You help everything run smoothly: supplies, snacks, shade, accessibility, and making sure volunteers and guests are safe and looked after. You’re the behind-the-scenes heroes.',
      page: 'training/logistics-welfare.html',
      icon: 'fa-boxes-stacked',
    },
    {
      id: 'photography-video',
      label: 'Photography and Video',
      patterns: ['photography and video', 'photography'],
      short:
        'You’ll capture the story of prayer in Houston—respectfully, with consent, and in line with our media policy. Think celebration of unity, not staging people without permission.',
      page: 'training/photography-video.html',
      icon: 'fa-camera',
    },
    {
      id: 'social-media',
      label: 'Social Media and Virtual Support',
      patterns: ['social media and virtual support', 'social media', 'virtual support'],
      short:
        'You’ll help the world see what God is doing—posts, replies, and online prayer—always with kindness and clarity. Tone: hope-filled, humble, and invitational.',
      page: 'training/social-media.html',
      icon: 'fa-hashtag',
    },
  ];

  function findVolunteerRolesFromShifts(shiftsText) {
    var t = String(shiftsText || '')
      .toLowerCase()
      // Sheet / browsers sometimes swap em dash, en dash, minus — normalize for substring matches
      .replace(/\u2013|\u2014|\u2212/g, '-')
      .replace(/\s+/g, ' ');
    if (!t.trim()) return [];
    var out = [];
    var seen = {};
    GUIDES.forEach(function (g) {
      var hit = g.patterns.some(function (p) {
        return t.indexOf(p) !== -1;
      });
      if (hit && !seen[g.id]) {
        seen[g.id] = true;
        out.push(g);
      }
    });
    return out;
  }

  window.VOLUNTEER_ROLE_GUIDES = GUIDES;
  window.findVolunteerRolesFromShifts = findVolunteerRolesFromShifts;
})();
