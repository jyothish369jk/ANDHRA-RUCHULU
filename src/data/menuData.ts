import type { FlagshipLocation, MenuCategory, MenuItem } from '../types/restaurant';

export const MENU_CATEGORIES: MenuCategory[] = [
  'All',
  'Starters (Vepudu)',
  'Royal Biryanis & Pulaos',
  'Coastal Curries',
  'Traditional Sweets',
];

export const HERO_MEDIA = {
  feastImage: '/src/assets/images/hero_telugu_bhojanam_1795437422889.jpg',
  storyImage: '/src/assets/images/story_claypot_spices_1794933152141.jpg',
};

export const MENU_ITEMS: MenuItem[] = [
  {
    id: 'kodi-vepudu',
    name: 'Guntur Kodi Vepudu',
    teluguSubtitle: 'Crisp Peppercorn & Chili Chicken',
    category: 'Starters (Vepudu)',
    description:
      'Free-range country chicken pan-seared in cold-pressed groundnut oil with stone-crushed Guntur chilies, roasted coriander seeds, and crackling curry leaves.',
    priceInr: 540,
    dietary: 'Non-Veg',
    spiceLevel: 3,
    spiceLabel: 'Fiery Guntur',
    region: 'Guntur',
    image: '/src/assets/images/dish_kodi_vepudu_1794933148283.jpg',
    pairingNote: 'Pairs with kokum tamarind cooler or crisp pilsner.',
  },
  {
    id: 'karivepaku-royyalu',
    name: 'Karivepaku Royyala Roast',
    teluguSubtitle: 'Curry Leaf Seared Tiger Prawns',
    category: 'Starters (Vepudu)',
    description:
      'Godavari estuary tiger prawns flash-tossed in toasted curry leaf podi, shallots, Tellicherry black pepper, and a bright squeeze of fresh lime.',
    priceInr: 680,
    dietary: 'Non-Veg',
    spiceLevel: 2,
    spiceLabel: 'Medium Spice',
    region: 'Konaseema',
    image: '/src/assets/images/dish_royyala_iguru_1794933148553.jpg',
    pairingNote: 'Pairs with spiced buttermilk or dry Sauvignon Blanc.',
  },
  {
    id: 'ulavacharu-biryani',
    name: 'Ulavacharu Kodi Biryani',
    teluguSubtitle: 'Horsegram Reduction Claypot Biryani',
    category: 'Royal Biryanis & Pulaos',
    description:
      'Aged basmati saffron rice slow-steamed under a clay seal with velvety 18-hour horsegram reduction, tender spiced chicken, roasted cashews, and caramelized onions.',
    priceInr: 690,
    dietary: 'Non-Veg',
    spiceLevel: 2,
    spiceLabel: 'Medium Spice',
    region: 'Vijayawada',
    image: '/src/assets/images/dish_ulavacharu_biryani_1794933149273.jpg',
    pairingNote: 'Served with pomegranate perugu pachadi and roasted chili salna.',
  },
  {
    id: 'rayalaseema-dum-biryani',
    name: 'Rayalaseema Mamsam Handi',
    teluguSubtitle: 'Saffron Lamb Earthen Dum Biryani',
    category: 'Royal Biryanis & Pulaos',
    description:
      'Succulent bone-in lamb marinated in stone-ground red chili masala and mint, layered with fragrant ghee-kissed rice inside a blackened earthen pot.',
    priceInr: 780,
    dietary: 'Non-Veg',
    spiceLevel: 3,
    spiceLabel: 'Fiery Guntur',
    region: 'Rayalaseema',
    image: '/src/assets/images/hero_andhra_feast_1794933148183.jpg',
    pairingNote: 'Pairs with gongura pachadi and smoked jeera raita.',
  },
  {
    id: 'royyala-iguru',
    name: 'Bhimavaram Royyala Iguru',
    teluguSubtitle: 'Caramelized Shallot Prawn Masala',
    category: 'Coastal Curries',
    description:
      'Wild coastal prawns simmered down to a thick, glossy masala of slow-browned onions, green chilies, ginger, and fragrant coastal garam masala.',
    priceInr: 740,
    dietary: 'Non-Veg',
    spiceLevel: 3,
    spiceLabel: 'Coastal Heat',
    region: 'Bhimavaram',
    image: '/src/assets/images/dish_royyala_iguru_1794933148553.jpg',
    pairingNote: 'Best enjoyed with steamed sona masoori rice and ghee.',
  },
  {
    id: 'gongura-mamsam',
    name: 'Gongura Mamsam',
    teluguSubtitle: 'Tangy Sorrel Leaf Braised Lamb',
    category: 'Coastal Curries',
    description:
      'Our signature heirloom curry combining tender braised lamb with hand-picked red sorrel leaves, whole roasted garlic cloves, and smoky dried chilies.',
    priceInr: 720,
    dietary: 'Non-Veg',
    spiceLevel: 2,
    spiceLabel: 'Tangy & Bold',
    region: 'Coastal Andhra',
    image: '/src/assets/images/dish_gongura_mamsam_1794933149490.jpg',
    pairingNote: 'Served alongside flaky Malabar parotta or steamed rice.',
  },
  {
    id: 'gutti-vankaya',
    name: 'Gutti Vankaya Kura',
    teluguSubtitle: 'Stuffed Baby Eggplant in Peanut-Sesame',
    category: 'Coastal Curries',
    description:
      'Tender purple baby brinjals scored and stuffed with toasted groundnut, white sesame, dry coconut, and aged tamarind masala, slow-braised in clay.',
    priceInr: 460,
    dietary: 'Veg',
    spiceLevel: 2,
    spiceLabel: 'Aromatic Spice',
    region: 'Godavari',
    image: '/src/assets/images/dish_gutti_vankaya_1794933150574.jpg',
    pairingNote: 'Pairs effortlessly with saffron pulao or crisp ragi sankati.',
  },
  {
    id: 'atreyapuram-pootharekulu',
    name: 'Atreyapuram Pootharekulu',
    teluguSubtitle: 'Artisanal Palm Jaggery Rice Wafers',
    category: 'Traditional Sweets',
    description:
      'Paper-thin rice starch sheets hand-folded by third-generation artisans with organic palm jaggery, cultured cow ghee, crushed green pistachios, and cardamom.',
    priceInr: 340,
    dietary: 'Veg',
    spiceLevel: 1,
    spiceLabel: 'Sweet & Delicate',
    region: 'Atreyapuram',
    image: '/src/assets/images/dish_pootharekulu_sweet_1794933150195.jpg',
    pairingNote: 'Presented with warm cardamom filter kahwa.',
  },
];

export const FLAGSHIP_LOCATIONS: FlagshipLocation[] = [
  {
    id: 'hyderabad',
    city: 'Hyderabad',
    neighborhood: 'Jubilee Hills Flagship',
    address: 'Plot 418, Road No. 36, Jubilee Hills, Hyderabad 500033',
    hours: 'Daily · 12:00 PM – 11:00 PM',
    phone: '9381228257',
    email: 'jyothish369k@gmail.com',
    coordinatesLabel: '17.4326° N, 78.4071° E',
    landmarks: [
      { id: 'jubilee', label: 'Andhra Ruchulu Flagship', x: 52, y: 48, distance: 'Valet Arrival' },
      { id: 'kbr', label: 'KBR National Park', x: 74, y: 34, distance: '4 min drive' },
      { id: 'peddamma', label: 'Road No. 36 Crossing', x: 30, y: 66, distance: '2 min walk' },
    ],
  },
  {
    id: 'visakhapatnam',
    city: 'Visakhapatnam',
    neighborhood: 'Beach Road Conservatory',
    address: '14 Ocean View Terrace, Pandurangapuram, Visakhapatnam 530003',
    hours: 'Daily · 12:00 PM – 11:00 PM',
    phone: '9381228257',
    email: 'jyothish369k@gmail.com',
    coordinatesLabel: '17.7185° N, 83.3316° E',
    landmarks: [
      { id: 'vizag-flagship', label: 'Andhra Ruchulu Conservatory', x: 46, y: 50, distance: 'Oceanfront Deck' },
      { id: 'rk-beach', label: 'RK Beach Promenade', x: 76, y: 58, distance: '3 min walk' },
      { id: 'kailasagiri', label: 'Coastal Ridge', x: 28, y: 28, distance: '8 min drive' },
    ],
  },
];

export const HERITAGE_CHAPTERS = [
  {
    number: '01',
    title: 'The Guntur Harvest',
    subtitle: 'Single-Origin Sun-Cured Chilies',
    description:
      'Every February, we partner directly with family farms across the Krishna basin to select Teja and Byadgi chilies sun-dried on woven mats for deep ruby heat rather than sharp sting.',
  },
  {
    number: '02',
    title: 'Coastal Tamarind & Sorrel',
    subtitle: 'Godavari Delta Reductions',
    description:
      'From tangy crimson gongura leaves to slow-simmered ulavacharu horsegram broths, our curries balance smoky spice with bright coastal acidity and hand-pressed sesame oils.',
  },
  {
    number: '03',
    title: 'The Earthen Claypot Table',
    subtitle: 'Slow Fire Meets Obsidian Calm',
    description:
      'Unlined black clay pots seasoned over wood embers infuse our biryanis and iguru reductions with subtle mineral warmth, brought directly to our candlelit stone tables.',
  },
];
