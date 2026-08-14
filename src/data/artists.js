export const ARTISTS = [
  {
    id: 'neon',
    image: '/assets/artists/neon.png',
    gallery: [
      '/assets/artists/neon.png',
      '/assets/artists/hero.png',
      '/assets/collectors/void.png',
      '/assets/artists/process.png'
    ],
    nameEn: 'Neon Pulse',
    nameAr: 'نبض نيون',
    designEn: 'Midnight Circuit',
    designAr: 'دائرة منتصف الليل',
    roleEn: 'Iridescent finishes',
    roleAr: 'تشطيبات قزحية',
    finishEn: 'Cyan–violet flake',
    finishAr: 'قشور سيان–بنفسجي',
    shellEn: 'Gloss clear coat',
    shellAr: 'طبقة لمعان شفافة',
    run: '30',
    year: '2026',
    bioEn: 'Signature cyan-to-violet flake work. Every shell is airbrushed in-studio, then sealed for a glass-like depth.',
    bioAr: 'أعمال قشور سيان إلى بنفسجي. كل هيكل يُرش يدوياً في الاستوديو ثم يُغلق بعمق زجاجي.',
    storyEn: 'Midnight Circuit is built as a light-reactive piece. Flake density is laid heavier on the handles so the color shifts under RGB and studio lights, then locked with a two-stage clear coat.',
    storyAr: 'دائرة منتصف الليل قطعة تتفاعل مع الضوء. كثافة القشور أعلى على المقابض حتى يتغيّر اللون تحت الإضاءة، ثم تُغلق بطبقتين شفافين.'
  },
  {
    id: 'gold',
    image: '/assets/artists/gold.png',
    gallery: [
      '/assets/artists/gold.png',
      '/assets/collectors/obsidian.png',
      '/assets/collectors/solar.png',
      '/assets/artists/process.png'
    ],
    nameEn: 'Atelier Noir',
    nameAr: 'أتيليه نوار',
    designEn: 'Obsidian Gold',
    designAr: 'ذهب أوبسيديان',
    roleEn: 'Gold metalwork',
    roleAr: 'أعمال ذهبية',
    finishEn: 'Matte charcoal + gold',
    finishAr: 'فحم مطفي وذهب',
    shellEn: 'Brushed metal lining',
    shellAr: 'خطوط معدنية مصقولة',
    run: '50',
    year: '2026',
    bioEn: 'Matte charcoal bodies with brushed gold lining. Quiet luxury — built for collectors who want presence without noise.',
    bioAr: 'هياكل فحمية مطفية مع خطوط ذهبية مصقولة. فخامة هادئة لهواة الجمع.',
    storyEn: 'Obsidian Gold keeps the shell matte so the gold edge is the only highlight. Face buttons and sticks are matched in warm metal so the piece reads as one object, not a wrap.',
    storyAr: 'ذهب أوبسيديان يبقي الهيكل مطفياً ليظهر الخط الذهبي وحده. الأزرار والعصي بلون معدني دافئ حتى تُقرأ القطعة كجسم واحد.'
  },
  {
    id: 'ice',
    image: '/assets/artists/ice.png',
    gallery: [
      '/assets/artists/ice.png',
      '/assets/collectors/arctic.png',
      '/assets/collectors/pearl.png',
      '/assets/artists/lineup.png'
    ],
    nameEn: 'Ice Atelier',
    nameAr: 'أتيليه الجليد',
    designEn: 'Arctic Veil',
    designAr: 'حجاب القطب',
    roleEn: 'Pearl & ice shells',
    roleAr: 'هياكل لؤلؤ وجليد',
    finishEn: 'Pearl white / ice blue',
    finishAr: 'أبيض لؤلؤي / أزرق جليد',
    shellEn: 'Translucent ice',
    shellAr: 'جليد شفاف',
    run: '50',
    year: '2026',
    bioEn: 'Translucent ice shells with cool studio lighting in mind. Pale blues, pearl whites, and chrome-edge details.',
    bioAr: 'هياكل جليد شفافة بدرجات أزرق باهت ولؤلؤ وكروم.',
    storyEn: 'Arctic Veil is poured as a cool translucent shell. Pearl sits in the plastic, not on a sticker, so the ice tone stays clean under daylight and LED.',
    storyAr: 'حجاب القطب هيكل شفاف بارد. اللؤلؤ داخل المادة وليس لاصقاً، فيبقى لون الجليد نظيفاً تحت الضوء.'
  },
  {
    id: 'crimson',
    image: '/assets/artists/crimson.png',
    gallery: [
      '/assets/artists/crimson.png',
      '/assets/collectors/crimson.png',
      '/assets/artists/lineup.png',
      '/assets/artists/process.png'
    ],
    nameEn: 'Crimson Studio',
    nameAr: 'استوديو قرمزي',
    designEn: 'Crimson Reign',
    designAr: 'الحكم القرمزي',
    roleEn: 'Two-tone drama',
    roleAr: 'تباين ثنائي',
    finishEn: 'Crimson / black',
    finishAr: 'قرمزي / أسود',
    shellEn: 'High-gloss two-tone',
    shellAr: 'تباين لامع',
    run: '40',
    year: '2026',
    bioEn: 'Deep crimson against black. High-contrast pieces designed to read instantly on camera and on the desk.',
    bioAr: 'قرمزي عميق على أسود. قطع عالية التباين تظهر بقوة على الكاميرا.',
    storyEn: 'Crimson Reign splits the body on a hard line. The red is mixed darker than candy so it holds on stream overlays without blowing out.',
    storyAr: 'الحكم القرمزي يقسم الهيكل بخط حاد. الأحمر أغمق من اللامع حتى يثبت على الكاميرا دون توهج.'
  }
];

export function getArtistById(id) {
  return ARTISTS.find((artist) => artist.id === String(id || '').trim()) || null;
}

export function getArtistIndex(id) {
  return ARTISTS.findIndex((artist) => artist.id === String(id || '').trim());
}

export function getAdjacentArtists(id) {
  const index = getArtistIndex(id);
  if (index < 0) return { prev: null, next: null };
  return {
    prev: ARTISTS[(index - 1 + ARTISTS.length) % ARTISTS.length],
    next: ARTISTS[(index + 1) % ARTISTS.length]
  };
}
