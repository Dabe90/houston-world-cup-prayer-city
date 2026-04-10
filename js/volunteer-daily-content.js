/**
 * Deterministic daily content by local date (same for all volunteers that day).
 * Social / prayer / counselor modules use seeded shuffles.
 */
(function () {
  var SITE_DEFAULT = 'https://houston-world-cup-prayer-city.vercel.app/';

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function todayYmd() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function hashStr(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    return h >>> 0;
  }

  function mulberry32(seed) {
    return function () {
      var t = (seed += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pickN(arr, n, rng) {
    var a = arr.slice();
    var out = [];
    while (a.length && out.length < n) {
      var j = Math.floor(rng() * a.length);
      out.push(a.splice(j, 1)[0]);
    }
    return out;
  }

  var SOCIAL_IMAGES = [
    'https://images.unsplash.com/photo-1529078155058-5d716f45d604?w=900&q=80',
    'https://images.unsplash.com/photo-1511632765276-a27960c3a1e8?w=900&q=80',
    'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?w=900&q=80',
    'https://images.unsplash.com/photo-1504052464689-1586d9d4d0c9?w=900&q=80',
    'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=900&q=80',
    'https://images.unsplash.com/photo-1491841550275-de78548fa1af?w=900&q=80',
    'https://images.unsplash.com/photo-1516979187457-637abb4f9353?w=900&q=80',
    'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=900&q=80',
    'https://images.unsplash.com/photo-1529390079861-591de354faf5?w=900&q=80',
    'https://images.unsplash.com/photo-1473163928189-364b2c4e1135?w=900&q=80',
    'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=900&q=80',
    'https://images.unsplash.com/photo-1519682337058-a94d519337bc?w=900&q=80',
  ];

  var SCRIPTURE_LINES = [
    { ref: 'Philippians 4:6', text: 'Do not be anxious about anything, but in every situation, by prayer and petition, with thanksgiving, present your requests to God.' },
    { ref: 'Psalm 46:10', text: 'Be still, and know that I am God; I will be exalted among the nations.' },
    { ref: 'Matthew 5:14', text: 'You are the light of the world. A town built on a hill cannot be hidden.' },
    { ref: 'Isaiah 41:10', text: 'So do not fear, for I am with you; do not be dismayed, for I am your God.' },
    { ref: 'Romans 15:13', text: 'May the God of hope fill you with all joy and peace as you trust in him.' },
    { ref: 'Joshua 1:9', text: 'Be strong and courageous. Do not be afraid; do not be discouraged, for the Lord your God will be with you wherever you go.' },
    { ref: '2 Chronicles 7:14', text: 'If my people… will humble themselves and pray… I will hear from heaven and will forgive their sin and heal their land.' },
    { ref: 'Psalm 67:1–2', text: 'May God be gracious to us and bless us and make his face shine on us—so that your ways may be known on earth.' },
    { ref: 'John 3:16', text: 'For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.' },
    { ref: 'Acts 1:8', text: 'You will receive power when the Holy Spirit comes on you; and you will be my witnesses… to the ends of the earth.' },
    { ref: 'Psalm 96:3', text: 'Declare his glory among the nations, his marvelous deeds among all peoples.' },
    { ref: 'Matthew 9:37–38', text: 'The harvest is plentiful but the workers are few. Ask the Lord of the harvest, therefore, to send out workers into his harvest field.' },
    { ref: 'Romans 10:13', text: 'Everyone who calls on the name of the Lord will be saved.' },
    { ref: 'James 5:16', text: 'The prayer of a righteous person is powerful and effective.' },
    { ref: 'Psalm 34:18', text: 'The Lord is close to the brokenhearted and saves those who are crushed in spirit.' },
    { ref: 'Jeremiah 29:7', text: 'Seek the peace and prosperity of the city to which I have carried you… Pray to the Lord for it.' },
    { ref: '1 Timothy 2:1–2', text: 'I urge… that petitions, prayers… be made for all people—for kings and all those in authority.' },
    { ref: 'Psalm 22:28', text: 'For dominion belongs to the Lord and he rules over the nations.' },
    { ref: 'Hebrews 4:16', text: 'Let us then approach God’s throne of grace with confidence, so that we may receive mercy and find grace to help us in our time of need.' },
    { ref: 'Psalm 147:3', text: 'He heals the brokenhearted and binds up their wounds.' },
  ];

  var SOCIAL_HOOKS = [
    'Houston is lifting up Jesus during the World Cup — and you belong in the story.',
    'Today: pray with us for Houston, for visitors, and for hearts open to the gospel.',
    'Prayer City isn’t a program — it’s people who believe God still moves cities.',
    'From the streets to the stadium: we’re asking heaven to touch earth in Houston.',
    'Your share could be someone’s invitation to meet Jesus. No hype — just hope.',
    'World Cup crowds + gospel courage = a moment we don’t want to waste.',
    'We’re not loud for attention — we’re loud because Jesus is worthy.',
    'Tag a friend who needs encouragement — then pray one sentence for them.',
    'Houston Prayer City: tents of prayer, hearts of worship, arms of welcome.',
    'If you’ve ever felt small — remember: prayer moves the hand that holds the world.',
    'Salvation, healing, unity: we’re asking God for all three in this season.',
    'Virtual or on-site — the same Spirit is praying through you today.',
    'Invite someone to pray with us. Sometimes the bravest step is simply asking.',
    'Jesus prayed for unity; we’re still answering that prayer in Houston.',
    'One city. Many nations. One name above every name.',
  ];

  function getSocialPosts(siteUrl) {
    var base = (siteUrl || SITE_DEFAULT).replace(/\/?$/, '/');
    var dateStr = todayYmd();
    var rng = mulberry32(hashStr('soc10-' + dateStr));
    var hooks = pickN(SOCIAL_HOOKS, 10, rng);
    var verses = pickN(SCRIPTURE_LINES, 10, rng);
    var imgs = pickN(SOCIAL_IMAGES, 10, rng);
    var out = [];
    for (var i = 0; i < 10; i++) {
      var v = verses[i];
      var body =
        hooks[i] +
        '\n\n' +
        v.text +
        '\n— ' +
        v.ref +
        ' (NIV)' +
        '\n\nJoin Houston Prayer City — pray, serve, invite: ' +
        base +
        '\n\n#HoustonPrayerCity #WorldCup #PrayForHouston';
      out.push({
        index: i + 1,
        title: 'Post ' + (i + 1) + ' · ' + dateStr,
        body: body,
        image: imgs[i],
        ref: v.ref,
        shareText: body,
        shareUrl: base,
      });
    }
    return out;
  }

  var PRAYER_THEMES = [
    { label: 'Salvation', prompts: ['Ask God to draw the lost to Jesus in Houston’s streets and stadiums.', 'Pray for soft hearts among tourists who have never heard the gospel clearly.', 'Intercede for young people to respond to Christ in this season.'] },
    { label: 'Healing', prompts: ['Pray for physical healing for those in pain and for strength for medical workers.', 'Lift up emotional healing after trauma, loneliness, and fear.', 'Ask God to heal relationships and divisions in families and teams.'] },
    { label: 'Deliverance', prompts: ['Pray against fear, addiction, and oppression; proclaim freedom in Jesus’ name.', 'Intercede for protection over vulnerable people in large crowds.', 'Ask God to break chains of hatred and prejudice.'] },
    { label: 'Houston (city)', prompts: ['Pray for churches to walk in unity and generosity.', 'Ask blessing on civic leaders, police, medics, and transit workers.', 'Pray for safety, hospitality, and wise planning across neighborhoods.'] },
    { label: 'USA & nations', prompts: ['Pray for the United States — justice, peace, and revival.', 'Lift up every nation represented at the World Cup — salvation in every language.', 'Ask God to use global attention on Houston for his glory among the nations.'] },
  ];

  function getPrayerPoints() {
    var dateStr = todayYmd();
    var rng = mulberry32(hashStr('pray5-' + dateStr));
    var out = [];
    for (var t = 0; t < PRAYER_THEMES.length; t++) {
      var theme = PRAYER_THEMES[t];
      var pool = theme.prompts.slice();
      var pick = pool[Math.floor(rng() * pool.length)];
      var verse = SCRIPTURE_LINES[Math.floor(rng() * SCRIPTURE_LINES.length)];
      out.push({
        theme: theme.label,
        point: pick,
        scripture: verse.text,
        ref: verse.ref,
      });
    }
    return out;
  }

  /** Themes from public gospel-outreach practice (not quotations from any book). */
  var COUNSELOR_POOL = [
    {
      title: 'Clear, simple gospel',
      tip: 'Share the death and resurrection of Jesus, our need for forgiveness, and the gift of new life through faith — in plain language, one conversation at a time.',
      ref: '1 Corinthians 15:3–4',
    },
    {
      title: 'Invitation, not pressure',
      tip: 'Invite a person to pray with you; let the Holy Spirit do the convincing. Your job is faithful kindness, not winning an argument.',
      ref: 'Romans 2:4',
    },
    {
      title: 'Testimony beats theory',
      tip: 'Briefly share what Jesus changed in you. Stories open doors where abstract debate closes them.',
      ref: 'Psalm 66:16',
    },
    {
      title: 'Listen, then speak',
      tip: 'Ask what they believe about God and life. Listening earns trust for the moment you share hope.',
      ref: 'Proverbs 18:13',
    },
    {
      title: 'The prayer of faith',
      tip: 'Offer to pray on the spot for peace, forgiveness, or clarity. Many come to Christ in prayer, not in debate.',
      ref: 'Romans 10:9–10',
    },
    {
      title: 'Follow up with love',
      tip: 'If someone responds to Jesus, connect them to Scripture, a local church, and a next step — today, not someday.',
      ref: 'Matthew 28:19–20',
    },
    {
      title: 'Power of the Spirit',
      tip: 'Depend on the Spirit’s boldness and compassion. Outreach that lasts is soaked in prayer, not adrenaline.',
      ref: 'Acts 4:31',
    },
    {
      title: 'Crowds and individuals',
      tip: 'Whether one person or many, love the one in front of you. Jesus modeled ministry in both settings.',
      ref: 'Luke 15:7',
    },
  ];

  var COUNSELOR_IMAGES = [
    'https://images.unsplash.com/photo-1504052464689-1586d9d4d0c9?w=900&q=80',
    'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?w=900&q=80',
    'https://images.unsplash.com/photo-1529078155058-5d716f45d604?w=900&q=80',
    'https://images.unsplash.com/photo-1516979187457-637abb4f9353?w=900&q=80',
    'https://images.unsplash.com/photo-1491841550275-de78548fa1af?w=900&q=80',
    'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=900&q=80',
    'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=900&q=80',
    'https://images.unsplash.com/photo-1519682337058-a94d519337bc?w=900&q=80',
  ];

  function getCounselorDaily() {
    var dateStr = todayYmd();
    var rng = mulberry32(hashStr('counsel-' + dateStr));
    var tips = pickN(COUNSELOR_POOL, 3, rng);
    var imgs = pickN(COUNSELOR_IMAGES, 3, rng);
    for (var i = 0; i < tips.length; i++) {
      tips[i].image = imgs[i];
    }
    return {
      dateStr: dateStr,
      disclaimer:
        'Daily tips reflect classic gospel-outreach themes (clear invitation, prayer, follow-up). They are not verbatim excerpts from any author’s published works.',
      tips: tips,
    };
  }

  var LOGISTICS_STATIC = [
    'Map choke points early: entrances, merch lines, and prayer tent corners — add signage and a volunteer “pointer” before crowds peak.',
    'Heat + long shifts: rotate rest every 90 minutes where possible; keep electrolytes and shade for staff and guests.',
    'Radio or group chat: test before doors open; use short codes (“CODE BLUE” = medical) agreed with venue security.',
    'Accessibility: keep aisles wide enough for wheels and strollers; never block ramps for “temporary” storage.',
    'Lost & found + kids: one designated lead per zone; never let one volunteer escort a child alone — use pairs.',
    'Waste and recycling: extra bins before halftime surges; clear bags often to prevent spills and slips.',
    'Crowd mood: assign calm, smiling volunteers at friction points — tone de-escalates faster than rules shouted.',
  ];

  function getLogisticsStaticTips() {
    var dateStr = todayYmd();
    var rng = mulberry32(hashStr('logstat-' + dateStr));
    return pickN(LOGISTICS_STATIC, 4, rng);
  }

  function buildShareLinks(text, pageUrl) {
    var full = text.trim() + '\n\n' + pageUrl;
    var enc = encodeURIComponent(full);
    var encUrl = encodeURIComponent(pageUrl);
    return {
      copy: full,
      twitter: 'https://twitter.com/intent/tweet?text=' + enc,
      facebook: 'https://www.facebook.com/sharer/sharer.php?u=' + encUrl,
      linkedin: 'https://www.linkedin.com/sharing/share-offsite/?url=' + encUrl,
      whatsapp: 'https://wa.me/?text=' + enc,
      email: 'mailto:?subject=' + encodeURIComponent('Houston Prayer City') + '&body=' + enc,
    };
  }

  window.VolunteerDailyContent = {
    SITE_DEFAULT: SITE_DEFAULT,
    todayYmd: todayYmd,
    getSocialPosts: getSocialPosts,
    getPrayerPoints: getPrayerPoints,
    getCounselorDaily: getCounselorDaily,
    getLogisticsStaticTips: getLogisticsStaticTips,
    buildShareLinks: buildShareLinks,
  };
})();
