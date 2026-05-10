import "dotenv/config";
import { db } from "./db";
import {
  BUNDLE_TIERS,
  USER_TYPES,
  eventBundles,
  eventItems,
  eventTypes,
  itemVendorOptions,
  bundleItems,
  users,
  vendors,
} from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function ensureUser(input: {
  username: string;
  email: string;
  fullName: string;
  userType: string;
}) {
  const [existing] = await db.select().from(users).where(eq(users.username, input.username));
  if (existing) return existing;

  const [created] = await db.insert(users).values({
    ...input,
    password: await hashPassword("password"),
  }).returning();
  return created;
}

async function ensureVendor(input: {
  username: string;
  email: string;
  fullName: string;
  businessName: string;
  category: string;
  description: string;
  city: string;
}) {
  const user = await ensureUser({
    username: input.username,
    email: input.email,
    fullName: input.fullName,
    userType: USER_TYPES.VENDOR,
  });

  const [existingVendor] = await db.select().from(vendors).where(eq(vendors.userId, user.id));
  if (existingVendor) return existingVendor;

  const [createdVendor] = await db.insert(vendors).values({
    userId: user.id,
    businessName: input.businessName,
    category: input.category,
    description: input.description,
    city: input.city,
    rating: 4.7,
    reviewCount: 18,
    photos: [],
  }).returning();
  return createdVendor;
}

async function ensureEventType() {
  const [existing] = await db.select().from(eventTypes).where(eq(eventTypes.name, "Wedding"));
  if (existing) return existing;

  const admin = await ensureUser({
    username: "seedadmin",
    email: "seedadmin@saneea.local",
    fullName: "Seed Admin",
    userType: USER_TYPES.ADMIN,
  });

  const [created] = await db.insert(eventTypes).values({
    name: "Wedding",
    description: "Complete wedding planning packages with curated venues, catering, photography, and decoration.",
    icon: "💍",
    category: "wedding",
    images: [
      "https://images.unsplash.com/photo-1519741497674-611481863552",
      "https://images.unsplash.com/photo-1523438885200-e635ba2c371e",
    ],
    isActive: true,
    createdBy: admin.id,
    createdByType: USER_TYPES.ADMIN,
  }).returning();
  return created;
}

async function ensureItem(eventTypeId: number, input: {
  name: string;
  description: string;
  category: string;
  displayOrder: number;
}) {
  const [existing] = await db
    .select()
    .from(eventItems)
    .where(and(eq(eventItems.eventTypeId, eventTypeId), eq(eventItems.name, input.name)));
  if (existing) return existing;

  const [created] = await db.insert(eventItems).values({
    eventTypeId,
    ...input,
    isRequired: true,
    isActive: true,
  }).returning();
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
    .where(and(
      eq(itemVendorOptions.eventItemId, input.eventItemId),
      eq(itemVendorOptions.vendorId, input.vendorId),
      eq(itemVendorOptions.optionName, input.optionName),
    ));
  if (existing) return existing;

  const [created] = await db.insert(itemVendorOptions).values({
    ...input,
    isDefault: input.isDefault ?? false,
    isActive: true,
  }).returning();
  return created;
}

async function ensureBundle(input: {
  eventTypeId: number;
  name: string;
  tier: string;
  description: string;
  displayOrder: number;
}) {
  const [existing] = await db
    .select()
    .from(eventBundles)
    .where(and(eq(eventBundles.eventTypeId, input.eventTypeId), eq(eventBundles.tier, input.tier)));
  if (existing) return existing;

  const [created] = await db.insert(eventBundles).values({
    ...input,
    basePrice: 0,
    totalQuantity: 100,
    availableQuantity: 100,
    features: [
      "Curated event team",
      "Package item customization",
      "Admin coordination",
    ],
    isActive: true,
  }).returning();
  return created;
}

async function ensureBundleItem(input: {
  bundleId: number;
  eventItemId: number;
  defaultOptionId: number;
  quantity: number;
  displayOrder: number;
}) {
  const [existing] = await db
    .select()
    .from(bundleItems)
    .where(and(eq(bundleItems.bundleId, input.bundleId), eq(bundleItems.eventItemId, input.eventItemId)));
  if (existing) return existing;

  const [created] = await db.insert(bundleItems).values({
    ...input,
    isIncluded: true,
  }).returning();
  return created;
}

async function main() {
  const eventType = await ensureEventType();

  const venueVendor = await ensureVendor({
    username: "riyadhvenue",
    email: "venue@saneea.local",
    fullName: "Riyadh Venue Team",
    businessName: "Riyadh Garden Hall",
    category: "venue",
    description: "Elegant indoor and outdoor wedding venue.",
    city: "Riyadh",
  });
  const cateringVendor = await ensureVendor({
    username: "najdcatering",
    email: "catering@saneea.local",
    fullName: "Najd Catering Team",
    businessName: "Najd Catering",
    category: "catering",
    description: "Saudi and international menus for private events.",
    city: "Riyadh",
  });
  const photoVendor = await ensureVendor({
    username: "lightstudio",
    email: "photo@saneea.local",
    fullName: "Light Studio",
    businessName: "Light Studio",
    category: "photography",
    description: "Wedding photography and cinematic video coverage.",
    city: "Riyadh",
  });
  const decorVendor = await ensureVendor({
    username: "bloomdecor",
    email: "decor@saneea.local",
    fullName: "Bloom Decor",
    businessName: "Bloom Decor",
    category: "decoration",
    description: "Floral stages, tables, and wedding atmosphere design.",
    city: "Riyadh",
  });

  const venue = await ensureItem(eventType.id, {
    name: "Venue",
    description: "Wedding venue and guest seating setup.",
    category: "venue",
    displayOrder: 1,
  });
  const catering = await ensureItem(eventType.id, {
    name: "Catering",
    description: "Dinner buffet and hospitality service.",
    category: "catering",
    displayOrder: 2,
  });
  const photography = await ensureItem(eventType.id, {
    name: "Photography",
    description: "Photo and video coverage.",
    category: "photography",
    displayOrder: 3,
  });
  const decoration = await ensureItem(eventType.id, {
    name: "Decoration",
    description: "Stage, floral, and table decoration.",
    category: "decoration",
    displayOrder: 4,
  });

  const venueBasic = await ensureVendorOption({
    eventItemId: venue.id,
    vendorId: venueVendor.id,
    optionName: "Garden Hall Basic",
    description: "Indoor hall for up to 120 guests.",
    price: 12000,
    images: ["https://images.unsplash.com/photo-1519167758481-83f550bb49b3"],
    isDefault: true,
  });
  const venuePremium = await ensureVendorOption({
    eventItemId: venue.id,
    vendorId: venueVendor.id,
    optionName: "Garden Hall Premium",
    description: "Indoor and outdoor hall for up to 250 guests.",
    price: 26000,
    images: ["https://images.unsplash.com/photo-1464366400600-7168b8af9bc3"],
  });
  const cateringBasic = await ensureVendorOption({
    eventItemId: catering.id,
    vendorId: cateringVendor.id,
    optionName: "Classic Dinner",
    description: "Buffet for 100 guests.",
    price: 9000,
    images: ["https://images.unsplash.com/photo-1555244162-803834f70033"],
    isDefault: true,
  });
  const cateringPremium = await ensureVendorOption({
    eventItemId: catering.id,
    vendorId: cateringVendor.id,
    optionName: "Premium Dinner",
    description: "Premium buffet and dessert stations for 180 guests.",
    price: 18000,
    images: ["https://images.unsplash.com/photo-1543353071-087092ec393a"],
  });
  const photoBasic = await ensureVendorOption({
    eventItemId: photography.id,
    vendorId: photoVendor.id,
    optionName: "Photo Coverage",
    description: "6 hours of photography coverage.",
    price: 5000,
    images: ["https://images.unsplash.com/photo-1511285560929-80b456fea0bc"],
    isDefault: true,
  });
  const photoPremium = await ensureVendorOption({
    eventItemId: photography.id,
    vendorId: photoVendor.id,
    optionName: "Photo and Cinema",
    description: "Full day photo and cinematic wedding film.",
    price: 11000,
    images: ["https://images.unsplash.com/photo-1529634806980-85c3dd6d34ac"],
  });
  const decorBasic = await ensureVendorOption({
    eventItemId: decoration.id,
    vendorId: decorVendor.id,
    optionName: "Classic Decor",
    description: "Stage flowers and table centerpieces.",
    price: 6500,
    images: ["https://images.unsplash.com/photo-1519225421980-715cb0215aed"],
    isDefault: true,
  });
  const decorPremium = await ensureVendorOption({
    eventItemId: decoration.id,
    vendorId: decorVendor.id,
    optionName: "Luxury Decor",
    description: "Luxury floral stage, aisle, and guest table design.",
    price: 14500,
    images: ["https://images.unsplash.com/photo-1469371670807-013ccf25f16a"],
  });

  const basicBundle = await ensureBundle({
    eventTypeId: eventType.id,
    name: "Basic Wedding Package",
    tier: BUNDLE_TIERS.CHEAP,
    description: "Essential wedding setup for intimate events.",
    displayOrder: 1,
  });
  const standardBundle = await ensureBundle({
    eventTypeId: eventType.id,
    name: "Standard Wedding Package",
    tier: BUNDLE_TIERS.MID,
    description: "Balanced package with upgraded food, photos, and decoration.",
    displayOrder: 2,
  });
  const premiumBundle = await ensureBundle({
    eventTypeId: eventType.id,
    name: "Premium Wedding Package",
    tier: BUNDLE_TIERS.HIGH,
    description: "Premium wedding experience with full-service vendors.",
    displayOrder: 3,
  });

  for (const [bundle, defaults] of [
    [basicBundle, [venueBasic, cateringBasic, photoBasic, decorBasic]],
    [standardBundle, [venueBasic, cateringPremium, photoPremium, decorBasic]],
    [premiumBundle, [venuePremium, cateringPremium, photoPremium, decorPremium]],
  ] as const) {
    await ensureBundleItem({ bundleId: bundle.id, eventItemId: venue.id, defaultOptionId: defaults[0].id, quantity: 1, displayOrder: 1 });
    await ensureBundleItem({ bundleId: bundle.id, eventItemId: catering.id, defaultOptionId: defaults[1].id, quantity: 1, displayOrder: 2 });
    await ensureBundleItem({ bundleId: bundle.id, eventItemId: photography.id, defaultOptionId: defaults[2].id, quantity: 1, displayOrder: 3 });
    await ensureBundleItem({ bundleId: bundle.id, eventItemId: decoration.id, defaultOptionId: defaults[3].id, quantity: 1, displayOrder: 4 });
  }

  console.log("Mobile seed data is ready.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => process.exit(0));
