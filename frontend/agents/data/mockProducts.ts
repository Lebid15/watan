// بيانات المنتجات الوهمية
export interface MockProduct {
  id: string;
  name: string;
  isActive: boolean;
  image?: string | null;
  imageUrl?: string | null;
  packages?: { isActive: boolean; id: string; name: string; price: number; description?: string }[] | null;
  category?: string;
  description?: string;
}

export const MOCK_PRODUCTS: MockProduct[] = [
  {
    id: '1',
    name: 'PUBG Mobile',
    isActive: true,
    image: 'https://cdn2.steamgriddb.com/icon_thumb/c6bc29731d9a77e23e6f5f8e0bc81d11.png',
    category: 'ألعاب',
    description: 'شحن UC لـ PUBG Mobile',
    packages: [
      { isActive: true, id: '1-1', name: 'PUBG 60 UC', price: 0.99 },
      { isActive: true, id: '1-2', name: 'PUBG 325 UC', price: 4.99 },
      { isActive: true, id: '1-3', name: 'PUBG 660 UC', price: 9.99 },
      { isActive: true, id: '1-4', name: 'PUBG 1800 UC', price: 24.99 },
      { isActive: true, id: '1-5', name: 'PUBG 3850 UC', price: 49.99 },
    ]
  },
  {
    id: '2',
    name: 'Free Fire',
    isActive: true,
    image: 'https://cdn2.steamgriddb.com/icon_thumb/4bc273a4e2ea12c6b9a8c5b5e0b5f5a5.png',
    category: 'ألعاب',
    description: 'شحن الماسات لـ Free Fire',
    packages: [
      { isActive: true, id: '2-1', name: '100 ماسة', price: 0.99 },
      { isActive: true, id: '2-2', name: '310 ماسة', price: 2.99 },
      { isActive: true, id: '2-3', name: '520 ماسة', price: 4.99 },
      { isActive: true, id: '2-4', name: '1060 ماسة', price: 9.99 },
      { isActive: true, id: '2-5', name: '2180 ماسة', price: 19.99 },
    ]
  },
  {
    id: '3',
    name: 'Netflix',
    isActive: true,
    image: 'https://cdn2.steamgriddb.com/icon/a0fda47e3e8a0c0e0e0e0e0e0e0e0e0e.png',
    category: 'اشتراكات',
    description: 'بطاقات هدايا Netflix',
    packages: [
      { isActive: true, id: '3-1', name: 'بطاقة 15$', price: 15.99 },
      { isActive: true, id: '3-2', name: 'بطاقة 30$', price: 30.99 },
      { isActive: true, id: '3-3', name: 'بطاقة 60$', price: 60.99 },
    ]
  },
  {
    id: '4',
    name: 'Spotify',
    isActive: true,
    image: 'https://cdn2.steamgriddb.com/icon_thumb/b5c5d5e5f5a5b5c5d5e5f5a5b5c5d5e5.png',
    category: 'اشتراكات',
    description: 'بطاقات هدايا Spotify',
    packages: [
      { isActive: true, id: '4-1', name: 'بطاقة 10$', price: 10.99 },
      { isActive: true, id: '4-2', name: 'بطاقة 30$', price: 30.99 },
      { isActive: true, id: '4-3', name: 'بطاقة 60$', price: 60.99 },
    ]
  },
  {
    id: '5',
    name: 'Google Play',
    isActive: true,
    image: 'https://cdn2.steamgriddb.com/icon_thumb/c5d5e5f5a5b5c5d5e5f5a5b5c5d5e5f5.png',
    category: 'بطاقات',
    description: 'بطاقات Google Play',
    packages: [
      { isActive: true, id: '5-1', name: 'بطاقة 5$', price: 5.49 },
      { isActive: true, id: '5-2', name: 'بطاقة 10$', price: 10.49 },
      { isActive: true, id: '5-3', name: 'بطاقة 25$', price: 25.49 },
      { isActive: true, id: '5-4', name: 'بطاقة 50$', price: 50.49 },
      { isActive: true, id: '5-5', name: 'بطاقة 100$', price: 100.49 },
    ]
  },
  {
    id: '6',
    name: 'iTunes',
    isActive: true,
    image: 'https://cdn2.steamgriddb.com/icon_thumb/d5e5f5a5b5c5d5e5f5a5b5c5d5e5f5a5.png',
    category: 'بطاقات',
    description: 'بطاقات iTunes',
    packages: [
      { isActive: true, id: '6-1', name: 'بطاقة 10$', price: 10.49 },
      { isActive: true, id: '6-2', name: 'بطاقة 25$', price: 25.49 },
      { isActive: true, id: '6-3', name: 'بطاقة 50$', price: 50.49 },
      { isActive: true, id: '6-4', name: 'بطاقة 100$', price: 100.49 },
    ]
  },
  {
    id: '7',
    name: 'Steam',
    isActive: true,
    image: 'https://cdn2.steamgriddb.com/icon_thumb/e5f5a5b5c5d5e5f5a5b5c5d5e5f5a5b5.png',
    category: 'ألعاب',
    description: 'بطاقات Steam',
    packages: [
      { isActive: true, id: '7-1', name: 'بطاقة 5$', price: 5.49 },
      { isActive: true, id: '7-2', name: 'بطاقة 10$', price: 10.49 },
      { isActive: true, id: '7-3', name: 'بطاقة 20$', price: 20.49 },
      { isActive: true, id: '7-4', name: 'بطاقة 50$', price: 50.49 },
      { isActive: true, id: '7-5', name: 'بطاقة 100$', price: 100.49 },
    ]
  },
  {
    id: '8',
    name: 'PlayStation',
    isActive: true,
    image: 'https://cdn2.steamgriddb.com/icon_thumb/f5a5b5c5d5e5f5a5b5c5d5e5f5a5b5c5.png',
    category: 'ألعاب',
    description: 'بطاقات PlayStation',
    packages: [
      { isActive: true, id: '8-1', name: 'بطاقة 10$', price: 10.49 },
      { isActive: true, id: '8-2', name: 'بطاقة 25$', price: 25.49 },
      { isActive: true, id: '8-3', name: 'بطاقة 50$', price: 50.49 },
      { isActive: true, id: '8-4', name: 'بطاقة 100$', price: 100.49 },
    ]
  },
  {
    id: '9',
    name: 'Xbox',
    isActive: true,
    image: 'https://cdn2.steamgriddb.com/icon_thumb/a5b5c5d5e5f5a5b5c5d5e5f5a5b5c5d5.png',
    category: 'ألعاب',
    description: 'بطاقات Xbox',
    packages: [
      { isActive: true, id: '9-1', name: 'بطاقة 10$', price: 10.49 },
      { isActive: true, id: '9-2', name: 'بطاقة 25$', price: 25.49 },
      { isActive: true, id: '9-3', name: 'بطاقة 50$', price: 50.49 },
      { isActive: true, id: '9-4', name: 'بطاقة 100$', price: 100.49 },
    ]
  },
  {
    id: '10',
    name: 'Fortnite',
    isActive: true,
    image: 'https://cdn2.steamgriddb.com/icon_thumb/b5c5d5e5f5a5b5c5d5e5f5a5b5c5d5e5.png',
    category: 'ألعاب',
    description: 'V-Bucks لـ Fortnite',
    packages: [
      { isActive: true, id: '10-1', name: '1000 V-Bucks', price: 7.99 },
      { isActive: true, id: '10-2', name: '2800 V-Bucks', price: 19.99 },
      { isActive: true, id: '10-3', name: '5000 V-Bucks', price: 31.99 },
      { isActive: true, id: '10-4', name: '13500 V-Bucks', price: 79.99 },
    ]
  },
  {
    id: '11',
    name: 'Roblox',
    isActive: true,
    image: 'https://cdn2.steamgriddb.com/icon_thumb/c5d5e5f5a5b5c5d5e5f5a5b5c5d5e5f5.png',
    category: 'ألعاب',
    description: 'Robux لـ Roblox',
    packages: [
      { isActive: true, id: '11-1', name: '400 Robux', price: 4.99 },
      { isActive: true, id: '11-2', name: '800 Robux', price: 9.99 },
      { isActive: true, id: '11-3', name: '1700 Robux', price: 19.99 },
      { isActive: true, id: '11-4', name: '4500 Robux', price: 49.99 },
    ]
  },
  {
    id: '12',
    name: 'Amazon',
    isActive: true,
    image: 'https://cdn2.steamgriddb.com/icon_thumb/d5e5f5a5b5c5d5e5f5a5b5c5d5e5f5a5.png',
    category: 'بطاقات',
    description: 'بطاقات Amazon',
    packages: [
      { isActive: true, id: '12-1', name: 'بطاقة 10$', price: 10.49 },
      { isActive: true, id: '12-2', name: 'بطاقة 25$', price: 25.49 },
      { isActive: true, id: '12-3', name: 'بطاقة 50$', price: 50.49 },
      { isActive: true, id: '12-4', name: 'بطاقة 100$', price: 100.49 },
    ]
  },
  {
    id: '13',
    name: 'League of Legends',
    isActive: true,
    image: 'https://cdn2.steamgriddb.com/icon_thumb/e5f5a5b5c5d5e5f5a5b5c5d5e5f5a5b5.png',
    category: 'ألعاب',
    description: 'RP لـ League of Legends',
    packages: [
      { isActive: true, id: '13-1', name: '650 RP', price: 5.00 },
      { isActive: true, id: '13-2', name: '1380 RP', price: 10.00 },
      { isActive: true, id: '13-3', name: '2800 RP', price: 20.00 },
      { isActive: true, id: '13-4', name: '7200 RP', price: 50.00 },
    ]
  },
  {
    id: '14',
    name: 'Valorant',
    isActive: true,
    image: 'https://cdn2.steamgriddb.com/icon_thumb/f5a5b5c5d5e5f5a5b5c5d5e5f5a5b5c5.png',
    category: 'ألعاب',
    description: 'VP لـ Valorant',
    packages: [
      { isActive: true, id: '14-1', name: '475 VP', price: 4.99 },
      { isActive: true, id: '14-2', name: '1000 VP', price: 9.99 },
      { isActive: true, id: '14-3', name: '2050 VP', price: 19.99 },
      { isActive: true, id: '14-4', name: '5350 VP', price: 49.99 },
    ]
  },
  {
    id: '15',
    name: 'Minecraft',
    isActive: true,
    image: 'https://cdn2.steamgriddb.com/icon_thumb/a5b5c5d5e5f5a5b5c5d5e5f5a5b5c5d5.png',
    category: 'ألعاب',
    description: 'Minecoins لـ Minecraft',
    packages: [
      { isActive: true, id: '15-1', name: '320 Minecoins', price: 1.99 },
      { isActive: true, id: '15-2', name: '1020 Minecoins', price: 4.99 },
      { isActive: true, id: '15-3', name: '1720 Minecoins', price: 9.99 },
      { isActive: true, id: '15-4', name: '3500 Minecoins', price: 19.99 },
    ]
  },
  {
    id: '16',
    name: 'Call of Duty',
    isActive: true,
    image: 'https://cdn2.steamgriddb.com/icon_thumb/b5c5d5e5f5a5b5c5d5e5f5a5b5c5d5e5.png',
    category: 'ألعاب',
    description: 'COD Points',
    packages: [
      { isActive: true, id: '16-1', name: '500 COD Points', price: 4.99 },
      { isActive: true, id: '16-2', name: '1100 COD Points', price: 9.99 },
      { isActive: true, id: '16-3', name: '2400 COD Points', price: 19.99 },
      { isActive: true, id: '16-4', name: '5000 COD Points', price: 39.99 },
    ]
  },
  {
    id: '17',
    name: 'Genshin Impact',
    isActive: true,
    image: 'https://cdn2.steamgriddb.com/icon_thumb/c5d5e5f5a5b5c5d5e5f5a5b5c5d5e5f5.png',
    category: 'ألعاب',
    description: 'Genesis Crystals',
    packages: [
      { isActive: true, id: '17-1', name: '60 Genesis Crystals', price: 0.99 },
      { isActive: true, id: '17-2', name: '300 Genesis Crystals', price: 4.99 },
      { isActive: true, id: '17-3', name: '980 Genesis Crystals', price: 14.99 },
      { isActive: true, id: '17-4', name: '1980 Genesis Crystals', price: 29.99 },
    ]
  },
  {
    id: '18',
    name: 'Discord',
    isActive: true,
    image: 'https://cdn2.steamgriddb.com/icon_thumb/d5e5f5a5b5c5d5e5f5a5b5c5d5e5f5a5.png',
    category: 'اشتراكات',
    description: 'Discord Nitro',
    packages: [
      { isActive: true, id: '18-1', name: 'Nitro شهر واحد', price: 9.99 },
      { isActive: true, id: '18-2', name: 'Nitro 3 أشهر', price: 27.99 },
      { isActive: true, id: '18-3', name: 'Nitro سنة كاملة', price: 99.99 },
    ]
  },
  {
    id: '19',
    name: 'Razer Gold',
    isActive: true,
    image: 'https://cdn2.steamgriddb.com/icon_thumb/e5f5a5b5c5d5e5f5a5b5c5d5e5f5a5b5.png',
    category: 'بطاقات',
    description: 'بطاقات Razer Gold',
    packages: [
      { isActive: true, id: '19-1', name: '5$ Razer Gold', price: 5.49 },
      { isActive: true, id: '19-2', name: '10$ Razer Gold', price: 10.49 },
      { isActive: true, id: '19-3', name: '25$ Razer Gold', price: 25.49 },
      { isActive: true, id: '19-4', name: '50$ Razer Gold', price: 50.49 },
      { isActive: true, id: '19-5', name: '100$ Razer Gold', price: 100.49 },
    ]
  },
  {
    id: '20',
    name: 'Apex Legends',
    isActive: true,
    image: 'https://cdn2.steamgriddb.com/icon_thumb/f5a5b5c5d5e5f5a5b5c5d5e5f5a5b5c5.png',
    category: 'ألعاب',
    description: 'Apex Coins',
    packages: [
      { isActive: true, id: '20-1', name: '1000 Apex Coins', price: 9.99 },
      { isActive: true, id: '20-2', name: '2150 Apex Coins', price: 19.99 },
      { isActive: true, id: '20-3', name: '4350 Apex Coins', price: 39.99 },
      { isActive: true, id: '20-4', name: '11500 Apex Coins', price: 99.99 },
    ]
  },
];

// دالة للحصول على منتج حسب المعرف
export function getMockProductById(id: string): MockProduct | undefined {
  return MOCK_PRODUCTS.find(p => p.id === id);
}

// دالة للحصول على جميع المنتجات النشطة
export function getActiveMockProducts(): MockProduct[] {
  return MOCK_PRODUCTS.filter(p => p.isActive);
}
