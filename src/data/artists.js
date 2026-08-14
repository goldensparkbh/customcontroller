export const SHOP_UPGRADES = [
  { id: 'mouse-clicks', price: 8, nameEn: 'Mouse Clicks', nameAr: 'نقرات الماوس' },
  { id: 'xl-battery', price: 7, nameEn: 'XL Battery', nameAr: 'بطارية XL' },
  { id: 'tmr-analog', price: 19, nameEn: 'TMR Analog', nameAr: 'أنالوج TMR' },
  { id: 'remap-kit', price: 14, nameEn: 'Remap Kit', nameAr: 'طقم إعادة التعيين' }
];

export const SHOP_CATEGORIES = [
  { id: 'all', en: 'All Designs', ar: 'كل التصاميم' },
  { id: 'premium', en: 'Premium Series', ar: 'السلسلة المميزة' },
  { id: 'anime', en: 'Anime', ar: 'أنمي' },
  { id: 'gaming', en: 'Gaming', ar: 'ألعاب' },
  { id: 'football', en: 'Football', ar: 'كرة القدم' },
  { id: 'movies', en: 'Movies', ar: 'أفلام' }
];

export const ARTISTS = [
  {
    id: 'sakura-bloom',
    category: 'premium',
    price: 49,
    image: '/assets/shop/shop-sakura.png',
    gallery: [
      '/assets/shop/shop-sakura.png',
      '/assets/shop/shop-sakura-angle2.png',
      '/assets/shop/shop-sakura-back.png',
      '/assets/shop/shop-sakura-detail.png'
    ],
    nameEn: 'Sakura Bloom',
    nameAr: 'ساكورا بلوم',
    artistEn: 'Eman Alshomeli',
    artistAr: 'إيمان الشوملي',
    categoryEn: 'Premium Series',
    categoryAr: 'السلسلة المميزة',
    cardEn: 'A delicate cherry-blossom composition across a white DualSense shell. Soft pinks, fine branch work, and a finish built as a one of one.',
    cardAr: 'تكوين ساكورا دقيق على هيكل أبيض. وردي ناعم، فروع دقيقة، وتشطيب يُصنع مرة واحدة.',
    bioEn: 'Each Sakura Bloom controller is painted by hand — no prints, no wraps. Cherry blossom branches are laid petal by petal across a white DualSense shell, then sealed as a one of one.',
    bioAr: 'كل قطعة ساكورا بلوم تُرسم يدوياً — بلا طباعة وبلا تغليف. تُوضع فروع الأزهار بتلة بتلة على هيكل أبيض ثم تُغلق كقطعة واحدة.',
    storyEn: 'Built for collectors who want the piece on the desk to feel like art, not a sticker. Fine branch work, soft pinks, and a clear coat meant to last through play.',
    storyAr: 'صُممت لهواة الجمع الذين يريدون القطعة على المكتب فناً لا لاصقاً. فروع دقيقة ووردي ناعم وطبقة شفافة تتحمل اللعب.',
    aliases: ['ice']
  },
  {
    id: 'shoguns-oath',
    category: 'gaming',
    price: 49,
    image: '/assets/shop/shop-shogun.png',
    gallery: [
      '/assets/shop/shop-shogun.png',
      '/assets/shop/shop-shogun.png',
      '/assets/shop/shop-shogun.png',
      '/assets/shop/shop-shogun.png'
    ],
    nameEn: "Shogun's Oath",
    nameAr: 'قسم الشوغون',
    artistEn: 'Studio Ronin',
    artistAr: 'استوديو رونين',
    categoryEn: 'Gaming',
    categoryAr: 'ألعاب',
    cardEn: 'A rising-sun field and a samurai silhouette, painted across a white shell. High-contrast ink work made for the desk and the camera.',
    cardAr: 'شمس مشرقة وظل ساموراي على هيكل أبيض. عمل حبر عالي التباين للمكتب والكاميرا.',
    bioEn: "Shogun's Oath is hand-painted in studio — a red sun, black silhouette, and clean white ground. No wraps. No prints. One shell, one oath.",
    bioAr: 'قسم الشوغون يُرسم في الاستوديو — شمس حمراء وظل أسود وأرض بيضاء نظيفة. بلا تغليف وبلا طباعة.',
    storyEn: 'The composition is built to read instantly in a thumbnail and still hold fine edge work up close. Sealed in a gloss clear coat for play.',
    storyAr: 'التكوين يُقرأ فوراً في الصورة المصغرة ويحتفظ بحدة الخط عن قرب. يُغلق بطبقة لامعة للعب.',
    aliases: ['crimson']
  },
  {
    id: 'legend-in-purple',
    category: 'anime',
    price: 49,
    image: '/assets/shop/shop-legend-purple.png',
    gallery: [
      '/assets/shop/shop-legend-purple.png',
      '/assets/shop/shop-legend-purple.png',
      '/assets/shop/shop-legend-purple.png',
      '/assets/shop/shop-legend-purple.png'
    ],
    nameEn: 'Legend in Purple',
    nameAr: 'أسطورة بالبنفسج',
    artistEn: 'Violet Atelier',
    artistAr: 'أتيليه فايولت',
    categoryEn: 'Anime',
    categoryAr: 'أنمي',
    cardEn: 'Iridescent violet metalwork with gold lining. An anime-inspired shell that shifts under studio light.',
    cardAr: 'معدن بنفسجي قزحي مع خطوط ذهبية. هيكل مستوحى من الأنمي يتغيّر تحت الضوء.',
    bioEn: 'Legend in Purple is airbrushed in layers of violet, then lined in gold. Every shell is a one of one — the flake density is never repeated.',
    bioAr: 'أسطورة بالبنفسج تُرش بطبقات بنفسجية ثم تُخط بالذهب. كل هيكل قطعة واحدة لا تُكرر كثافة قشورها.',
    storyEn: 'Painted for collectors who want presence without noise. The purple holds on camera; the gold edge is the only highlight.',
    storyAr: 'رُسمت لهواة الجمع الذين يريدون حضوراً بلا ضجيج. البنفسج يثبت على الكاميرا والخط الذهبي هو الإبراز الوحيد.',
    aliases: ['gold']
  },
  {
    id: 'storm-call',
    category: 'gaming',
    price: 49,
    image: '/assets/shop/shop-lightning.png',
    gallery: [
      '/assets/shop/shop-lightning.png',
      '/assets/shop/shop-lightning.png',
      '/assets/shop/shop-lightning.png',
      '/assets/shop/shop-lightning.png'
    ],
    nameEn: 'Storm Call',
    nameAr: 'نداء العاصفة',
    artistEn: 'Arc Studio',
    artistAr: 'استوديو آرك',
    categoryEn: 'Gaming',
    categoryAr: 'ألعاب',
    cardEn: 'Electric blue lightning laid over a dark shell. Built for night sessions and RGB desks.',
    cardAr: 'برق أزرق كهربائي على هيكل داكن. صُمم لجلسات الليل ومكاتب الإضاءة.',
    bioEn: 'Storm Call is painted bolt by bolt. No vinyl, no print — just a dark ground and a charge of cyan that reads under LED.',
    bioAr: 'نداء العاصفة يُرسم برقاً برقاً. بلا فينيل وبلا طباعة — أرض داكنة وشحنة سيان تظهر تحت الإضاءة.',
    storyEn: 'The bolt work is heavier on the face so it hits in a stream overlay, then sealed so the cyan stays clean through play.',
    storyAr: 'عمل البرق أثقل على الوجه ليظهر في البث، ثم يُغلق حتى يبقى السيان نظيفاً أثناء اللعب.',
    aliases: ['neon']
  },
  {
    id: 'scarlet-web',
    category: 'movies',
    price: 49,
    image: '/assets/shop/shop-spider.png',
    gallery: [
      '/assets/shop/shop-spider.png',
      '/assets/shop/shop-spider.png',
      '/assets/shop/shop-spider.png',
      '/assets/shop/shop-spider.png'
    ],
    nameEn: 'Scarlet Web',
    nameAr: 'الشبكة القرمزية',
    artistEn: 'Crimson Frame',
    artistAr: 'كريمسون فريم',
    categoryEn: 'Movies',
    categoryAr: 'أفلام',
    cardEn: 'Scarlet and midnight blue with a web emblem across the face. Cinematic lighting, comic-book energy.',
    cardAr: 'قرمزي وأزرق منتصف الليل مع شعار شبكة على الوجه. إضاءة سينمائية وطاقة قصص مصورة.',
    bioEn: 'Scarlet Web is a hand-painted movie piece. The emblem is brushed on the face, then the red and blue fields are blended by hand.',
    bioAr: 'الشبكة القرمزية قطعة سينمائية مرسومة يدوياً. الشعار يُرسم على الوجه ثم تُمزج حقول الأحمر والأزرق باليد.',
    storyEn: 'High contrast for the camera, fine web work for the desk. Sealed as a one of one — no two emblems sit the same.',
    storyAr: 'تباين عالٍ للكاميرا وعمل شبكة دقيق للمكتب. تُغلق كقطعة واحدة — لا شعاران يجلسان في المكان نفسه.'
  },
  {
    id: 'jade-dragon',
    category: 'anime',
    price: 49,
    image: '/assets/shop/shop-dragon.png',
    gallery: [
      '/assets/shop/shop-dragon.png',
      '/assets/shop/shop-dragon.png',
      '/assets/shop/shop-dragon.png',
      '/assets/shop/shop-dragon.png'
    ],
    nameEn: 'Jade Dragon',
    nameAr: 'التنين اليشمي',
    artistEn: 'Gold Scale',
    artistAr: 'غولد سكيل',
    categoryEn: 'Anime',
    categoryAr: 'أنمي',
    cardEn: 'A gold-and-black dragon wrapping the shell. Scale work painted by hand, then locked under gloss.',
    cardAr: 'تنين ذهب وأسود يلتف حول الهيكل. عمل حراشف يُرسم يدوياً ثم يُغلق باللمعان.',
    bioEn: 'Jade Dragon is coiled around a DualSense in gold and black. Every scale is laid in studio — never printed, never wrapped.',
    bioAr: 'التنين اليشمي يلتف حول الدوال سنس بالذهب والأسود. كل حرشفة تُوضع في الاستوديو — بلا طباعة وبلا تغليف.',
    storyEn: 'The dragon is composed to wrap the handles so it reads in the hand and on the shelf. One shell. One coil.',
    storyAr: 'التنين يُركَّب ليلتف على المقابض حتى يُقرأ في اليد وعلى الرف. هيكل واحد. التفاف واحد.'
  }
];

const ALIAS_MAP = ARTISTS.reduce((map, design) => {
  (design.aliases || []).forEach((alias) => {
    map[alias] = design.id;
  });
  return map;
}, {});

function resolveId(id) {
  const key = String(id || '').trim();
  return ALIAS_MAP[key] || key;
}

export function getArtistById(id) {
  const resolved = resolveId(id);
  return ARTISTS.find((artist) => artist.id === resolved) || null;
}

export function getArtistIndex(id) {
  const resolved = resolveId(id);
  return ARTISTS.findIndex((artist) => artist.id === resolved);
}

export function getAdjacentArtists(id) {
  const index = getArtistIndex(id);
  if (index < 0) return { prev: null, next: null };
  return {
    prev: ARTISTS[(index - 1 + ARTISTS.length) % ARTISTS.length],
    next: ARTISTS[(index + 1) % ARTISTS.length]
  };
}

export function getDesignsByCategory(categoryId) {
  if (!categoryId || categoryId === 'all') return ARTISTS.slice();
  return ARTISTS.filter((design) => design.category === categoryId);
}
