import { pgTable, text, serial, integer, boolean, timestamp, doublePrecision, jsonb, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Enum-like constants
export const USER_TYPES = {
  CLIENT: 'client',
  VENDOR: 'vendor',
  ADMIN: 'admin',
} as const;

export const SERVICE_CATEGORIES = {
  VENUE: 'venue',
  CATERING: 'catering',
  PHOTOGRAPHY: 'photography',
  DECORATION: 'decoration',
  ENTERTAINMENT: 'entertainment',
  OTHER: 'other',
} as const;

export const EVENT_TYPES = {
  WEDDING: 'wedding',
  CORPORATE: 'corporate',
  BIRTHDAY: 'birthday',
  GRADUATION: 'graduation',
  SOCIAL: 'social',
  OTHER: 'other',
} as const;

export const BOOKING_STATUS = {
  PENDING: 'pending',
  VENDOR_REVIEW: 'vendor_review',
  VENDOR_APPROVED: 'vendor_approved',
  VENDOR_REJECTED: 'vendor_rejected',
  QUOTATION_SENT: 'quotation_sent',
  QUOTATION_ACCEPTED: 'quotation_accepted',
  QUOTATION_REJECTED: 'quotation_rejected',
  CONFIRMED: 'confirmed',
  IN_PROGRESS: 'in_progress',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
} as const;

export const PAYMENT_TYPES = {
  DEPOSIT: 'deposit',
  FINAL: 'final',
} as const;

export const PAYMENT_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  PAID: 'paid',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
} as const;

export const PROPOSAL_STATUS = {
  DRAFT: 'draft',
  SENT: 'sent',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
} as const;

export const BUNDLE_TIERS = {
  CHEAP: 'cheap',
  MID: 'mid',
  HIGH: 'high',
} as const;

export const ADMIN_PERMISSIONS = {
  MANAGE_USERS: 'manage_users',
  MANAGE_VENDORS: 'manage_vendors',
  MANAGE_BOOKINGS: 'manage_bookings',
  MANAGE_ADMINS: 'manage_admins',
  VIEW_ANALYTICS: 'view_analytics',
  MANAGE_SETTINGS: 'manage_settings',
} as const;

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  fullName: text("full_name"),
  phone: text("phone"),
  phoneVerifiedAt: timestamp("phone_verified_at"),
  userType: text("user_type").notNull(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

// OTP verification table for mobile phone authentication
export const otpVerifications = pgTable("otp_verifications", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull(),
  purpose: text("purpose").notNull(), // register, login
  codeHash: text("code_hash").notNull(),
  provider: text("provider"),
  providerMessageId: text("provider_message_id"),
  attempts: integer("attempts").default(0),
  maxAttempts: integer("max_attempts").default(5),
  expiresAt: timestamp("expires_at").notNull(),
  consumedAt: timestamp("consumed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Vendors table
export const vendors = pgTable("vendors", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  businessName: text("business_name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  address: text("address"),
  city: text("city"),
  priceRange: text("price_range"),
  rating: doublePrecision("rating"),
  reviewCount: integer("review_count").default(0),
  capacity: integer("capacity"),
  amenities: jsonb("amenities"),
  features: jsonb("features"),
  photos: jsonb("photos"),
  previousWork: jsonb("previous_work").$type<Array<{
    title: string;
    description?: string | null;
    url?: string | null;
    imageUrl?: string | null;
  }>>(),
  attachments: jsonb("attachments").$type<Array<{
    url: string;
    fileName?: string | null;
    contentType?: string | null;
    description?: string | null;
  }>>(),
});

// Services table
export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  vendorId: integer("vendor_id").notNull().references(() => vendors.id),
  name: text("name").notNull(),
  description: text("description"),
  price: doublePrecision("price"),
  duration: integer("duration"),
  isPackage: boolean("is_package").default(false),
});

// Bookings table (enhanced vendor-confirmed booking system)
export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => users.id),
  eventTypeId: integer("event_type_id").references(() => eventTypes.id),
  bundleId: integer("bundle_id").references(() => eventBundles.id),
  templateId: integer("template_id").references(() => eventTemplates.id),
  vendorId: integer("vendor_id").references(() => vendors.id),
  serviceId: integer("service_id").references(() => services.id),
  status: text("status").notNull().default(BOOKING_STATUS.PENDING),
  eventDate: timestamp("event_date").notNull(),
  eventTime: text("event_time"),
  location: text("location"),
  guestCount: integer("guest_count").notNull(),
  budget: doublePrecision("budget"),
  specialRequests: text("special_requests"),
  questionnaireResponses: jsonb("questionnaire_responses"),
  clientAttachments: jsonb("client_attachments").$type<Array<{
    url: string;
    fileName?: string | null;
    contentType?: string | null;
  }>>().default([]),
  selectedOptions: jsonb("selected_options"), // Bundle options selected by client
  notes: text("notes"),
  adminNotes: text("admin_notes"),
  vendorNotes: text("vendor_notes"),
  basePrice: doublePrecision("base_price"),
  optionsPrice: doublePrecision("options_price"),
  totalPrice: doublePrecision("total_price"),
  quotationNotes: text("quotation_notes"),
  quotationValidUntil: timestamp("quotation_valid_until"),
  vendorConfirmedAt: timestamp("vendor_confirmed_at"),
  confirmedBy: integer("confirmed_by").references(() => users.id),
  cancelledAt: timestamp("cancelled_at"),
  cancelledBy: integer("cancelled_by").references(() => users.id),
  cancellationReason: text("cancellation_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Messages table
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").notNull().references(() => users.id),
  receiverId: integer("receiver_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  read: boolean("read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Reviews table
export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => users.id),
  vendorId: integer("vendor_id").notNull().references(() => vendors.id),
  bookingId: integer("booking_id").references(() => bookings.id),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Admin Permissions table
export const adminPermissions = pgTable("admin_permissions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  permission: text("permission").notNull(),
  granted: boolean("granted").default(true),
  grantedBy: integer("granted_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Event Types table (managed by admin AND vendors)
export const eventTypes = pgTable("event_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon"),
  images: jsonb("images").$type<string[]>().default([]),
  videos: jsonb("videos").$type<string[]>().default([]),
  availableCities: jsonb("available_cities").$type<string[]>().default([]),
  category: text("category"), // wedding, corporate, birthday, etc.
  isActive: boolean("is_active").default(true),
  requiresApproval: boolean("requires_approval").default(false), // For vendor-created events
  approvedBy: integer("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  createdBy: integer("created_by").references(() => users.id),
  createdByType: text("created_by_type").notNull(), // admin, vendor
  vendorId: integer("vendor_id").references(() => vendors.id), // For vendor-created events
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Event templates are the mobile-facing visual offer cards.
// They can be backed by legacy event bundles during migration.
export const eventTemplates = pgTable("event_templates", {
  id: serial("id").primaryKey(),
  eventTypeId: integer("event_type_id").notNull().references(() => eventTypes.id),
  sourceBundleId: integer("source_bundle_id").references(() => eventBundles.id),
  name: text("name").notNull(),
  description: text("description"),
  estimatedMinPrice: doublePrecision("estimated_min_price"),
  estimatedMaxPrice: doublePrecision("estimated_max_price"),
  images: jsonb("images").$type<string[]>().default([]),
  videos: jsonb("videos").$type<string[]>().default([]),
  tags: jsonb("tags").$type<string[]>().default([]),
  isActive: boolean("is_active").default(true),
  displayOrder: integer("display_order").default(0),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Event Items table (admin-defined service items inside each event type)
export const eventItems = pgTable("event_items", {
  id: serial("id").primaryKey(),
  eventTypeId: integer("event_type_id").notNull().references(() => eventTypes.id),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"), // venue, catering, photography, etc.
  isRequired: boolean("is_required").default(true),
  displayOrder: integer("display_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const eventTemplateItems = pgTable("event_template_items", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id").notNull().references(() => eventTemplates.id),
  eventItemId: integer("event_item_id").references(() => eventItems.id),
  defaultOptionId: integer("default_option_id").references(() => itemVendorOptions.id),
  title: text("title").notNull(),
  description: text("description"),
  images: jsonb("images").$type<string[]>().default([]),
  videos: jsonb("videos").$type<string[]>().default([]),
  quantity: doublePrecision("quantity").notNull().default(1),
  isRequired: boolean("is_required").default(true),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Vendor options for a specific event item
export const itemVendorOptions = pgTable("item_vendor_options", {
  id: serial("id").primaryKey(),
  eventItemId: integer("event_item_id").notNull().references(() => eventItems.id),
  vendorId: integer("vendor_id").notNull().references(() => vendors.id),
  optionName: text("option_name").notNull(),
  description: text("description"),
  price: doublePrecision("price").notNull().default(0),
  images: jsonb("images").$type<string[]>().default([]),
  isDefault: boolean("is_default").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Questionnaire table (questions for each event type)
export const questionnaireItems = pgTable("questionnaire_items", {
  id: serial("id").primaryKey(),
  eventTypeId: integer("event_type_id").notNull().references(() => eventTypes.id),
  questionText: text("question_text").notNull(),
  questionType: text("question_type").notNull(), // text, textarea, single_choice, multiple_choice, checkbox, number, date
  options: jsonb("options"), // For choice questions, array of options
  required: boolean("required").default(false),
  displayOrder: integer("display_order"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const questionnaireOptions = pgTable("questionnaire_options", {
  id: serial("id").primaryKey(),
  questionnaireItemId: integer("questionnaire_item_id").notNull().references(() => questionnaireItems.id),
  labelAr: text("label_ar").notNull(),
  labelEn: text("label_en"),
  value: text("value").notNull(),
  imageUrl: text("image_url"),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Event Bundles table (flexible pricing tiers for events)
export const eventBundles = pgTable("event_bundles", {
  id: serial("id").primaryKey(),
  eventTypeId: integer("event_type_id").notNull().references(() => eventTypes.id),
  name: text("name").notNull(), // e.g., "Basic Package", "Premium Package"
  tier: text("tier").notNull(), // cheap, mid, high
  description: text("description"),
  basePrice: doublePrecision("base_price").notNull(),
  availableQuantity: integer("available_quantity").default(0),
  totalQuantity: integer("total_quantity").default(0),
  features: jsonb("features"), // Array of features included
  images: jsonb("images").$type<string[]>().default([]),
  videos: jsonb("videos").$type<string[]>().default([]),
  isActive: boolean("is_active").default(true),
  displayOrder: integer("display_order"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Bundle Options table (customizable add-ons for bundles)
export const bundleOptions = pgTable("bundle_options", {
  id: serial("id").primaryKey(),
  bundleId: integer("bundle_id").notNull().references(() => eventBundles.id),
  name: text("name").notNull(),
  description: text("description"),
  price: doublePrecision("price").default(0),
  isRequired: boolean("is_required").default(false),
  maxQuantity: integer("max_quantity").default(1),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Bundle Items table (which event items/options are included by default in each tier)
export const bundleItems = pgTable("bundle_items", {
  id: serial("id").primaryKey(),
  bundleId: integer("bundle_id").notNull().references(() => eventBundles.id),
  eventItemId: integer("event_item_id").notNull().references(() => eventItems.id),
  defaultOptionId: integer("default_option_id").references(() => itemVendorOptions.id),
  isIncluded: boolean("is_included").default(true),
  quantity: integer("quantity").default(1),
  priceOverride: doublePrecision("price_override"),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Booking Confirmations table (vendor approval tracking)
export const bookingConfirmations = pgTable("booking_confirmations", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").notNull().references(() => bookings.id),
  vendorId: integer("vendor_id").notNull().references(() => vendors.id),
  status: text("status").notNull(), // pending, approved, rejected
  notes: text("notes"),
  confirmedAt: timestamp("confirmed_at"),
  confirmedBy: integer("confirmed_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Pricing History table (track price changes and calculations)
export const pricingHistory = pgTable("pricing_history", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").notNull().references(() => bookings.id),
  bundleId: integer("bundle_id").references(() => eventBundles.id),
  basePrice: doublePrecision("base_price"),
  additionalOptions: jsonb("additional_options"),
  totalPrice: doublePrecision("total_price"),
  calculatedBy: integer("calculated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Payments table (provider-agnostic deposit/final payment tracking)
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").notNull().references(() => bookings.id),
  type: text("type").notNull(), // deposit, final
  amount: doublePrecision("amount").notNull(),
  status: text("status").notNull().default(PAYMENT_STATUS.PENDING),
  provider: text("provider"),
  providerPaymentId: text("provider_payment_id"),
  paymentUrl: text("payment_url"),
  receiptUrl: text("receipt_url"),
  receiptFileName: text("receipt_file_name"),
  receiptContentType: text("receipt_content_type"),
  receiptSubmittedAt: timestamp("receipt_submitted_at"),
  confirmedBy: integer("confirmed_by").references(() => users.id),
  dueDate: timestamp("due_date"),
  paidAt: timestamp("paid_at"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Booking proposals prepared by admins after reviewing the client request
export const bookingProposals = pgTable("booking_proposals", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").notNull().references(() => bookings.id),
  status: text("status").notNull().default(PROPOSAL_STATUS.DRAFT),
  totalPrice: doublePrecision("total_price").notNull(),
  depositAmount: doublePrecision("deposit_amount"),
  finalAmount: doublePrecision("final_amount"),
  notes: text("notes"),
  validUntil: timestamp("valid_until"),
  sentAt: timestamp("sent_at"),
  acceptedAt: timestamp("accepted_at"),
  rejectedAt: timestamp("rejected_at"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const bookingProposalItems = pgTable("booking_proposal_items", {
  id: serial("id").primaryKey(),
  proposalId: integer("proposal_id").notNull().references(() => bookingProposals.id),
  title: text("title").notNull(),
  description: text("description"),
  quantity: doublePrecision("quantity").notNull().default(1),
  unitPrice: doublePrecision("unit_price").notNull().default(0),
  totalPrice: doublePrecision("total_price").notNull().default(0),
  vendorId: integer("vendor_id").references(() => vendors.id),
  eventItemId: integer("event_item_id").references(() => eventItems.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const bookingStatusEvents = pgTable("booking_status_events", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").notNull().references(() => bookings.id),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  note: text("note"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const pushNotificationDevices = pgTable("push_notification_devices", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  token: text("token").notNull().unique(),
  provider: text("provider").notNull().default("expo"),
  platform: text("platform"),
  enabled: boolean("enabled").default(true),
  lastSeenAt: timestamp("last_seen_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Removed event requests and quotations tables - now using enhanced bookings table

// Zod schemas for validation
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  fullName: true,
  phone: true,
  phoneVerifiedAt: true,
  userType: true,
  avatarUrl: true,
});
export const insertOtpVerificationSchema = createInsertSchema(otpVerifications);

export const insertVendorSchema = createInsertSchema(vendors).pick({
  userId: true,
  businessName: true,
  category: true,
  description: true,
  address: true,
  city: true,
  priceRange: true,
  capacity: true,
  amenities: true,
  features: true,
  photos: true,
  previousWork: true,
  attachments: true,
});

export const insertServiceSchema = createInsertSchema(services);
export const insertBookingSchema = createInsertSchema(bookings);
export const insertMessageSchema = createInsertSchema(messages);
export const insertReviewSchema = createInsertSchema(reviews);
export const insertAdminPermissionSchema = createInsertSchema(adminPermissions);

// Event management schemas
export const insertEventTypeSchema = createInsertSchema(eventTypes);
export const insertEventTemplateSchema = createInsertSchema(eventTemplates);
export const insertEventTemplateItemSchema = createInsertSchema(eventTemplateItems);
export const insertEventItemSchema = createInsertSchema(eventItems);
export const insertItemVendorOptionSchema = createInsertSchema(itemVendorOptions);
export const insertQuestionnaireItemSchema = createInsertSchema(questionnaireItems);
export const insertQuestionnaireOptionSchema = createInsertSchema(questionnaireOptions);

// Enhanced bundle schemas
export const insertEventBundleSchema = createInsertSchema(eventBundles);
export const insertBundleOptionSchema = createInsertSchema(bundleOptions);
export const insertBundleItemSchema = createInsertSchema(bundleItems);
export const insertBookingConfirmationSchema = createInsertSchema(bookingConfirmations);
export const insertPricingHistorySchema = createInsertSchema(pricingHistory);
export const insertPaymentSchema = createInsertSchema(payments);
export const insertBookingProposalSchema = createInsertSchema(bookingProposals);
export const insertBookingProposalItemSchema = createInsertSchema(bookingProposalItems);
export const insertBookingStatusEventSchema = createInsertSchema(bookingStatusEvents);

// Relation definitions
export const usersRelations = relations(users, ({ many, one }) => ({
  vendor: one(vendors, { fields: [users.id], references: [vendors.userId] }),
  sentMessages: many(messages, { relationName: "sender" }),
  receivedMessages: many(messages, { relationName: "receiver" }),
  clientBookings: many(bookings, { relationName: "client" }),
  reviews: many(reviews, { relationName: "client" }),
  permissions: many(adminPermissions, { relationName: "user_permissions" }),
  grantedPermissions: many(adminPermissions, { relationName: "grantor" }),
  createdEventTypes: many(eventTypes),
  createdEventTemplates: many(eventTemplates),
  createdQuestionnaireItems: many(questionnaireItems),
  createdEventBundles: many(eventBundles),
  pushNotificationDevices: many(pushNotificationDevices),
}));

export const otpVerificationsRelations = relations(otpVerifications, () => ({}));

export const vendorsRelations = relations(vendors, ({ one, many }) => ({
  user: one(users, { fields: [vendors.userId], references: [users.id] }),
  services: many(services),
  bookings: many(bookings),
  reviews: many(reviews),
  eventTypes: many(eventTypes), // Vendor-created events
  itemVendorOptions: many(itemVendorOptions),
  bookingConfirmations: many(bookingConfirmations),
}));

export const servicesRelations = relations(services, ({ one, many }) => ({
  vendor: one(vendors, { fields: [services.vendorId], references: [vendors.id] }),
  bookings: many(bookings)
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  client: one(users, { fields: [bookings.clientId], references: [users.id] }),
  eventType: one(eventTypes, { fields: [bookings.eventTypeId], references: [eventTypes.id] }),
  bundle: one(eventBundles, { fields: [bookings.bundleId], references: [eventBundles.id] }),
  template: one(eventTemplates, { fields: [bookings.templateId], references: [eventTemplates.id] }),
  vendor: one(vendors, { fields: [bookings.vendorId], references: [vendors.id] }),
  service: one(services, { fields: [bookings.serviceId], references: [services.id] }),
  reviews: many(reviews),
  confirmations: many(bookingConfirmations),
  pricingHistory: many(pricingHistory),
  payments: many(payments),
  proposals: many(bookingProposals),
  statusEvents: many(bookingStatusEvents),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  sender: one(users, { fields: [messages.senderId], references: [users.id], relationName: "sender" }),
  receiver: one(users, { fields: [messages.receiverId], references: [users.id], relationName: "receiver" })
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  client: one(users, { fields: [reviews.clientId], references: [users.id], relationName: "client" }),
  vendor: one(vendors, { fields: [reviews.vendorId], references: [vendors.id] }),
  booking: one(bookings, { fields: [reviews.bookingId], references: [bookings.id] })
}));

// Event management relations
export const eventTypesRelations = relations(eventTypes, ({ one, many }) => ({
  creator: one(users, { fields: [eventTypes.createdBy], references: [users.id] }),
  vendor: one(vendors, { fields: [eventTypes.vendorId], references: [vendors.id] }),
  questionnaireItems: many(questionnaireItems),
  eventItems: many(eventItems),
  bundles: many(eventBundles),
  templates: many(eventTemplates),
  bookings: many(bookings)
}));

export const eventTemplatesRelations = relations(eventTemplates, ({ one, many }) => ({
  eventType: one(eventTypes, { fields: [eventTemplates.eventTypeId], references: [eventTypes.id] }),
  sourceBundle: one(eventBundles, { fields: [eventTemplates.sourceBundleId], references: [eventBundles.id] }),
  creator: one(users, { fields: [eventTemplates.createdBy], references: [users.id] }),
  items: many(eventTemplateItems),
  bookings: many(bookings),
}));

export const eventItemsRelations = relations(eventItems, ({ one, many }) => ({
  eventType: one(eventTypes, { fields: [eventItems.eventTypeId], references: [eventTypes.id] }),
  vendorOptions: many(itemVendorOptions),
  bundleItems: many(bundleItems),
  templateItems: many(eventTemplateItems),
}));

export const itemVendorOptionsRelations = relations(itemVendorOptions, ({ one, many }) => ({
  eventItem: one(eventItems, { fields: [itemVendorOptions.eventItemId], references: [eventItems.id] }),
  vendor: one(vendors, { fields: [itemVendorOptions.vendorId], references: [vendors.id] }),
  bundleDefaults: many(bundleItems),
  templateDefaults: many(eventTemplateItems),
}));

export const eventTemplateItemsRelations = relations(eventTemplateItems, ({ one }) => ({
  template: one(eventTemplates, { fields: [eventTemplateItems.templateId], references: [eventTemplates.id] }),
  eventItem: one(eventItems, { fields: [eventTemplateItems.eventItemId], references: [eventItems.id] }),
  defaultOption: one(itemVendorOptions, { fields: [eventTemplateItems.defaultOptionId], references: [itemVendorOptions.id] }),
}));

export const questionnaireItemsRelations = relations(questionnaireItems, ({ one, many }) => ({
  eventType: one(eventTypes, { fields: [questionnaireItems.eventTypeId], references: [eventTypes.id] }),
  creator: one(users, { fields: [questionnaireItems.createdBy], references: [users.id] }),
  options: many(questionnaireOptions),
}));

export const questionnaireOptionsRelations = relations(questionnaireOptions, ({ one }) => ({
  questionnaireItem: one(questionnaireItems, { fields: [questionnaireOptions.questionnaireItemId], references: [questionnaireItems.id] }),
}));

// Enhanced bundle relations
export const eventBundlesRelations = relations(eventBundles, ({ one, many }) => ({
  eventType: one(eventTypes, { fields: [eventBundles.eventTypeId], references: [eventTypes.id] }),
  creator: one(users, { fields: [eventBundles.createdBy], references: [users.id] }),
  options: many(bundleOptions),
  bundleItems: many(bundleItems),
  bookings: many(bookings),
}));

export const bundleOptionsRelations = relations(bundleOptions, ({ one }) => ({
  bundle: one(eventBundles, { fields: [bundleOptions.bundleId], references: [eventBundles.id] })
}));

export const bundleItemsRelations = relations(bundleItems, ({ one }) => ({
  bundle: one(eventBundles, { fields: [bundleItems.bundleId], references: [eventBundles.id] }),
  eventItem: one(eventItems, { fields: [bundleItems.eventItemId], references: [eventItems.id] }),
  defaultOption: one(itemVendorOptions, { fields: [bundleItems.defaultOptionId], references: [itemVendorOptions.id] }),
}));

export const bookingConfirmationsRelations = relations(bookingConfirmations, ({ one }) => ({
  booking: one(bookings, { fields: [bookingConfirmations.bookingId], references: [bookings.id] }),
  vendor: one(vendors, { fields: [bookingConfirmations.vendorId], references: [vendors.id] }),
  confirmedBy: one(users, { fields: [bookingConfirmations.confirmedBy], references: [users.id] })
}));

export const pricingHistoryRelations = relations(pricingHistory, ({ one }) => ({
  booking: one(bookings, { fields: [pricingHistory.bookingId], references: [bookings.id] }),
  bundle: one(eventBundles, { fields: [pricingHistory.bundleId], references: [eventBundles.id] }),
  calculatedBy: one(users, { fields: [pricingHistory.calculatedBy], references: [users.id] })
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  booking: one(bookings, { fields: [payments.bookingId], references: [bookings.id] }),
}));

export const bookingProposalsRelations = relations(bookingProposals, ({ one, many }) => ({
  booking: one(bookings, { fields: [bookingProposals.bookingId], references: [bookings.id] }),
  creator: one(users, { fields: [bookingProposals.createdBy], references: [users.id] }),
  items: many(bookingProposalItems),
}));

export const bookingProposalItemsRelations = relations(bookingProposalItems, ({ one }) => ({
  proposal: one(bookingProposals, { fields: [bookingProposalItems.proposalId], references: [bookingProposals.id] }),
  vendor: one(vendors, { fields: [bookingProposalItems.vendorId], references: [vendors.id] }),
  eventItem: one(eventItems, { fields: [bookingProposalItems.eventItemId], references: [eventItems.id] }),
}));

export const bookingStatusEventsRelations = relations(bookingStatusEvents, ({ one }) => ({
  booking: one(bookings, { fields: [bookingStatusEvents.bookingId], references: [bookings.id] }),
  creator: one(users, { fields: [bookingStatusEvents.createdBy], references: [users.id] }),
}));

export const pushNotificationDevicesRelations = relations(pushNotificationDevices, ({ one }) => ({
  user: one(users, { fields: [pushNotificationDevices.userId], references: [users.id] }),
}));

// Type exports
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type OtpVerification = typeof otpVerifications.$inferSelect;
export type InsertOtpVerification = z.infer<typeof insertOtpVerificationSchema>;

export type Vendor = typeof vendors.$inferSelect;
export type InsertVendor = typeof vendors.$inferInsert;

export type Service = typeof services.$inferSelect;
export type InsertService = z.infer<typeof insertServiceSchema>;

export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = z.infer<typeof insertBookingSchema>;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export type Review = typeof reviews.$inferSelect;
export type InsertReview = z.infer<typeof insertReviewSchema>;

export type AdminPermission = typeof adminPermissions.$inferSelect;
export type InsertAdminPermission = z.infer<typeof insertAdminPermissionSchema>;

// Event management types
export type EventType = typeof eventTypes.$inferSelect;
export type InsertEventType = z.infer<typeof insertEventTypeSchema>;

export type EventTemplate = typeof eventTemplates.$inferSelect;
export type InsertEventTemplate = z.infer<typeof insertEventTemplateSchema>;

export type EventTemplateItem = typeof eventTemplateItems.$inferSelect;
export type InsertEventTemplateItem = z.infer<typeof insertEventTemplateItemSchema>;

export type EventItem = typeof eventItems.$inferSelect;
export type InsertEventItem = z.infer<typeof insertEventItemSchema>;

export type ItemVendorOption = typeof itemVendorOptions.$inferSelect;
export type InsertItemVendorOption = z.infer<typeof insertItemVendorOptionSchema>;

export type QuestionnaireItem = typeof questionnaireItems.$inferSelect;
export type InsertQuestionnaireItem = z.infer<typeof insertQuestionnaireItemSchema>;

export type QuestionnaireOption = typeof questionnaireOptions.$inferSelect;
export type InsertQuestionnaireOption = z.infer<typeof insertQuestionnaireOptionSchema>;

// Enhanced bundle types
export type EventBundle = typeof eventBundles.$inferSelect;
export type InsertEventBundle = z.infer<typeof insertEventBundleSchema>;

export type BundleOption = typeof bundleOptions.$inferSelect;
export type InsertBundleOption = z.infer<typeof insertBundleOptionSchema>;

export type BundleItem = typeof bundleItems.$inferSelect;
export type InsertBundleItem = z.infer<typeof insertBundleItemSchema>;

export type BookingConfirmation = typeof bookingConfirmations.$inferSelect;
export type InsertBookingConfirmation = z.infer<typeof insertBookingConfirmationSchema>;

export type PricingHistory = typeof pricingHistory.$inferSelect;
export type InsertPricingHistory = z.infer<typeof insertPricingHistorySchema>;

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;

export type BookingProposal = typeof bookingProposals.$inferSelect;
export type InsertBookingProposal = z.infer<typeof insertBookingProposalSchema>;

export type BookingProposalItem = typeof bookingProposalItems.$inferSelect;
export type InsertBookingProposalItem = z.infer<typeof insertBookingProposalItemSchema>;

export type BookingStatusEvent = typeof bookingStatusEvents.$inferSelect;
export type InsertBookingStatusEvent = z.infer<typeof insertBookingStatusEventSchema>;

export type PushNotificationDevice = typeof pushNotificationDevices.$inferSelect;
