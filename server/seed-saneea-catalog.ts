import "dotenv/config";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { randomBytes, scrypt } from "crypto";
import { promisify } from "util";
import { db, pool } from "./db";
import {
  BUNDLE_TIERS,
  USER_TYPES,
  bookingConfirmations,
  bookings,
  bundleItems,
  bundleOptions,
  eventBundles,
  eventItems,
  eventTypes,
  itemVendorOptions,
  payments,
  pricingHistory,
  questionnaireItems,
  reviews,
  users,
  vendors,
} from "@shared/schema";

const scryptAsync = promisify(scrypt);

const images = {
  birthday: [
    "https://images.unsplash.com/photo-1464349095431-e9a21285b5f3",
    "https://images.unsplash.com/photo-1530103862676-de8c9debad1d",
  ],
  family: [
    "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf",
    "https://images.unsplash.com/photo-1527529482837-4698179dc6ce",
  ],
  graduation: [
    "https://images.unsplash.com/photo-1523580846011-d3a5bc25702b",
    "https://images.unsplash.com/photo-1627556704302-624286467c65",
  ],
  engagement: [
    "https://images.unsplash.com/photo-1519225421980-715cb0215aed",
    "https://images.unsplash.com/photo-1523438885200-e635ba2c371e",
  ],
  women: [
    "https://images.unsplash.com/photo-1511795409834-ef04bbd61622",
    "https://images.unsplash.com/photo-1505236858219-8359eb29e329",
  ],
  ramadan: [
    "https://images.unsplash.com/photo-1578897366546-0f6d8c8f5c9d",
    "https://images.unsplash.com/photo-1564769625905-50e93615e769",
  ],
  outdoor: [
    "https://images.unsplash.com/photo-1505236858219-8359eb29e329",
    "https://images.unsplash.com/photo-1470337458703-46ad1756a187",
  ],
  decor: ["https://images.unsplash.com/photo-1519225421980-715cb0215aed"],
  catering: ["https://images.unsplash.com/photo-1555244162-803834f70033"],
  coffee: ["https://images.unsplash.com/photo-1495474472287-4d71bcdd2085"],
  photography: ["https://images.unsplash.com/photo-1511285560929-80b456fea0bc"],
  seating: ["https://images.unsplash.com/photo-1464366400600-7168b8af9bc3"],
  lighting: ["https://images.unsplash.com/photo-1519167758481-83f550bb49b3"],
  venue: ["https://images.unsplash.com/photo-1519167758481-83f550bb49b3"],
  entertainment: ["https://images.unsplash.com/photo-1527529482837-4698179dc6ce"],
};

type VendorSeed = {
  key: string;
  username: string;
  businessName: string;
  category: string;
  description: string;
  features: string[];
  photos: string[];
};

const vendorSeeds: VendorSeed[] = [
  {
    key: "decor",
    username: "saneea_decor",
    businessName: "سنيع للديكور",
    category: "الديكور والتنسيق",
    description: "بالونات، خلفيات، تنسيق طاولات، زهور، وثيمات للمناسبات العائلية.",
    features: ["بالونات", "خلفيات", "تنسيق طاولات", "زهور", "ثيمات"],
    photos: images.decor,
  },
  {
    key: "catering",
    username: "saneea_catering",
    businessName: "ضيافة سنيع",
    category: "الطعام والضيافة",
    description: "بوفيهات، طاولات حلويات، سناكات، وطهاة منزليون.",
    features: ["بوفيه", "حلويات", "سناكات", "طهاة منزليون"],
    photos: images.catering,
  },
  {
    key: "coffee",
    username: "saneea_coffee",
    businessName: "قهوة سنيع",
    category: "القهوة والمشروبات",
    description: "عربات قهوة، شاي، عصائر، وتجهيز ركن مشروبات.",
    features: ["عربة قهوة", "شاي", "عصائر", "ركن مشروبات"],
    photos: images.coffee,
  },
  {
    key: "photo",
    username: "saneea_photo",
    businessName: "استوديو سنيع",
    category: "التصوير",
    description: "تصوير فوتوغرافي، فيديو، وطباعة فورية للفعاليات.",
    features: ["تصوير", "فيديو", "طباعة فورية"],
    photos: images.photography,
  },
  {
    key: "seating",
    username: "saneea_seating",
    businessName: "جلسات سنيع",
    category: "الجلسات والأثاث",
    description: "كراسي، طاولات، جلسات مجلس، وتجهيزات خارجية.",
    features: ["كراسي", "طاولات", "مجالس", "جلسات خارجية"],
    photos: images.seating,
  },
  {
    key: "lighting",
    username: "saneea_lighting",
    businessName: "إضاءة سنيع",
    category: "الصوت والإضاءة",
    description: "سماعات، إضاءة، مايكروفونات، وشاشات.",
    features: ["سماعات", "إضاءة", "مايكروفونات", "شاشات"],
    photos: images.lighting,
  },
  {
    key: "venue",
    username: "saneea_venues",
    businessName: "مواقع سنيع",
    category: "المواقع والاستراحات",
    description: "شاليهات، قاعات، مزارع، واستراحات عائلية.",
    features: ["شاليهات", "قاعات", "مزارع", "استراحات"],
    photos: images.venue,
  },
  {
    key: "entertainment",
    username: "saneea_fun",
    businessName: "ترفيه سنيع",
    category: "الترفيه",
    description: "أنشطة أطفال، شخصيات، عروض، وتجارب ترفيهية.",
    features: ["أنشطة أطفال", "شخصيات", "عروض", "ألعاب"],
    photos: images.entertainment,
  },
];

type PackageSeed = {
  tier: string;
  name: string;
  basePrice: number;
  range: string;
  description: string;
  features: string[];
};

type EventSeed = {
  name: string;
  category: string;
  description: string;
  icon: string;
  images: string[];
  items: Array<{ name: string; category: string; vendorKey: string; description: string; price: number; order: number }>;
  packages: PackageSeed[];
};

const eventSeeds: EventSeed[] = [
  {
    name: "أعياد ميلاد الأطفال",
    category: "أعياد الميلاد",
    description: "باقات جاهزة لأعياد ميلاد الأطفال في المنزل أو الاستراحة.",
    icon: "🎂",
    images: images.birthday,
    items: [
      { name: "ديكور بالونات وخلفية", category: "الديكور والتنسيق", vendorKey: "decor", description: "تجهيز خلفية وثيم وبالونات.", price: 650, order: 1 },
      { name: "طاولة الكيك والحلويات", category: "الطعام والضيافة", vendorKey: "catering", description: "طاولة كيك وحلويات مناسبة للأطفال.", price: 550, order: 2 },
      { name: "تصوير المناسبة", category: "التصوير", vendorKey: "photo", description: "تصوير فوتوغرافي أو فيديو حسب الباقة.", price: 800, order: 3 },
      { name: "ترفيه وشخصيات", category: "الترفيه", vendorKey: "entertainment", description: "ماسكوت أو نشاط بسيط للأطفال.", price: 900, order: 4 },
      { name: "جلسات وركن قهوة", category: "الجلسات والأثاث", vendorKey: "seating", description: "جلسات خفيفة وركن قهوة للضيوف.", price: 700, order: 5 },
    ],
    packages: [
      { tier: BUNDLE_TIERS.CHEAP, name: "باقة عيد ميلاد أساسية", basePrice: 950, range: "700-1200 ريال", description: "تجهيز بسيط وسريع لعيد ميلاد صغير.", features: ["بالونات بسيطة", "خلفية صغيرة", "طاولة كيك", "ديكور أساسي"] },
      { tier: BUNDLE_TIERS.MID, name: "باقة عيد ميلاد قياسية", basePrice: 2000, range: "1500-2500 ريال", description: "ثيم كامل مع تصوير وركن حلويات.", features: ["ثيم مخصص", "ديكور أفضل", "طاولة كيك", "تصوير", "ركن حلويات"] },
      { tier: BUNDLE_TIERS.HIGH, name: "باقة عيد ميلاد فاخرة", basePrice: 4000, range: "3000-5000 ريال", description: "تجهيز كامل وفاخر مع ترفيه وجلسات.", features: ["ثيم كامل", "ديكور فاخر", "تصوير وفيديو", "ماسكوت أو ترفيه", "ركن قهوة", "جلسات"] },
    ],
  },
  {
    name: "التجمعات العائلية",
    category: "التجمعات العائلية",
    description: "جلسات وضيافة لتجمعات البيت والاستراحات.",
    icon: "🏡",
    images: images.family,
    items: [
      { name: "جلسات", category: "الجلسات والأثاث", vendorKey: "seating", description: "جلسات عائلية داخلية أو خارجية.", price: 700, order: 1 },
      { name: "إضاءة", category: "الصوت والإضاءة", vendorKey: "lighting", description: "إضاءة مناسبة للتجمع.", price: 350, order: 2 },
      { name: "قهوة وضيافة", category: "القهوة والمشروبات", vendorKey: "coffee", description: "قهوة وشاي وتجهيز ضيافة.", price: 450, order: 3 },
      { name: "حلويات وتقديم", category: "الطعام والضيافة", vendorKey: "catering", description: "حلويات وترتيب تقديم للضيوف.", price: 650, order: 4 },
    ],
    packages: [
      { tier: BUNDLE_TIERS.CHEAP, name: "تجمع عائلي أساسي", basePrice: 1200, range: "800-1500 ريال", description: "جلسة عائلية بسيطة مع قهوة وإضاءة.", features: ["جلسات", "إضاءة", "قهوة", "ديكور بسيط"] },
      { tier: BUNDLE_TIERS.MID, name: "تجمع عائلي قياسي", basePrice: 2600, range: "1800-3500 ريال", description: "جلسات أرقى مع ضيافة وحلويات.", features: ["جلسات فاخرة", "حلويات", "إضاءة", "تدفئة أو تبريد", "ترتيب تقديم"] },
      { tier: BUNDLE_TIERS.HIGH, name: "تجمع عائلي فاخر", basePrice: 5500, range: "4000-7000 ريال", description: "تجهيز ضيافة متكامل لتجمع عائلي فاخر.", features: ["جلسة فاخرة", "ضيافة كاملة", "قهوة فاخرة", "تصوير", "تحسينات خارجية"] },
    ],
  },
  {
    name: "حفلات التخرج",
    category: "التخرج",
    description: "باقات تخرج مدرسية وجامعية موسمية.",
    icon: "🎓",
    images: images.graduation,
    items: [
      { name: "خلفية تخرج وبالونات", category: "الديكور والتنسيق", vendorKey: "decor", description: "خلفية تخرج مع ألوان وثيم مناسب.", price: 800, order: 1 },
      { name: "طاولة كيك", category: "الطعام والضيافة", vendorKey: "catering", description: "طاولة كيك وحلويات للتخرج.", price: 600, order: 2 },
      { name: "تصوير", category: "التصوير", vendorKey: "photo", description: "تصوير فوتوغرافي وفيديو حسب الباقة.", price: 900, order: 3 },
      { name: "قهوة وضيافة", category: "القهوة والمشروبات", vendorKey: "coffee", description: "ركن قهوة وضيافة للضيوف.", price: 600, order: 4 },
    ],
    packages: [
      { tier: BUNDLE_TIERS.CHEAP, name: "تخرج أساسي", basePrice: 1200, range: "900-1500 ريال", description: "خلفية تخرج وبالونات وطاولة كيك.", features: ["خلفية تخرج", "بالونات", "طاولة كيك"] },
      { tier: BUNDLE_TIERS.MID, name: "تخرج قياسي", basePrice: 2600, range: "1800-3500 ريال", description: "تجهيز أنيق مع تصوير وحلويات.", features: ["تجهيز أنيق", "تصوير", "حلويات", "ديكور ثيم"] },
      { tier: BUNDLE_TIERS.HIGH, name: "تخرج فاخر", basePrice: 5500, range: "4000-7000 ريال", description: "ديكور فاخر مع تصوير وضيافة.", features: ["ديكور فاخر", "تصوير وفيديو", "ركن قهوة", "ضيافة مميزة"] },
    ],
  },
  {
    name: "ملكة وخطوبة صغيرة",
    category: "الملكة والخطوبة",
    description: "تجهيزات أنيقة للملكة والخطوبة العائلية.",
    icon: "💍",
    images: images.engagement,
    items: [
      { name: "جلسة أنيقة", category: "الجلسات والأثاث", vendorKey: "seating", description: "جلسة راقية للعروسين والضيوف.", price: 1800, order: 1 },
      { name: "زهور وديكور", category: "الديكور والتنسيق", vendorKey: "decor", description: "زهور وتنسيق أنيق.", price: 2500, order: 2 },
      { name: "تصوير وفيديو", category: "التصوير", vendorKey: "photo", description: "توثيق المناسبة بصورة وفيديو.", price: 2500, order: 3 },
      { name: "حلويات وضيافة", category: "الطعام والضيافة", vendorKey: "catering", description: "حلويات وضيافة مرتبة.", price: 2200, order: 4 },
      { name: "ركن قهوة", category: "القهوة والمشروبات", vendorKey: "coffee", description: "ركن قهوة وشاي.", price: 900, order: 5 },
    ],
    packages: [
      { tier: BUNDLE_TIERS.CHEAP, name: "ملكة أساسية", basePrice: 3500, range: "2500-4500 ريال", description: "جلسة أنيقة وزهور وركن قهوة.", features: ["جلسة أنيقة", "زهور", "ديكور بسيط", "ركن قهوة"] },
      { tier: BUNDLE_TIERS.MID, name: "ملكة قياسية", basePrice: 7000, range: "5000-9000 ريال", description: "ديكور راق مع تصوير وضيافة.", features: ["ديكور مميز", "تصوير", "حلويات", "تنسيق ضيافة"] },
      { tier: BUNDLE_TIERS.HIGH, name: "ملكة فاخرة", basePrice: 14000, range: "10000-18000 ريال", description: "تجهيز فاخر ومتكامل.", features: ["تجهيز فاخر", "ضيافة كاملة", "مشاهد بصرية فاخرة", "زهور راقية", "تصوير وفيديو"] },
    ],
  },
  {
    name: "المناسبات النسائية",
    category: "مناسبات نسائية",
    description: "تجمعات شاي، بيبي شاور، برايدل شاور، ومناسبات نسائية.",
    icon: "🌸",
    images: images.women,
    items: [
      { name: "جلسات نسائية", category: "الجلسات والأثاث", vendorKey: "seating", description: "جلسات مريحة ومرتبة.", price: 900, order: 1 },
      { name: "حلويات", category: "الطعام والضيافة", vendorKey: "catering", description: "حلويات وترتيب طاولة.", price: 800, order: 2 },
      { name: "ديكور وزهور", category: "الديكور والتنسيق", vendorKey: "decor", description: "ديكور ناعم وزهور.", price: 1100, order: 3 },
      { name: "قهوة", category: "القهوة والمشروبات", vendorKey: "coffee", description: "ركن قهوة مناسب.", price: 600, order: 4 },
      { name: "تصوير", category: "التصوير", vendorKey: "photo", description: "تصوير تفاصيل المناسبة.", price: 1000, order: 5 },
    ],
    packages: [
      { tier: BUNDLE_TIERS.CHEAP, name: "تجمع نسائي أساسي", basePrice: 1400, range: "1000-1800 ريال", description: "جلسة وحلويات وديكور بسيط.", features: ["جلسات", "حلويات", "ديكور بسيط"] },
      { tier: BUNDLE_TIERS.MID, name: "تجمع نسائي قياسي", basePrice: 3000, range: "2000-4000 ريال", description: "تجهيز أنيق مع قهوة وضيافة.", features: ["تجهيز أنيق", "محطة قهوة", "ديكور مميز", "ترتيب ضيافة"] },
      { tier: BUNDLE_TIERS.HIGH, name: "تجمع نسائي فاخر", basePrice: 7000, range: "5000-9000 ريال", description: "جلسات فاخرة وتصوير وزهور.", features: ["جلسات فاخرة", "تصوير", "زهور", "تجهيز فاخر كامل"] },
    ],
  },
  {
    name: "تجمعات رمضان والعيد",
    category: "رمضان والعيد",
    description: "جلسات رمضانية وعيد عائلية بطابع عربي.",
    icon: "🌙",
    images: images.ramadan,
    items: [
      { name: "جلسة عربية", category: "الجلسات والأثاث", vendorKey: "seating", description: "جلسة عربية أو مجلس رمضاني.", price: 1400, order: 1 },
      { name: "ديكور رمضاني", category: "الديكور والتنسيق", vendorKey: "decor", description: "فوانيس وزينة رمضانية.", price: 1200, order: 2 },
      { name: "قهوة وضيافة", category: "القهوة والمشروبات", vendorKey: "coffee", description: "قهوة وشاي وضيافة.", price: 900, order: 3 },
      { name: "حلويات", category: "الطعام والضيافة", vendorKey: "catering", description: "حلويات رمضانية وترتيب تقديم.", price: 1100, order: 4 },
      { name: "شاشات وترفيه", category: "الترفيه", vendorKey: "entertainment", description: "شاشة أو نشاط عائلي.", price: 1500, order: 5 },
    ],
    packages: [
      { tier: BUNDLE_TIERS.CHEAP, name: "رمضان أساسي", basePrice: 1800, range: "1200-2500 ريال", description: "جلسة عربية وديكور وإضاءة.", features: ["جلسة عربية", "ديكور رمضان", "إضاءة", "ضيافة"] },
      { tier: BUNDLE_TIERS.MID, name: "رمضان قياسي", basePrice: 4500, range: "3000-6000 ريال", description: "مجلس مميز مع قهوة وحلويات.", features: ["مجلس مميز", "محطة قهوة", "إضاءة", "حلويات"] },
      { tier: BUNDLE_TIERS.HIGH, name: "رمضان فاخر", basePrice: 11000, range: "7000-15000 ريال", description: "خيمة رمضانية فاخرة وضيافة كاملة.", features: ["خيمة رمضانية فاخرة", "ضيافة مميزة", "ديكور كامل", "ترفيه وشاشات"] },
    ],
  },
  {
    name: "الشاليهات والجلسات الخارجية",
    category: "المناسبات الخارجية",
    description: "تجهيز شاليهات واستراحات وجلسات خارجية.",
    icon: "🏕️",
    images: images.outdoor,
    items: [
      { name: "جلسات خارجية", category: "الجلسات والأثاث", vendorKey: "seating", description: "جلسات خارجية مناسبة للأجواء.", price: 1400, order: 1 },
      { name: "إضاءة خارجية", category: "الصوت والإضاءة", vendorKey: "lighting", description: "إضاءة وسماعات بسيطة.", price: 900, order: 2 },
      { name: "شاليه أو استراحة", category: "المواقع والاستراحات", vendorKey: "venue", description: "اقتراح موقع مناسب عند الحاجة.", price: 2500, order: 3 },
      { name: "قهوة وضيافة", category: "القهوة والمشروبات", vendorKey: "coffee", description: "ركن قهوة ومشروبات.", price: 900, order: 4 },
      { name: "أنشطة وترفيه", category: "الترفيه", vendorKey: "entertainment", description: "أنشطة أو شاشة أو ألعاب.", price: 1300, order: 5 },
    ],
    packages: [
      { tier: BUNDLE_TIERS.CHEAP, name: "جلسة خارجية أساسية", basePrice: 2200, range: "1500-3000 ريال", description: "جلسة وإضاءة وتجهيز شواء.", features: ["جلسات خارجية", "إضاءة", "تجهيز شواء"] },
      { tier: BUNDLE_TIERS.MID, name: "جلسة خارجية قياسية", basePrice: 5200, range: "3500-7000 ريال", description: "جلسات مميزة مع بروجكتر وقهوة.", features: ["جلسات مميزة", "بروجكتر", "قهوة", "تدفئة أو تبريد"] },
      { tier: BUNDLE_TIERS.HIGH, name: "جلسة خارجية فاخرة", basePrice: 11500, range: "8000-15000 ريال", description: "تجهيز فاخر مع ضيافة وأنشطة.", features: ["تجهيز فاخر", "ضيافة مميزة", "أنشطة", "ترفيه"] },
    ],
  },
];

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function ensureUser(username: string, fullName: string, userType: string) {
  const [existing] = await db.select().from(users).where(eq(users.username, username));
  if (existing) return existing;

  const [created] = await db.insert(users).values({
    username,
    email: `${username}@saneea.local`,
    fullName,
    phone: `+9665${Math.floor(10000000 + Math.random() * 89999999)}`,
    userType,
    password: await hashPassword("password"),
  }).returning();
  return created;
}

async function main() {
  const admin = await ensureUser("seedadmin", "مشرف سنيع", USER_TYPES.ADMIN);

  await db.transaction(async (tx) => {
    await tx.delete(payments);
    await tx.delete(pricingHistory);
    await tx.delete(bookingConfirmations);
    await tx.delete(reviews).where(isNotNull(reviews.bookingId));
    await tx.delete(bookings).where(isNotNull(bookings.eventTypeId));
    await tx.delete(bundleItems);
    await tx.delete(bundleOptions);
    await tx.delete(itemVendorOptions);
    await tx.delete(eventItems);
    await tx.delete(questionnaireItems);
    await tx.delete(eventBundles);
    await tx.delete(eventTypes);
  });

  const vendorMap = new Map<string, typeof vendors.$inferSelect>();
  for (const vendor of vendorSeeds) {
    const user = await ensureUser(vendor.username, vendor.businessName, USER_TYPES.VENDOR);
    const [existing] = await db.select().from(vendors).where(eq(vendors.userId, user.id));
    if (existing) {
      const [updated] = await db.update(vendors).set({
        businessName: vendor.businessName,
        category: vendor.category,
        description: vendor.description,
        city: "الرياض",
        priceRange: "متوسط",
        rating: 4.8,
        reviewCount: 24,
        features: vendor.features,
        photos: vendor.photos,
      }).where(eq(vendors.id, existing.id)).returning();
      vendorMap.set(vendor.key, updated);
    } else {
      const [created] = await db.insert(vendors).values({
        userId: user.id,
        businessName: vendor.businessName,
        category: vendor.category,
        description: vendor.description,
        city: "الرياض",
        priceRange: "متوسط",
        rating: 4.8,
        reviewCount: 24,
        features: vendor.features,
        photos: vendor.photos,
      }).returning();
      vendorMap.set(vendor.key, created);
    }
  }

  for (const event of eventSeeds) {
    const [eventType] = await db.insert(eventTypes).values({
      name: event.name,
      description: event.description,
      icon: event.icon,
      category: event.category,
      images: event.images,
      videos: [],
      isActive: true,
      createdBy: admin.id,
      createdByType: USER_TYPES.ADMIN,
    }).returning();

    const itemMap = new Map<string, typeof eventItems.$inferSelect>();
    const optionMap = new Map<string, typeof itemVendorOptions.$inferSelect>();

    for (const item of event.items) {
      const [eventItem] = await db.insert(eventItems).values({
        eventTypeId: eventType.id,
        name: item.name,
        description: item.description,
        category: item.category,
        isRequired: true,
        displayOrder: item.order,
        isActive: true,
      }).returning();
      itemMap.set(item.name, eventItem);

      const vendor = vendorMap.get(item.vendorKey);
      if (!vendor) throw new Error(`Missing vendor for ${item.vendorKey}`);

      const [basicOption] = await db.insert(itemVendorOptions).values({
        eventItemId: eventItem.id,
        vendorId: vendor.id,
        optionName: `${item.name} - خيار أساسي`,
        description: item.description,
        price: Math.round(item.price * 0.8),
        images: vendor.photos as string[],
        isDefault: true,
        isActive: true,
      }).returning();

      const [premiumOption] = await db.insert(itemVendorOptions).values({
        eventItemId: eventItem.id,
        vendorId: vendor.id,
        optionName: `${item.name} - خيار فاخر`,
        description: `${item.description} بجودة أعلى وتفاصيل أكثر.`,
        price: Math.round(item.price * 1.45),
        images: vendor.photos as string[],
        isDefault: false,
        isActive: true,
      }).returning();

      optionMap.set(`${item.name}:cheap`, basicOption);
      optionMap.set(`${item.name}:mid`, basicOption);
      optionMap.set(`${item.name}:high`, premiumOption);
    }

    for (const pkg of event.packages) {
      const [bundle] = await db.insert(eventBundles).values({
        eventTypeId: eventType.id,
        name: pkg.name,
        tier: pkg.tier,
        description: `${pkg.description} النطاق التقريبي: ${pkg.range}.`,
        basePrice: pkg.basePrice,
        totalQuantity: 100,
        availableQuantity: 100,
        features: pkg.features,
        images: event.images,
        videos: [],
        isActive: true,
        displayOrder: pkg.tier === BUNDLE_TIERS.CHEAP ? 1 : pkg.tier === BUNDLE_TIERS.MID ? 2 : 3,
        createdBy: admin.id,
      }).returning();

      let order = 1;
      for (const item of event.items) {
        const eventItem = itemMap.get(item.name);
        const option = optionMap.get(`${item.name}:${pkg.tier}`);
        if (!eventItem || !option) continue;
        await db.insert(bundleItems).values({
          bundleId: bundle.id,
          eventItemId: eventItem.id,
          defaultOptionId: option.id,
          isIncluded: true,
          quantity: 1,
          displayOrder: order++,
        });
      }
    }
  }

  const count = await db.select({ count: sql<number>`count(*)` }).from(eventTypes);
  console.log(`Seeded ${count[0]?.count ?? eventSeeds.length} Arabic event categories.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
