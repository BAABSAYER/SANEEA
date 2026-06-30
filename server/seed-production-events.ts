import "dotenv/config";
import { db, pool } from "./db";
import {
  BUNDLE_TIERS,
  SERVICE_CATEGORIES,
  USER_TYPES,
  bundleItems,
  eventBundles,
  eventItems,
  eventTypes,
  itemVendorOptions,
  questionnaireItems,
  users,
  vendors,
} from "@shared/schema";
import { and, eq, inArray, or } from "drizzle-orm";
import { randomBytes, scrypt } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

const EVENT_IMAGES = {
  graduation: [
    "https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1627556704302-624286467c65?auto=format&fit=crop&w=1200&q=80",
  ],
  baby: [
    "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=1200&q=80",
  ],
  family: [
    "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1527529482837-4698179dc6ce?auto=format&fit=crop&w=1200&q=80",
  ],
};

type VendorKey = "decor" | "hospitality" | "photography" | "seating" | "entertainment";

type EventSeed = {
  name: string;
  aliases: string[];
  description: string;
  icon: string;
  category: string;
  images: string[];
  questions: Array<{
    questionText: string;
    questionType: string;
    options?: string[];
    required?: boolean;
  }>;
  items: Array<{
    key: string;
    name: string;
    description: string;
    category: string;
    vendorKey: VendorKey;
    displayOrder: number;
    options: Array<{
      optionName: string;
      description: string;
      price: number;
      images: string[];
      isDefault?: boolean;
      includedIn: Array<"cheap" | "mid" | "high">;
    }>;
  }>;
  bundles: Array<{
    tier: "cheap" | "mid" | "high";
    name: string;
    description: string;
    basePrice: number;
    features: string[];
    displayOrder: number;
    images: string[];
  }>;
};

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function ensureUser(input: {
  username: string;
  email: string;
  fullName: string;
  phone?: string;
  userType: string;
}) {
  const [existingByUsername] = await db.select().from(users).where(eq(users.username, input.username));
  if (existingByUsername) return existingByUsername;

  const [existingByEmail] = await db.select().from(users).where(eq(users.email, input.email));
  if (existingByEmail) return existingByEmail;

  const [created] = await db
    .insert(users)
    .values({
      ...input,
      password: await hashPassword("test123"),
    })
    .returning();
  return created;
}

async function ensureVendor(input: {
  username: string;
  email: string;
  fullName: string;
  phone: string;
  businessName: string;
  category: string;
  description: string;
  city: string;
  photos: string[];
}) {
  const user = await ensureUser({
    username: input.username,
    email: input.email,
    fullName: input.fullName,
    phone: input.phone,
    userType: USER_TYPES.VENDOR,
  });

  const [existing] = await db.select().from(vendors).where(eq(vendors.userId, user.id));
  if (existing) {
    const [updated] = await db
      .update(vendors)
      .set({
        businessName: input.businessName,
        category: input.category,
        description: input.description,
        city: input.city,
        photos: input.photos,
        rating: existing.rating ?? 4.8,
        reviewCount: existing.reviewCount ?? 24,
      })
      .where(eq(vendors.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(vendors)
    .values({
      userId: user.id,
      businessName: input.businessName,
      category: input.category,
      description: input.description,
      city: input.city,
      rating: 4.8,
      reviewCount: 24,
      photos: input.photos,
    })
    .returning();
  return created;
}

async function ensureEventType(adminId: number, seed: EventSeed) {
  const [existing] = await db
    .select()
    .from(eventTypes)
    .where(or(eq(eventTypes.category, seed.category), inArray(eventTypes.name, seed.aliases)));

  const values = {
    name: seed.name,
    description: seed.description,
    icon: seed.icon,
    category: seed.category,
    images: seed.images,
    videos: [],
    isActive: true,
    requiresApproval: false,
    approvedBy: adminId,
    approvedAt: new Date(),
    createdBy: adminId,
    createdByType: USER_TYPES.ADMIN,
    updatedAt: new Date(),
  };

  if (existing) {
    const [updated] = await db.update(eventTypes).set(values).where(eq(eventTypes.id, existing.id)).returning();
    return updated;
  }

  const [created] = await db.insert(eventTypes).values(values).returning();
  return created;
}

async function ensureQuestion(eventTypeId: number, adminId: number, input: EventSeed["questions"][number], displayOrder: number) {
  const [existing] = await db
    .select()
    .from(questionnaireItems)
    .where(and(eq(questionnaireItems.eventTypeId, eventTypeId), eq(questionnaireItems.questionText, input.questionText)));

  const values = {
    eventTypeId,
    questionText: input.questionText,
    questionType: input.questionType,
    options: input.options ?? null,
    required: input.required ?? false,
    displayOrder,
    createdBy: adminId,
  };

  if (existing) {
    const [updated] = await db
      .update(questionnaireItems)
      .set(values)
      .where(eq(questionnaireItems.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db.insert(questionnaireItems).values(values).returning();
  return created;
}

async function ensureEventItem(eventTypeId: number, input: EventSeed["items"][number]) {
  const [existing] = await db
    .select()
    .from(eventItems)
    .where(and(eq(eventItems.eventTypeId, eventTypeId), eq(eventItems.name, input.name)));

  const values = {
    eventTypeId,
    name: input.name,
    description: input.description,
    category: input.category,
    isRequired: true,
    displayOrder: input.displayOrder,
    isActive: true,
    updatedAt: new Date(),
  };

  if (existing) {
    const [updated] = await db.update(eventItems).set(values).where(eq(eventItems.id, existing.id)).returning();
    return updated;
  }

  const [created] = await db.insert(eventItems).values(values).returning();
  return created;
}

async function ensureVendorOption(input: {
  eventItemId: number;
  vendorId: number;
  optionName: string;
  description: string;
  price: number;
  images: string[];
  isDefault?: boolean;
}) {
  const [existing] = await db
    .select()
    .from(itemVendorOptions)
    .where(and(eq(itemVendorOptions.eventItemId, input.eventItemId), eq(itemVendorOptions.optionName, input.optionName)));

  const values = {
    eventItemId: input.eventItemId,
    vendorId: input.vendorId,
    optionName: input.optionName,
    description: input.description,
    price: input.price,
    images: input.images,
    isDefault: input.isDefault ?? false,
    isActive: true,
    updatedAt: new Date(),
  };

  if (existing) {
    const [updated] = await db
      .update(itemVendorOptions)
      .set(values)
      .where(eq(itemVendorOptions.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db.insert(itemVendorOptions).values(values).returning();
  return created;
}

async function ensureBundle(eventTypeId: number, adminId: number, input: EventSeed["bundles"][number]) {
  const [existing] = await db
    .select()
    .from(eventBundles)
    .where(and(eq(eventBundles.eventTypeId, eventTypeId), eq(eventBundles.tier, input.tier)));

  const values = {
    eventTypeId,
    name: input.name,
    tier: input.tier,
    description: input.description,
    basePrice: input.basePrice,
    totalQuantity: 100,
    availableQuantity: existingAvailableQuantity(existing?.availableQuantity),
    features: input.features,
    images: input.images,
    videos: [],
    isActive: true,
    displayOrder: input.displayOrder,
    createdBy: adminId,
    updatedAt: new Date(),
  };

  if (existing) {
    const [updated] = await db.update(eventBundles).set(values).where(eq(eventBundles.id, existing.id)).returning();
    return updated;
  }

  const [created] = await db.insert(eventBundles).values(values).returning();
  return created;
}

function existingAvailableQuantity(value: number | null | undefined) {
  return typeof value === "number" && value >= 0 ? value : 100;
}

async function ensureBundleItem(input: {
  bundleId: number;
  eventItemId: number;
  defaultOptionId: number;
  displayOrder: number;
}) {
  const [existing] = await db
    .select()
    .from(bundleItems)
    .where(and(eq(bundleItems.bundleId, input.bundleId), eq(bundleItems.eventItemId, input.eventItemId)));

  const values = {
    bundleId: input.bundleId,
    eventItemId: input.eventItemId,
    defaultOptionId: input.defaultOptionId,
    isIncluded: true,
    quantity: 1,
    priceOverride: null,
    displayOrder: input.displayOrder,
    updatedAt: new Date(),
  };

  if (existing) {
    const [updated] = await db.update(bundleItems).set(values).where(eq(bundleItems.id, existing.id)).returning();
    return updated;
  }

  const [created] = await db.insert(bundleItems).values(values).returning();
  return created;
}

const SEED_EVENTS: EventSeed[] = [
  {
    name: "حفلة تخرج",
    aliases: ["حفلة تخرج", "حفلات التخرج", "Graduation", "Graduation Party"],
    description: "تنظيم حفلات التخرج بديكور أنيق، ضيافة سعودية، تصوير، وتنسيق يناسب العائلة والضيوف.",
    icon: "🎓",
    category: "graduation",
    images: EVENT_IMAGES.graduation,
    questions: [
      { questionText: "ما اسم الخريج أو الخريجة؟", questionType: "text", required: true },
      { questionText: "ما المرحلة أو الجهة التعليمية؟", questionType: "text", required: true },
      { questionText: "تاريخ المناسبة", questionType: "date", required: true },
      { questionText: "وقت البداية المتوقع", questionType: "text", required: true },
      { questionText: "عدد الضيوف التقريبي", questionType: "number", required: true },
      { questionText: "أين تقام المناسبة؟", questionType: "text", required: true },
      { questionText: "ما الألوان أو الثيم المفضل؟", questionType: "text" },
      {
        questionText: "هل تحتاج تصوير أو فيديو؟",
        questionType: "single_choice",
        options: ["تصوير فقط", "تصوير وفيديو", "لا أحتاج"],
      },
      { questionText: "أي ملاحظات خاصة للحفل؟", questionType: "textarea" },
    ],
    items: [
      {
        key: "graduation_decor",
        name: "ديكور ومنصة التخرج",
        description: "خلفية تخرج، بالونات، طاولة استقبال، وتنسيق ألوان الحفل.",
        category: SERVICE_CATEGORIES.DECORATION,
        vendorKey: "decor",
        displayOrder: 1,
        options: [
          {
            optionName: "ديكور تخرج أساسي",
            description: "خلفية تخرج بسيطة مع طاولة استقبال وبالونات.",
            price: 900,
            images: [EVENT_IMAGES.graduation[0]],
            isDefault: true,
            includedIn: ["cheap"],
          },
          {
            optionName: "ديكور تخرج فاخر",
            description: "منصة تصوير، تنسيق ورد، إضاءة، وتفاصيل باسم الخريج.",
            price: 2200,
            images: [EVENT_IMAGES.graduation[1]],
            includedIn: ["mid", "high"],
          },
        ],
      },
      {
        key: "graduation_hospitality",
        name: "ضيافة وقهوة",
        description: "قهوة عربية، تمر، مياه، وحلويات مناسبة لحفلات التخرج.",
        category: SERVICE_CATEGORIES.CATERING,
        vendorKey: "hospitality",
        displayOrder: 2,
        options: [
          {
            optionName: "ضيافة خفيفة للتخرج",
            description: "قهوة عربية وتمر ومياه حتى 50 ضيف.",
            price: 650,
            images: ["https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&w=1200&q=80"],
            isDefault: true,
            includedIn: ["cheap"],
          },
          {
            optionName: "بوفيه حلويات تخرج",
            description: "ضيافة قهوة وحلويات وتوزيعات حتى 100 ضيف.",
            price: 1800,
            images: ["https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=1200&q=80"],
            includedIn: ["mid", "high"],
          },
        ],
      },
      {
        key: "graduation_photo",
        name: "تصوير التخرج",
        description: "تغطية تصوير للحفل واللقطات العائلية.",
        category: SERVICE_CATEGORIES.PHOTOGRAPHY,
        vendorKey: "photography",
        displayOrder: 3,
        options: [
          {
            optionName: "تصوير فوتوغرافي",
            description: "تغطية ساعتين للصور الرئيسية.",
            price: 700,
            images: ["https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1200&q=80"],
            isDefault: true,
            includedIn: ["mid"],
          },
          {
            optionName: "تصوير وفيديو قصير",
            description: "تصوير فوتوغرافي وفيديو قصير للحفل.",
            price: 1800,
            images: ["https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80"],
            includedIn: ["high"],
          },
        ],
      },
    ],
    bundles: [
      {
        tier: BUNDLE_TIERS.CHEAP,
        name: "باقة تخرج أساسية",
        description: "خيار مناسب لحفل عائلي بسيط مع ديكور وضيافة خفيفة.",
        basePrice: 1200,
        features: ["ديكور تخرج بسيط", "طاولة استقبال", "ضيافة قهوة وتمر", "تنسيق قبل المناسبة"],
        displayOrder: 1,
        images: [EVENT_IMAGES.graduation[0]],
      },
      {
        tier: BUNDLE_TIERS.MID,
        name: "باقة تخرج مميزة",
        description: "باقة متوازنة تشمل ديكور فاخر، ضيافة أوسع، وتصوير.",
        basePrice: 2800,
        features: ["منصة تصوير", "تنسيق ألوان باسم الخريج", "بوفيه حلويات", "تصوير فوتوغرافي"],
        displayOrder: 2,
        images: EVENT_IMAGES.graduation,
      },
      {
        tier: BUNDLE_TIERS.HIGH,
        name: "باقة تخرج فاخرة",
        description: "تنظيم كامل لحفل تخرج فاخر بتفاصيل تصوير وضيافة عالية.",
        basePrice: 5500,
        features: ["ديكور فاخر", "إضاءة ومنصة", "ضيافة وحلويات موسعة", "تصوير وفيديو قصير"],
        displayOrder: 3,
        images: EVENT_IMAGES.graduation,
      },
    ],
  },
  {
    name: "استقبال مولود",
    aliases: ["استقبال مولود", "استقبال مواليد", "Baby Welcoming", "Baby Shower"],
    description: "تنظيم استقبال المولود بتنسيق لطيف، ثيم مناسب، ضيافة خفيفة، وتصوير للذكرى.",
    icon: "👶",
    category: "baby_welcoming",
    images: EVENT_IMAGES.baby,
    questions: [
      { questionText: "ما اسم المولود؟", questionType: "text" },
      { questionText: "نوع الثيم المفضل", questionType: "single_choice", options: ["ولد", "بنت", "محايد", "ثيم خاص"] },
      { questionText: "تاريخ الاستقبال", questionType: "date", required: true },
      { questionText: "وقت البداية المتوقع", questionType: "text", required: true },
      { questionText: "عدد الضيوف التقريبي", questionType: "number", required: true },
      { questionText: "موقع المناسبة", questionType: "text", required: true },
      { questionText: "الألوان أو العبارات المطلوبة", questionType: "text" },
      {
        questionText: "نوع الضيافة المطلوبة",
        questionType: "multiple_choice",
        options: ["قهوة وتمر", "حلويات", "توزيعات", "ركن تصوير"],
      },
      { questionText: "أي ملاحظات خاصة؟", questionType: "textarea" },
    ],
    items: [
      {
        key: "baby_decor",
        name: "ديكور استقبال المولود",
        description: "ثيم مولود، بالونات، خلفية تصوير، وتنسيق طاولة.",
        category: SERVICE_CATEGORIES.DECORATION,
        vendorKey: "decor",
        displayOrder: 1,
        options: [
          {
            optionName: "ديكور مولود بسيط",
            description: "خلفية صغيرة وبالونات وثيم بسيط.",
            price: 750,
            images: [EVENT_IMAGES.baby[0]],
            isDefault: true,
            includedIn: ["cheap"],
          },
          {
            optionName: "ديكور مولود فاخر",
            description: "خلفية كبيرة، طاولة حلويات، بالونات، وتخصيص باسم المولود.",
            price: 1900,
            images: [EVENT_IMAGES.baby[1]],
            includedIn: ["mid", "high"],
          },
        ],
      },
      {
        key: "baby_sweets",
        name: "حلويات وتوزيعات",
        description: "حلويات خفيفة وتوزيعات استقبال بتغليف مناسب للثيم.",
        category: SERVICE_CATEGORIES.CATERING,
        vendorKey: "hospitality",
        displayOrder: 2,
        options: [
          {
            optionName: "حلويات استقبال",
            description: "حلويات صغيرة وتوزيعات حتى 40 ضيف.",
            price: 650,
            images: ["https://images.unsplash.com/photo-1486427944299-d1955d23e34d?auto=format&fit=crop&w=1200&q=80"],
            isDefault: true,
            includedIn: ["cheap"],
          },
          {
            optionName: "ركن حلويات وتوزيعات",
            description: "ركن حلويات وتوزيعات مخصصة حتى 80 ضيف.",
            price: 1600,
            images: ["https://images.unsplash.com/photo-1488477304112-4944851de03d?auto=format&fit=crop&w=1200&q=80"],
            includedIn: ["mid", "high"],
          },
        ],
      },
      {
        key: "baby_photo",
        name: "تصوير استقبال",
        description: "توثيق الاستقبال وركن التصوير.",
        category: SERVICE_CATEGORIES.PHOTOGRAPHY,
        vendorKey: "photography",
        displayOrder: 3,
        options: [
          {
            optionName: "تصوير صور فقط",
            description: "تغطية ساعة ونصف للصور.",
            price: 600,
            images: ["https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1200&q=80"],
            isDefault: true,
            includedIn: ["mid"],
          },
          {
            optionName: "تصوير صور وفيديو",
            description: "صور وفيديو قصير للاستقبال.",
            price: 1400,
            images: ["https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80"],
            includedIn: ["high"],
          },
        ],
      },
    ],
    bundles: [
      {
        tier: BUNDLE_TIERS.CHEAP,
        name: "باقة استقبال مولود أساسية",
        description: "ديكور لطيف وضيافة خفيفة لاستقبال صغير.",
        basePrice: 900,
        features: ["ثيم بسيط", "طاولة استقبال", "حلويات خفيفة", "تنسيق ألوان"],
        displayOrder: 1,
        images: [EVENT_IMAGES.baby[0]],
      },
      {
        tier: BUNDLE_TIERS.MID,
        name: "باقة استقبال مولود مميزة",
        description: "ديكور مخصص مع ركن حلويات وتصوير.",
        basePrice: 2200,
        features: ["ديكور باسم المولود", "ركن حلويات", "توزيعات", "تصوير صور"],
        displayOrder: 2,
        images: EVENT_IMAGES.baby,
      },
      {
        tier: BUNDLE_TIERS.HIGH,
        name: "باقة استقبال مولود فاخرة",
        description: "تنظيم كامل للاستقبال مع تفاصيل ضيافة وتصوير فاخرة.",
        basePrice: 4500,
        features: ["خلفية فاخرة", "ركن حلويات وتوزيعات", "إضاءة", "تصوير صور وفيديو"],
        displayOrder: 3,
        images: EVENT_IMAGES.baby,
      },
    ],
  },
  {
    name: "تجمع عائلي",
    aliases: ["تجمع عائلي", "التجمعات العائلية", "Family Gathering", "Family Event"],
    description: "تنظيم الجلسات والتجمعات العائلية بضيافة سعودية، جلسات مريحة، وخيارات عشاء أو بوفيه.",
    icon: "🏡",
    category: "family_gathering",
    images: EVENT_IMAGES.family,
    questions: [
      { questionText: "تاريخ التجمع", questionType: "date", required: true },
      { questionText: "وقت البداية المتوقع", questionType: "text", required: true },
      { questionText: "عدد الضيوف التقريبي", questionType: "number", required: true },
      { questionText: "مكان التجمع", questionType: "text", required: true },
      {
        questionText: "نوع الجلسة المطلوبة",
        questionType: "single_choice",
        options: ["جلسة أرضية", "طاولات وكراسي", "مجلس خارجي", "حسب المتاح"],
      },
      {
        questionText: "نوع الطعام أو الضيافة",
        questionType: "multiple_choice",
        options: ["قهوة وتمر", "عشاء", "بوفيه", "حلويات", "مشروبات"],
      },
      { questionText: "هل تحتاج فقرات أو ترفيه للأطفال؟", questionType: "single_choice", options: ["نعم", "لا", "ربما"] },
      { questionText: "أي ملاحظات خاصة؟", questionType: "textarea" },
    ],
    items: [
      {
        key: "family_seating",
        name: "جلسات وترتيب المكان",
        description: "تجهيز جلسات عائلية مريحة حسب عدد الضيوف والموقع.",
        category: SERVICE_CATEGORIES.VENUE,
        vendorKey: "seating",
        displayOrder: 1,
        options: [
          {
            optionName: "جلسة عائلية بسيطة",
            description: "جلسة أرضية أو كراسي حتى 40 ضيف.",
            price: 900,
            images: [EVENT_IMAGES.family[0]],
            isDefault: true,
            includedIn: ["cheap"],
          },
          {
            optionName: "جلسة عائلية موسعة",
            description: "جلسات وطاولات وتنسيق كامل حتى 100 ضيف.",
            price: 2400,
            images: [EVENT_IMAGES.family[1]],
            includedIn: ["mid", "high"],
          },
        ],
      },
      {
        key: "family_catering",
        name: "ضيافة وعشاء",
        description: "قهوة عربية وخيارات عشاء أو بوفيه عائلي.",
        category: SERVICE_CATEGORIES.CATERING,
        vendorKey: "hospitality",
        displayOrder: 2,
        options: [
          {
            optionName: "ضيافة عائلية",
            description: "قهوة وتمر ومياه ومشروبات.",
            price: 700,
            images: ["https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&w=1200&q=80"],
            isDefault: true,
            includedIn: ["cheap"],
          },
          {
            optionName: "عشاء عائلي",
            description: "عشاء أو بوفيه مناسب للتجمعات العائلية.",
            price: 2800,
            images: ["https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=1200&q=80"],
            includedIn: ["mid", "high"],
          },
        ],
      },
      {
        key: "family_decor",
        name: "تنسيق وإضاءة",
        description: "لمسات ديكور وإضاءة بسيطة تناسب أجواء العائلة.",
        category: SERVICE_CATEGORIES.DECORATION,
        vendorKey: "decor",
        displayOrder: 3,
        options: [
          {
            optionName: "تنسيق بسيط",
            description: "إضاءة ولمسات ديكور خفيفة.",
            price: 500,
            images: ["https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&w=1200&q=80"],
            isDefault: true,
            includedIn: ["mid"],
          },
          {
            optionName: "تنسيق فاخر",
            description: "إضاءة، طاولات، وديكور كامل للتجمع.",
            price: 1800,
            images: ["https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&w=1200&q=80"],
            includedIn: ["high"],
          },
        ],
      },
      {
        key: "family_entertainment",
        name: "ترفيه للأطفال",
        description: "ركن ألعاب أو نشاط خفيف للأطفال حسب المناسبة.",
        category: SERVICE_CATEGORIES.ENTERTAINMENT,
        vendorKey: "entertainment",
        displayOrder: 4,
        options: [
          {
            optionName: "ركن ألعاب بسيط",
            description: "نشاط خفيف للأطفال لمدة ساعتين.",
            price: 900,
            images: ["https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80"],
            isDefault: true,
            includedIn: ["high"],
          },
        ],
      },
    ],
    bundles: [
      {
        tier: BUNDLE_TIERS.CHEAP,
        name: "باقة تجمع عائلي أساسية",
        description: "جلسة وضيافة خفيفة لتجمع عائلي صغير.",
        basePrice: 1300,
        features: ["جلسة بسيطة", "قهوة وتمر", "تنسيق أساسي", "متابعة قبل المناسبة"],
        displayOrder: 1,
        images: [EVENT_IMAGES.family[0]],
      },
      {
        tier: BUNDLE_TIERS.MID,
        name: "باقة تجمع عائلي مميزة",
        description: "جلسات مريحة مع عشاء وتنسيق مناسب للعائلة.",
        basePrice: 3000,
        features: ["جلسات موسعة", "عشاء عائلي", "إضاءة خفيفة", "تنسيق المكان"],
        displayOrder: 2,
        images: EVENT_IMAGES.family,
      },
      {
        tier: BUNDLE_TIERS.HIGH,
        name: "باقة تجمع عائلي فاخرة",
        description: "تجربة كاملة للتجمعات الكبيرة مع عشاء وترفيه وتنسيق فاخر.",
        basePrice: 6500,
        features: ["جلسات كاملة", "بوفيه أو عشاء", "ديكور وإضاءة", "ترفيه للأطفال"],
        displayOrder: 3,
        images: EVENT_IMAGES.family,
      },
    ],
  },
];

async function main() {
  const admin = await ensureUser({
    username: "saneea_catalog_admin",
    email: "catalog-admin@saneea.local",
    fullName: "Saneea Catalog Admin",
    phone: "+966500000001",
    userType: USER_TYPES.ADMIN,
  });

  const vendorMap = {
    decor: await ensureVendor({
      username: "saneea_seed_decor",
      email: "seed-decor@saneea.local",
      fullName: "Saneea Decor Team",
      phone: "+966500000011",
      businessName: "تنسيق سنيع للمناسبات",
      category: SERVICE_CATEGORIES.DECORATION,
      description: "تنسيق ديكور، ثيمات، منصات تصوير، وإضاءة للمناسبات العائلية.",
      city: "الرياض",
      photos: [EVENT_IMAGES.graduation[0], EVENT_IMAGES.baby[0], EVENT_IMAGES.family[1]],
    }),
    hospitality: await ensureVendor({
      username: "saneea_seed_hospitality",
      email: "seed-hospitality@saneea.local",
      fullName: "Saneea Hospitality Team",
      phone: "+966500000012",
      businessName: "ضيافة نجد",
      category: SERVICE_CATEGORIES.CATERING,
      description: "ضيافة قهوة عربية، حلويات، بوفيهات خفيفة، وعشاء عائلي.",
      city: "الرياض",
      photos: [
        "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=1200&q=80",
      ],
    }),
    photography: await ensureVendor({
      username: "saneea_seed_photography",
      email: "seed-photography@saneea.local",
      fullName: "Saneea Photography Team",
      phone: "+966500000013",
      businessName: "استوديو لحظات",
      category: SERVICE_CATEGORIES.PHOTOGRAPHY,
      description: "تصوير مناسبات عائلية، فيديو قصير، وتوثيق لحظات خاصة.",
      city: "الرياض",
      photos: [
        "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
      ],
    }),
    seating: await ensureVendor({
      username: "saneea_seed_seating",
      email: "seed-seating@saneea.local",
      fullName: "Saneea Seating Team",
      phone: "+966500000014",
      businessName: "جلسات الدار",
      category: SERVICE_CATEGORIES.VENUE,
      description: "جلسات داخلية وخارجية وتنسيق أماكن للتجمعات العائلية.",
      city: "الرياض",
      photos: EVENT_IMAGES.family,
    }),
    entertainment: await ensureVendor({
      username: "saneea_seed_entertainment",
      email: "seed-entertainment@saneea.local",
      fullName: "Saneea Entertainment Team",
      phone: "+966500000015",
      businessName: "ركن المرح",
      category: SERVICE_CATEGORIES.ENTERTAINMENT,
      description: "أنشطة خفيفة وأركان ألعاب للأطفال ضمن المناسبات العائلية.",
      city: "الرياض",
      photos: ["https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80"],
    }),
  };

  for (const eventSeed of SEED_EVENTS) {
    const eventType = await ensureEventType(admin.id, eventSeed);
    console.log(`Upserted event type: ${eventType.name} (#${eventType.id})`);

    for (let index = 0; index < eventSeed.questions.length; index += 1) {
      const question = eventSeed.questions[index];
      await ensureQuestion(eventType.id, admin.id, question, index + 1);
    }

    const bundlesByTier = new Map<string, Awaited<ReturnType<typeof ensureBundle>>>();
    for (const bundleSeed of eventSeed.bundles) {
      const bundle = await ensureBundle(eventType.id, admin.id, bundleSeed);
      bundlesByTier.set(bundleSeed.tier, bundle);
    }

    for (const itemSeed of eventSeed.items) {
      const item = await ensureEventItem(eventType.id, itemSeed);
      const optionByTier = new Map<string, Awaited<ReturnType<typeof ensureVendorOption>>>();

      for (const optionSeed of itemSeed.options) {
        const option = await ensureVendorOption({
          eventItemId: item.id,
          vendorId: vendorMap[itemSeed.vendorKey].id,
          optionName: optionSeed.optionName,
          description: optionSeed.description,
          price: optionSeed.price,
          images: optionSeed.images,
          isDefault: optionSeed.isDefault,
        });

        for (const tier of optionSeed.includedIn) {
          optionByTier.set(tier, option);
        }
      }

      for (const bundleSeed of eventSeed.bundles) {
        const bundle = bundlesByTier.get(bundleSeed.tier);
        const defaultOption = optionByTier.get(bundleSeed.tier);
        if (!bundle || !defaultOption) continue;

        await ensureBundleItem({
          bundleId: bundle.id,
          eventItemId: item.id,
          defaultOptionId: defaultOption.id,
          displayOrder: itemSeed.displayOrder,
        });
      }
    }
  }

  console.log("Production event seeds are ready.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
