import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "crypto";
import { storage } from "./storage";
import { db } from "./db";
import { getMobileUserFromRequest, setupAuth } from "./auth";
import { mediaGateway } from "./gateways/media";
import { paymentGateway } from "./gateways/payment";
import { whatsappGateway } from "./gateways/whatsapp";
import { pushNotificationGateway } from "./gateways/push";
import { erpGateway } from "./gateways/erp";
import { 
  InsertVendor, InsertBooking, InsertMessage, InsertEventType, InsertQuestionnaireItem,
  InsertEventBundle, InsertBundleOption, InsertBookingConfirmation,
  BOOKING_STATUS, USER_TYPES, BUNDLE_TIERS, PAYMENT_STATUS, messages, users, User, EventBundle, BundleOption,
  bookings as bookingsTable, eventBundles as eventBundlesTable, pricingHistory as pricingHistoryTable,
  eventTypes as eventTypesTable, eventItems as eventItemsTable, itemVendorOptions as itemVendorOptionsTable,
  bundleItems as bundleItemsTable, vendors as vendorsTable, services as servicesTable, payments as paymentsTable,
  bookingConfirmations as bookingConfirmationsTable, reviews as reviewsTable,
  pushNotificationDevices as pushNotificationDevicesTable
} from "@shared/schema";
import { z } from "zod";
import { eq, or, and, gt, sql } from "drizzle-orm";

interface WSMessage {
  type: string;
  sender: number;
  receiver: number;
  receiverId?: number;
  content: string;
  timestamp: Date;
}

interface SocketConnection {
  userId: number;
  socket: WebSocket;
}

const selectedBundleOptionSchema = z.object({
  optionId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive().max(99).default(1),
});

const selectedEventItemOptionSchema = z.object({
  eventItemId: z.coerce.number().int().positive(),
  optionId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive().max(99).default(1),
});

const userProfileUpdateSchema = z.object({
  fullName: z.string().trim().min(1).max(160).optional(),
  email: z.string().trim().email().max(255).optional().nullable(),
  phone: z.string().trim().max(30).optional().nullable(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(120),
});

function withoutPassword(user: User) {
  const { password, ...safeUser } = user;
  return safeUser;
}

function normalizeSaudiPhone(rawPhone: unknown): string | null {
  if (typeof rawPhone !== "string" || !rawPhone.trim()) return null;

  const withoutChatSuffix = rawPhone.split("@")[0] || rawPhone;
  let digits = withoutChatSuffix.replace(/\D/g, "");
  if (!digits) return null;

  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("966")) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 10) return `+966${digits.slice(1)}`;
  if (digits.startsWith("5") && digits.length === 9) return `+966${digits}`;
  return `+${digits}`;
}

function phoneLookupCandidates(normalizedPhone: string): string[] {
  const digits = normalizedPhone.replace(/\D/g, "");
  const candidates = new Set<string>([normalizedPhone, digits]);

  if (digits.startsWith("966")) {
    candidates.add(digits.slice(3));
    candidates.add(`0${digits.slice(3)}`);
  }

  return Array.from(candidates);
}

async function findOrCreateWhatsappClient(normalizedPhone: string): Promise<User> {
  for (const candidate of phoneLookupCandidates(normalizedPhone)) {
    const user = await storage.getUserByPhone(candidate);
    if (user) return user;
  }

  const digits = normalizedPhone.replace(/\D/g, "");
  const baseUsername = `client_${digits}`;
  let username = baseUsername;
  let suffix = 1;

  while (await storage.getUserByUsername(username)) {
    suffix += 1;
    username = `${baseUsername}_${suffix}`;
  }

  return storage.createUser({
    username,
    password: randomUUID(),
    email: `${username}@whatsapp.saneea.local`,
    fullName: "WhatsApp Client",
    phone: normalizedPhone,
    phoneVerifiedAt: new Date(),
    userType: USER_TYPES.CLIENT,
    avatarUrl: null,
  });
}

function extractIncomingWhatsappMessage(payload: unknown): {
  from: string | null;
  body: string | null;
  providerMessageId: string | null;
  fromMe: boolean;
  type: string | null;
} {
  const root = payload && typeof payload === "object" ? payload as Record<string, any> : {};
  const data = root.data && typeof root.data === "object"
    ? root.data as Record<string, any>
    : root.message && typeof root.message === "object"
      ? root.message as Record<string, any>
      : root;

  const from = data.from || data.sender || data.author || data.chatId || root.from || root.sender || null;
  const body = data.body || data.text || data.message || data.caption || root.body || root.text || null;
  const providerMessageId = data.id || data.messageId || data.message_id || root.id || root.messageId || null;
  const fromMe = data.fromMe === true || data.fromMe === "true" || root.fromMe === true || root.fromMe === "true";
  const type = data.type || root.type || root.event_type || null;

  return {
    from: typeof from === "string" ? from : null,
    body: typeof body === "string" ? body.trim() : null,
    providerMessageId: providerMessageId ? String(providerMessageId) : null,
    fromMe,
    type: type ? String(type) : null,
  };
}

async function pickWhatsappAdminForClient(clientId: number): Promise<User | null> {
  const admins = await storage.getAdminUsers();
  if (admins.length === 0) return null;

  const configuredAdminId = Number(process.env.WHATSAPP_DEFAULT_ADMIN_ID || "");
  const configuredAdmin = Number.isInteger(configuredAdminId)
    ? admins.find((admin) => admin.id === configuredAdminId)
    : null;

  if (configuredAdmin) return configuredAdmin;

  return admins[0];
}

const clientAttachmentSchema = z.object({
  url: z.string().url(),
  fileName: z.string().min(1).max(180).optional().nullable(),
  contentType: z.string().min(3).max(120).optional().nullable(),
});

const bookingWithBundleSchema = z.object({
  eventTypeId: z.coerce.number().int().positive(),
  bundleId: z.coerce.number().int().positive().optional().nullable(),
  vendorId: z.coerce.number().int().positive().optional().nullable(),
  serviceId: z.coerce.number().int().positive().optional().nullable(),
  eventDate: z.coerce.date(),
  eventTime: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  guestCount: z.coerce.number().int().min(1),
  budget: z.coerce.number().min(0).optional().nullable(),
  specialRequests: z.string().optional().nullable(),
  clientAttachments: z.array(clientAttachmentSchema).default([]),
  questionnaireResponses: z.unknown().optional(),
  selectedOptions: z.array(selectedBundleOptionSchema).default([]),
  selectedItemOptions: z.array(selectedEventItemOptionSchema).default([]),
});

const imageUploadIntentSchema = z.object({
  folder: z.string().min(1).max(120).default("saneea/media"),
  filename: z.string().min(1).max(180),
  contentType: z.string().regex(/^(image\/(png|jpe?g|webp|gif)|video\/(mp4|mpeg|quicktime|webm)|application\/pdf)$/i),
});

const paymentReceiptSchema = z.object({
  receiptUrl: z.string().url(),
  receiptFileName: z.string().min(1).max(180).optional().nullable(),
  receiptContentType: z.string().min(3).max(120).optional().nullable(),
});

const eventItemSchema = z.object({
  name: z.string().min(1).max(160),
  description: z.string().max(2000).optional().nullable(),
  category: z.string().max(80).optional().nullable(),
  isRequired: z.boolean().optional().default(true),
  displayOrder: z.coerce.number().int().optional().default(0),
  isActive: z.boolean().optional().default(true),
});

const itemVendorOptionSchema = z.object({
  vendorId: z.coerce.number().int().positive(),
  optionName: z.string().min(1).max(160),
  description: z.string().max(2000).optional().nullable(),
  price: z.coerce.number().min(0),
  images: z.array(z.string()).default([]),
  isDefault: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
});

const bundleItemSchema = z.object({
  eventItemId: z.coerce.number().int().positive(),
  defaultOptionId: z.coerce.number().int().positive().optional().nullable(),
  isIncluded: z.boolean().optional().default(true),
  quantity: z.coerce.number().int().positive().default(1),
  priceOverride: z.coerce.number().min(0).optional().nullable(),
  displayOrder: z.coerce.number().int().optional().default(0),
});

const paymentCreateSchema = z.object({
  type: z.enum(["deposit", "final"]),
  amount: z.coerce.number().positive(),
  dueDate: z.coerce.date().optional().nullable(),
  currency: z.string().min(3).max(3).default("SAR"),
});

const whatsappSendSchema = z.object({
  to: z.string().min(5).max(30),
  body: z.string().min(1).max(4000),
  context: z.record(z.unknown()).optional(),
});

const pushDeviceSchema = z.object({
  token: z.string().min(10).max(500),
  provider: z.string().min(2).max(40).default("expo"),
  platform: z.string().min(2).max(40).optional().nullable(),
});

const pushSendSchema = z.object({
  userId: z.coerce.number().int().positive(),
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(500),
  data: z.record(z.unknown()).optional(),
});

const bookingMessageTemplateSchema = z.object({
  template: z.enum([
    "booking_received",
    "booking_confirmed",
    "booking_cancelled",
    "payment_request",
    "deposit_request",
    "payment_confirmed",
  ]),
  paymentId: z.coerce.number().int().positive().optional(),
});

const mobileBookingSchema = z.object({
  eventTypeId: z.coerce.number().int().positive(),
  bundleId: z.coerce.number().int().positive().optional().nullable(),
  eventDate: z.coerce.date(),
  eventTime: z.string().optional().nullable(),
  location: z.string().min(1),
  guestCount: z.coerce.number().int().min(1),
  budget: z.coerce.number().min(0).optional().nullable(),
  specialRequests: z.string().optional().nullable(),
  clientAttachments: z.array(clientAttachmentSchema).default([]),
  questionnaireResponses: z.record(z.unknown()).optional().default({}),
  selectedItemOptions: z.array(selectedEventItemOptionSchema).default([]),
});

const createReviewSchema = z.object({
  vendorId: z.coerce.number().int().positive(),
  bookingId: z.coerce.number().int().positive(),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().max(2000).optional().nullable(),
});

const bookingStatusFlow: Record<string, string[]> = {
  [BOOKING_STATUS.PENDING]: [
    BOOKING_STATUS.VENDOR_REVIEW,
    BOOKING_STATUS.CONFIRMED,
    BOOKING_STATUS.CANCELLED,
  ],
  [BOOKING_STATUS.VENDOR_REVIEW]: [
    BOOKING_STATUS.VENDOR_APPROVED,
    BOOKING_STATUS.VENDOR_REJECTED,
    BOOKING_STATUS.CANCELLED,
  ],
  [BOOKING_STATUS.VENDOR_APPROVED]: [
    BOOKING_STATUS.QUOTATION_SENT,
    BOOKING_STATUS.CONFIRMED,
    BOOKING_STATUS.CANCELLED,
  ],
  [BOOKING_STATUS.VENDOR_REJECTED]: [BOOKING_STATUS.CANCELLED],
  [BOOKING_STATUS.QUOTATION_SENT]: [
    BOOKING_STATUS.QUOTATION_ACCEPTED,
    BOOKING_STATUS.QUOTATION_REJECTED,
    BOOKING_STATUS.CANCELLED,
  ],
  [BOOKING_STATUS.QUOTATION_ACCEPTED]: [
    BOOKING_STATUS.CONFIRMED,
    BOOKING_STATUS.CANCELLED,
  ],
  [BOOKING_STATUS.QUOTATION_REJECTED]: [BOOKING_STATUS.CANCELLED],
  [BOOKING_STATUS.CONFIRMED]: [
    BOOKING_STATUS.IN_PROGRESS,
    BOOKING_STATUS.CANCELLED,
    BOOKING_STATUS.COMPLETED,
  ],
  [BOOKING_STATUS.IN_PROGRESS]: [
    BOOKING_STATUS.COMPLETED,
    BOOKING_STATUS.CANCELLED,
  ],
  [BOOKING_STATUS.COMPLETED]: [],
  [BOOKING_STATUS.CANCELLED]: [],
};

function canTransitionBookingStatus(fromStatus: string, toStatus: string) {
  if (fromStatus === toStatus) return true;
  return (bookingStatusFlow[fromStatus] || []).includes(toStatus);
}

type MobileSelectedOptionsShape = {
  itemOptions?: Array<{
    eventItemId: number;
    optionId: number;
    quantity?: number;
  }>;
};

function parseMobileSelectedItemOptions(selectedOptions: unknown) {
  if (!selectedOptions || typeof selectedOptions !== "object") return [];
  const maybeOptions = (selectedOptions as MobileSelectedOptionsShape).itemOptions;
  return Array.isArray(maybeOptions) ? maybeOptions : [];
}

function normalizeStartOfDay(date: Date) {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function formatSaudiDate(date: unknown) {
  if (!date) return "غير محدد";
  const parsed = new Date(date as string | Date);
  if (isNaN(parsed.getTime())) return "غير محدد";
  return parsed.toLocaleDateString("ar-SA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatSar(amount: unknown) {
  const value = Number(amount || 0);
  return `${value.toLocaleString("ar-SA")} ريال`;
}

async function requireMobileClient(req: any, res: any) {
  const user = await getMobileUserFromRequest(req);
  if (!user) {
    res.status(401).json({ message: 'Not authenticated' });
    return null;
  }
  if (user.userType !== USER_TYPES.CLIENT) {
    res.status(403).json({ message: 'Client account required' });
    return null;
  }
  req.user = user;
  return user;
}

// Admin authentication middleware
const requireAdmin = async (req: any, res: any, next: any) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  
  const hasPermission = await storage.checkAdminPermission(req.user.id, 'manage_event_types');
  if (!hasPermission) {
    return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
  }
  
  next();
};

export async function registerRoutes(app: Express): Promise<Server> {
  const connections: SocketConnection[] = [];

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0'
    });
  });

  // Set up JWT authentication before protected routes
  setupAuth(app);

  async function sendAdminClientMessage(input: {
    adminId?: number;
    clientId: number;
    content: string;
    context?: Record<string, unknown>;
  }) {
    const client = await storage.getUser(input.clientId);
    if (!client || client.userType !== USER_TYPES.CLIENT) {
      throw new Error("Client not found");
    }

    const admin = input.adminId
      ? await storage.getUser(input.adminId)
      : await pickWhatsappAdminForClient(client.id);

    if (!admin || admin.userType !== USER_TYPES.ADMIN) {
      throw new Error("Admin sender not found");
    }

    const message = await storage.createMessage({
      senderId: admin.id,
      receiverId: client.id,
      content: input.content,
      read: false,
      createdAt: new Date(),
    });

    if (client.phone) {
      try {
        await whatsappGateway.sendMessage({
          to: client.phone,
          body: input.content,
          context: {
            source: "message_template",
            messageId: message.id,
            senderId: admin.id,
            receiverId: client.id,
            ...input.context,
          },
        });
      } catch (error) {
        console.error("WhatsApp template send failed:", error);
      }
    }

    const recipientConnection = connections.find(conn => conn.userId === client.id);
    if (recipientConnection && recipientConnection.socket.readyState === WebSocket.OPEN) {
      recipientConnection.socket.send(JSON.stringify({
        type: "message",
        sender: admin.id,
        senderId: admin.id,
        receiver: client.id,
        receiverId: client.id,
        content: input.content,
        id: message.id,
        timestamp: message.createdAt,
      }));
    }

    return message;
  }

  async function buildBookingTemplate(input: {
    bookingId: number;
    template: "booking_received" | "booking_confirmed" | "booking_cancelled" | "payment_request" | "deposit_request" | "payment_confirmed";
    payment?: {
      id?: number;
      type?: string | null;
      amount?: number | null;
      dueDate?: Date | string | null;
      paymentUrl?: string | null;
    } | null;
  }) {
    const [row] = await db
      .select({
        booking: bookingsTable,
        client: users,
        eventTypeName: eventTypesTable.name,
        bundleName: eventBundlesTable.name,
      })
      .from(bookingsTable)
      .leftJoin(users, eq(bookingsTable.clientId, users.id))
      .leftJoin(eventTypesTable, eq(bookingsTable.eventTypeId, eventTypesTable.id))
      .leftJoin(eventBundlesTable, eq(bookingsTable.bundleId, eventBundlesTable.id))
      .where(eq(bookingsTable.id, input.bookingId));

    if (!row?.booking || !row.client) {
      throw new Error("Booking not found for template");
    }

    const name = row.client.fullName || row.client.username || "عميلنا";
    const eventName = row.eventTypeName || "الفعالية";
    const packageName = row.bundleName || "الباقة المختارة";
    const date = formatSaudiDate(row.booking.eventDate);
    const bookingNo = `#${row.booking.id}`;
    const total = formatSar(row.booking.totalPrice);
    const paymentAmount = formatSar(input.payment?.amount);
    const paymentDue = input.payment?.dueDate ? `\nتاريخ الاستحقاق: ${formatSaudiDate(input.payment.dueDate)}` : "";
    const paymentUrl = input.payment?.paymentUrl ? `\nرابط الدفع: ${input.payment.paymentUrl}` : "";

    const templates = {
      booking_received: `أهلًا ${name}، وصلنا طلبك ${bookingNo} لفعالية ${eventName} (${packageName}) بتاريخ ${date}.\nفريق سنّيع بيراجع التفاصيل ونتواصل معك قريبًا.`,
      booking_confirmed: `تم تأكيد حجزك ${bookingNo} 🎉\nالفعالية: ${eventName}\nالباقة: ${packageName}\nالتاريخ: ${date}\nالإجمالي: ${total}\nفريق سنّيع معك خطوة بخطوة.`,
      booking_cancelled: `تم إلغاء حجزك ${bookingNo}.\nإذا كان الإلغاء غير مقصود أو تحتاج تعديل الموعد، رد على هذه الرسالة وراح نساعدك.`,
      payment_request: `أهلًا ${name}، تم إصدار طلب دفع للحجز ${bookingNo}.\nالمبلغ: ${paymentAmount}${paymentDue}${paymentUrl}\nبعد الدفع، يمكنك رفع الإيصال من التطبيق أو إرساله هنا.`,
      deposit_request: `أهلًا ${name}، لتأكيد الحجز ${bookingNo} نحتاج دفعة عربون.\nمبلغ العربون: ${paymentAmount}${paymentDue}${paymentUrl}\nبعد الدفع، ارفع الإيصال من التطبيق أو أرسله هنا.`,
      payment_confirmed: `تم تأكيد استلام الدفعة للحجز ${bookingNo} ✅\nالمبلغ: ${paymentAmount}\nشكرًا لك، وفريق سنّيع مستمر معك في تجهيز المناسبة.`,
    } satisfies Record<string, string>;

    return {
      clientId: row.client.id,
      content: templates[input.template],
    };
  }

  async function sendBookingTemplate(input: {
    bookingId: number;
    template: "booking_received" | "booking_confirmed" | "booking_cancelled" | "payment_request" | "deposit_request" | "payment_confirmed";
    adminId?: number;
    payment?: {
      id?: number;
      type?: string | null;
      amount?: number | null;
      dueDate?: Date | string | null;
      paymentUrl?: string | null;
    } | null;
  }) {
    const template = await buildBookingTemplate(input);
    return sendAdminClientMessage({
      adminId: input.adminId,
      clientId: template.clientId,
      content: template.content,
      context: {
        bookingId: input.bookingId,
        template: input.template,
        paymentId: input.payment?.id,
      },
    });
  }

  function customerExternalId(userId: number) {
    return `user_${userId}`;
  }

  function bookingExternalId(bookingId: number) {
    return `booking_${bookingId}`;
  }

  function invoiceExternalId(bookingId: number) {
    return `invoice_booking_${bookingId}`;
  }

  function paymentExternalId(paymentId: number) {
    return `payment_${paymentId}`;
  }

  async function syncCustomerToErp(client: User, context: Record<string, unknown> = {}) {
    const result = await erpGateway.upsertCustomer({
      externalId: customerExternalId(client.id),
      name: client.fullName || client.username,
      mobile: client.phone,
      email: client.email,
      metadata: {
        source: "saneea",
        userId: client.id,
        username: client.username,
        userType: client.userType,
        createdAt: client.createdAt,
        ...context,
      },
    });

    if (result.status === "failed") {
      console.error("ERP customer sync failed:", result);
    }
    return result;
  }

  async function syncBookingToErp(bookingId: number, eventName?: string | null, packageName?: string | null) {
    const [row] = await db
      .select({
        booking: bookingsTable,
        client: users,
        eventTypeName: eventTypesTable.name,
        bundleName: eventBundlesTable.name,
      })
      .from(bookingsTable)
      .leftJoin(users, eq(bookingsTable.clientId, users.id))
      .leftJoin(eventTypesTable, eq(bookingsTable.eventTypeId, eventTypesTable.id))
      .leftJoin(eventBundlesTable, eq(bookingsTable.bundleId, eventBundlesTable.id))
      .where(eq(bookingsTable.id, bookingId));

    if (!row?.booking || !row.client) return;

    const resolvedEventName = eventName || row.eventTypeName || "Event";
    const resolvedPackageName = packageName || row.bundleName || "Package";

    await syncCustomerToErp(row.client, { sourceAction: "booking_created", bookingId });

    const leadResult = await erpGateway.createLead({
      externalId: bookingExternalId(bookingId),
      name: row.client.fullName || row.client.username,
      mobile: row.client.phone,
      email: row.client.email,
      source: "saneea_booking",
      metadata: {
        bookingId,
        eventTypeId: row.booking.eventTypeId,
        eventName: resolvedEventName,
        bundleId: row.booking.bundleId,
        packageName: resolvedPackageName,
        status: row.booking.status,
        eventDate: row.booking.eventDate,
        eventTime: row.booking.eventTime,
        location: row.booking.location,
        guestCount: row.booking.guestCount,
        budget: row.booking.budget,
        totalPrice: row.booking.totalPrice,
        questionnaireResponses: row.booking.questionnaireResponses,
        clientAttachments: row.booking.clientAttachments,
      },
    });

    if (leadResult.status === "failed") {
      console.error("ERP booking lead sync failed:", leadResult);
    }

    if ((row.booking.totalPrice || 0) > 0) {
      const invoiceResult = await erpGateway.createInvoice({
        externalId: invoiceExternalId(bookingId),
        customerExternalId: customerExternalId(row.client.id),
        amount: row.booking.totalPrice || 0,
        currency: "SAR",
        description: `Saneea booking #${bookingId} - ${resolvedEventName} (${resolvedPackageName})`,
        metadata: {
          bookingId,
          eventName: resolvedEventName,
          packageName: resolvedPackageName,
          status: row.booking.status,
        },
      });

      if (invoiceResult.status === "failed") {
        console.error("ERP booking invoice sync failed:", invoiceResult);
      }
    }

    const activityResult = await erpGateway.postActivity({
      externalId: `activity_booking_created_${bookingId}`,
      eventType: "saneea.booking.created",
      title: `Saneea booking #${bookingId}`,
      description: `${resolvedEventName} booking created for ${row.client.fullName || row.client.username}`,
      metadata: {
        bookingId,
        customerExternalId: customerExternalId(row.client.id),
        invoiceExternalId: invoiceExternalId(bookingId),
      },
    });

    if (activityResult.status === "failed") {
      console.error("ERP booking activity sync failed:", activityResult);
    }
  }

  async function syncBookingStatusToErp(bookingId: number, status: string) {
    const result = await erpGateway.postActivity({
      externalId: `activity_booking_status_${bookingId}_${status}`,
      eventType: "saneea.booking.status_changed",
      title: `Booking #${bookingId} status changed`,
      description: `Booking #${bookingId} status changed to ${status}`,
      metadata: {
        bookingId,
        status,
      },
    });

    if (result.status === "failed") {
      console.error("ERP booking status sync failed:", result);
    }
  }

  async function syncPaymentToErp(payment: {
    id: number;
    bookingId: number;
    amount: number;
    type?: string | null;
    status?: string | null;
    provider?: string | null;
    providerPaymentId?: string | null;
    receiptUrl?: string | null;
    paidAt?: Date | string | null;
    metadata?: unknown;
  }) {
    const result = await erpGateway.createPayment({
      externalId: paymentExternalId(payment.id),
      invoiceExternalId: invoiceExternalId(payment.bookingId),
      amount: payment.amount,
      currency: "SAR",
      method: payment.provider || "online",
      paidAt: payment.paidAt ? new Date(payment.paidAt).toISOString() : undefined,
      metadata: {
        bookingId: payment.bookingId,
        paymentId: payment.id,
        type: payment.type,
        status: payment.status,
        provider: payment.provider,
        providerPaymentId: payment.providerPaymentId,
        receiptUrl: payment.receiptUrl,
        metadata: payment.metadata,
      },
    });

    if (result.status === "failed") {
      console.error("ERP payment sync failed:", result);
    }
    return result;
  }

  app.get('/api/admin/integrations/erp/hal/ping', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: 'Not authenticated' });
    if (req.user.userType !== USER_TYPES.ADMIN) return res.status(403).json({ message: 'Admin access required' });

    try {
      const [auth, tenant] = await Promise.all([
        erpGateway.ping(),
        erpGateway.verifyTenant(),
      ]);
      res.json({ auth, tenant });
    } catch (error: any) {
      console.error("HAL ERP ping failed:", error);
      res.status(500).json({ message: error?.message || "HAL ERP ping failed" });
    }
  });

  // Analytics endpoint for admin dashboard
  app.get('/api/admin/analytics', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    const hasPermission = await storage.checkAdminPermission(req.user.id, 'manage_event_types');
    if (!hasPermission) {
      return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
    }

    try {
      const bookings = await storage.getAllBookings();
      const users = await storage.getAllUsers();
      
      // Calculate key metrics
      const totalBookings = bookings.length;
      const totalUsers = users.length;
      const totalRevenue = bookings.reduce((sum, booking) => {
        // Use totalPrice from new booking structure
        const amount = booking.totalPrice || 0;
        return sum + amount;
      }, 0);
      const averageBookingValue = totalBookings > 0 ? totalRevenue / totalBookings : 0;
      
      // Booking status distribution
      const statusCounts = bookings.reduce((acc, booking) => {
        acc[booking.status] = (acc[booking.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const statusColors = {
        pending: '#FFBB28',
        confirmed: '#00C49F', 
        completed: '#0088FE',
        cancelled: '#FF8042'
      };
      
      const bookingsByStatus = Object.entries(statusCounts).map(([status, count]) => ({
        status: status.charAt(0).toUpperCase() + status.slice(1),
        count,
        color: statusColors[status as keyof typeof statusColors] || '#8884D8'
      }));
      
      // Monthly bookings (last 6 months)
      const monthlyData = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthStr = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        
        const monthBookings = bookings.filter(booking => {
          if (!booking.createdAt) return false;
          const bookingDate = new Date(booking.createdAt);
          return bookingDate.getMonth() === date.getMonth() && 
                 bookingDate.getFullYear() === date.getFullYear();
        });
        
        const monthRevenue = monthBookings.reduce((sum, booking) => {
          const amount = booking.totalPrice || 0;
          return sum + amount;
        }, 0);
        
        monthlyData.push({
          month: monthStr,
          bookings: monthBookings.length,
          revenue: monthRevenue
        });
      }
      
      // Top event types - simplified to avoid type errors
      const eventTypeMap = new Map<string, number>();
      bookings.forEach(booking => {
        const typeName = 'Event'; // Simplified for now
        eventTypeMap.set(typeName, (eventTypeMap.get(typeName) || 0) + 1);
      });
      
      const topEventTypes = Array.from(eventTypeMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      
      // Recent activity - simplified
      const recentActivity = [
        ...bookings.slice(-5).map(booking => ({
          type: 'booking',
          description: `New booking created`,
          timestamp: booking.createdAt || new Date().toISOString()
        })),
        ...users.slice(-3).map(user => ({
          type: 'user',
          description: `New user registered: ${user.username}`,
          timestamp: user.createdAt || new Date().toISOString()
        }))
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 8);
      
      const analyticsData = {
        totalBookings,
        totalRevenue,
        totalUsers,
        averageBookingValue: Math.round(averageBookingValue * 100) / 100,
        bookingsByStatus,
        bookingsByMonth: monthlyData,
        topEventTypes,
        recentActivity
      };
      
      res.json(analyticsData);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      res.status(500).json({ message: 'Error fetching analytics data' });
    }
  });

  // Add test endpoints for debugging
  app.get('/api/test', (req, res) => {
    res.json({ 
      message: 'API is working!',
      authenticated: req.isAuthenticated(),
      session: req.session,
      user: req.user ? { 
        id: req.user.id, 
        username: req.user.username,
        userType: req.user.userType
      } : null
    });
  });
  
  // Debug endpoint for checking authentication
  app.get('/api/auth-status', (req, res) => {
    res.json({
      authenticated: req.isAuthenticated(),
      session: req.session,
      sessionID: req.sessionID,
      user: req.user ? { 
        id: req.user.id, 
        username: req.user.username,
        userType: req.user.userType
      } : null
    });
  });
  
  // Event Type routes
  app.get('/api/event-types', async (req, res) => {
    try {
      if (!req.isAuthenticated() || req.user.userType === USER_TYPES.CLIENT) {
        const activeEventTypes = await storage.getActiveEventTypes();
        return res.json(activeEventTypes);
      }

      const eventTypes = await storage.getAllEventTypes();
      res.json(eventTypes);
    } catch (error) {
      console.error('Error fetching event types:', error);
      res.status(500).json({ message: 'Failed to fetch event types' });
    }
  });
  
  app.get('/api/event-types/active', async (req, res) => {
    try {
      const eventTypes = await storage.getActiveEventTypes();
      res.json(eventTypes);
    } catch (error) {
      console.error('Error fetching active event types:', error);
      res.status(500).json({ message: 'Failed to fetch active event types' });
    }
  });
  
  app.get('/api/event-types/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid event type ID' });
      }
      
      const eventType = await storage.getEventType(id);
      if (!eventType) {
        return res.status(404).json({ message: 'Event type not found' });
      }
      if ((!req.isAuthenticated() || req.user.userType !== USER_TYPES.ADMIN) && !eventType.isActive) {
        return res.status(404).json({ message: 'Event type not found' });
      }
      
      res.json(eventType);
    } catch (error) {
      console.error('Error fetching event type:', error);
      res.status(500).json({ message: 'Failed to fetch event type' });
    }
  });

  // Get questionnaire items for an event type
  app.get('/api/event-types/:id/questionnaire-items', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid event type ID' });
      }
      
      const questionnaireItems = await storage.getQuestionnaireItemsByEventType(id);
      res.json(questionnaireItems);
    } catch (error) {
      console.error('Error fetching questionnaire items:', error);
      res.status(500).json({ message: 'Failed to fetch questionnaire items' });
    }
  });
  
  app.post('/api/event-types', async (req, res) => {
    // Only admin can create event types
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    const hasPermission = await storage.checkAdminPermission(req.user.id, 'manage_event_types');
    if (!hasPermission) {
      return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
    }
    
    try {
      const eventTypeData: InsertEventType = {
        name: req.body.name,
        description: req.body.description,
        icon: req.body.icon,
        images: Array.isArray(req.body.images) ? req.body.images : [],
        videos: Array.isArray(req.body.videos) ? req.body.videos : [],
        category: req.body.category,
        isActive: req.body.isActive ?? true,
        createdByType: 'admin',
      };
      
      const eventType = await storage.createEventType(eventTypeData);
      res.status(201).json(eventType);
    } catch (error) {
      console.error('Error creating event type:', error);
      res.status(500).json({ message: 'Failed to create event type' });
    }
  });
  
  app.patch('/api/event-types/:id', async (req, res) => {
    // Only admin can update event types
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    const hasPermission = await storage.checkAdminPermission(req.user.id, 'manage_event_types');
    if (!hasPermission) {
      return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
    }
    
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid event type ID' });
      }
      
      const eventType = await storage.updateEventType(id, req.body);
      if (!eventType) {
        return res.status(404).json({ message: 'Event type not found' });
      }
      
      res.json(eventType);
    } catch (error) {
      console.error('Error updating event type:', error);
      res.status(500).json({ message: 'Failed to update event type' });
    }
  });
  
  app.delete('/api/event-types/:id', async (req, res) => {
    // Only admin can delete event types
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    const hasPermission = await storage.checkAdminPermission(req.user.id, 'manage_event_types');
    if (!hasPermission) {
      return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
    }
    
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid event type ID' });
      }
      
      await storage.deleteEventType(id);
      res.status(200).json({ message: 'Event type deleted successfully' });
    } catch (error) {
      console.error('Error deleting event type:', error);
      res.status(500).json({ message: 'Failed to delete event type' });
    }
  });
  
  // Questionnaire Item routes
  app.get('/api/questionnaire-items', async (req, res) => {
    try {
      // You'd need to add a method to get all questionnaire items
      // This is an admin function, so we could add permissions check here
      const questionnaireItems = await db.query.questionnaireItems.findMany();
      res.json(questionnaireItems);
    } catch (error) {
      console.error('Error fetching questionnaire items:', error);
      res.status(500).json({ message: 'Failed to fetch questionnaire items' });
    }
  });
  
  app.get('/api/event-types/:eventTypeId/questions', async (req, res) => {
    try {
      const eventTypeId = parseInt(req.params.eventTypeId);
      if (isNaN(eventTypeId)) {
        return res.status(400).json({ message: 'Invalid event type ID' });
      }
      const eventType = await storage.getEventType(eventTypeId);
      if (!eventType) {
        return res.status(404).json({ message: 'Event type not found' });
      }
      if ((!req.isAuthenticated() || req.user.userType !== USER_TYPES.ADMIN) && !eventType.isActive) {
        return res.status(404).json({ message: 'Event type not found' });
      }
      
      const questions = await storage.getQuestionnaireItemsByEventType(eventTypeId);
      res.json(questions);
    } catch (error) {
      console.error('Error fetching questions for event type:', error);
      res.status(500).json({ message: 'Failed to fetch questions' });
    }
  });

  // Mobile app endpoint for questionnaire items
  app.get('/api/event-types/:eventTypeId/questionnaire-items', async (req, res) => {
    try {
      const eventTypeId = parseInt(req.params.eventTypeId);
      if (isNaN(eventTypeId)) {
        return res.status(400).json({ message: 'Invalid event type ID' });
      }
      
      const questions = await storage.getQuestionnaireItemsByEventType(eventTypeId);
      res.json(questions);
    } catch (error) {
      console.error('Error fetching questionnaire items for event type:', error);
      res.status(500).json({ message: 'Failed to fetch questionnaire items' });
    }
  });
  
  app.post('/api/questionnaire-items', async (req, res) => {
    // Only admin can create questionnaire items
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    const hasPermission = await storage.checkAdminPermission(req.user.id, 'manage_event_types');
    if (!hasPermission) {
      return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
    }
    
    try {
      const questionnaireItemData: InsertQuestionnaireItem = {
        eventTypeId: req.body.eventTypeId,
        questionText: req.body.questionText,
        questionType: req.body.questionType,
        options: req.body.options,
        required: req.body.required ?? false,
        displayOrder: req.body.displayOrder,
      };
      
      const questionnaireItem = await storage.createQuestionnaireItem(questionnaireItemData);
      res.status(201).json(questionnaireItem);
    } catch (error) {
      console.error('Error creating questionnaire item:', error);
      res.status(500).json({ message: 'Failed to create questionnaire item' });
    }
  });
  
  app.patch('/api/questionnaire-items/:id', async (req, res) => {
    // Only admin can update questionnaire items
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    const hasPermission = await storage.checkAdminPermission(req.user.id, 'manage_event_types');
    if (!hasPermission) {
      return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
    }
    
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid questionnaire item ID' });
      }
      
      const questionnaireItem = await storage.updateQuestionnaireItem(id, req.body);
      if (!questionnaireItem) {
        return res.status(404).json({ message: 'Questionnaire item not found' });
      }
      
      res.json(questionnaireItem);
    } catch (error) {
      console.error('Error updating questionnaire item:', error);
      res.status(500).json({ message: 'Failed to update questionnaire item' });
    }
  });
  
  app.delete('/api/questionnaire-items/:id', async (req, res) => {
    // Only admin can delete questionnaire items
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    const hasPermission = await storage.checkAdminPermission(req.user.id, 'manage_event_types');
    if (!hasPermission) {
      return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
    }
    
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid questionnaire item ID' });
      }
      
      await storage.deleteQuestionnaireItem(id);
      res.status(204).end();
    } catch (error) {
      console.error('Error deleting questionnaire item:', error);
      res.status(500).json({ message: 'Failed to delete questionnaire item' });
    }
  });
  
  // Admin endpoint for dashboard compatibility (returns empty array since we use bookings)
  app.get('/api/admin/event-requests', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    // Return empty array since we've moved to bookings-centric workflow
    res.json([]);
  });
  
  // Bundle Management API
  
  // Get all bundles for admin
  app.get('/api/admin/bundles', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    try {
      const bundles = await storage.getAllBundlesWithDetails();
      res.json(bundles);
    } catch (error) {
      console.error('Error fetching bundles:', error);
      res.status(500).json({ message: 'Failed to fetch bundles' });
    }
  });

  // Create new bundle
  app.post('/api/admin/bundles', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    try {
      const bundleData = {
        eventTypeId: req.body.eventTypeId,
        name: req.body.name,
        tier: req.body.tier,
        description: req.body.description,
        basePrice: req.body.basePrice,
        totalQuantity: req.body.totalQuantity,
        availableQuantity: req.body.totalQuantity, // Initially all available
        features: req.body.features,
        images: Array.isArray(req.body.images) ? req.body.images : [],
        videos: Array.isArray(req.body.videos) ? req.body.videos : [],
        isActive: req.body.isActive,
      };
      
      const bundle = await storage.createEventBundle(bundleData);
      res.status(201).json(bundle);
    } catch (error) {
      console.error('Error creating bundle:', error);
      res.status(500).json({ message: 'Failed to create bundle' });
    }
  });

  // Update bundle
  app.put('/api/admin/bundles/:id', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    try {
      const bundleId = parseInt(req.params.id);
      if (isNaN(bundleId)) {
        return res.status(400).json({ message: 'Invalid bundle ID' });
      }
      
      const bundleData = {
        eventTypeId: req.body.eventTypeId,
        name: req.body.name,
        tier: req.body.tier,
        description: req.body.description,
        basePrice: req.body.basePrice,
        totalQuantity: req.body.totalQuantity,
        features: req.body.features,
        images: Array.isArray(req.body.images) ? req.body.images : [],
        videos: Array.isArray(req.body.videos) ? req.body.videos : [],
        isActive: req.body.isActive,
      };
      
      const bundle = await storage.updateEventBundle(bundleId, bundleData);
      if (!bundle) {
        return res.status(404).json({ message: 'Bundle not found' });
      }
      
      res.json(bundle);
    } catch (error) {
      console.error('Error updating bundle:', error);
      res.status(500).json({ message: 'Failed to update bundle' });
    }
  });

  // Delete bundle
  app.delete('/api/admin/bundles/:id', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    try {
      const bundleId = parseInt(req.params.id);
      if (isNaN(bundleId)) {
        return res.status(400).json({ message: 'Invalid bundle ID' });
      }
      
      await storage.deleteEventBundle(bundleId);
      res.status(204).end();
    } catch (error) {
      console.error('Error deleting bundle:', error);
      res.status(500).json({ message: 'Failed to delete bundle' });
    }
  });

  // Create bundle option
  app.post('/api/admin/bundle-options', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    try {
      const optionData = {
        bundleId: req.body.bundleId,
        name: req.body.name,
        description: req.body.description,
        price: req.body.price,
        isRequired: req.body.isRequired,
        maxQuantity: req.body.maxQuantity,
        isActive: req.body.isActive,
      };
      
      const option = await storage.createBundleOption(optionData);
      res.status(201).json(option);
    } catch (error) {
      console.error('Error creating bundle option:', error);
      res.status(500).json({ message: 'Failed to create bundle option' });
    }
  });

  app.put('/api/admin/bundle-options/:id', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    try {
      const optionId = parseInt(req.params.id);
      if (isNaN(optionId)) {
        return res.status(400).json({ message: 'Invalid option ID' });
      }
      
      const optionData = {
        bundleId: req.body.bundleId,
        name: req.body.name,
        description: req.body.description,
        price: req.body.price,
        isRequired: req.body.isRequired,
        maxQuantity: req.body.maxQuantity,
        isActive: req.body.isActive,
      };
      
      const option = await storage.updateBundleOption(optionId, optionData);
      if (!option) {
        return res.status(404).json({ message: 'Bundle option not found' });
      }
      
      res.json(option);
    } catch (error) {
      console.error('Error updating bundle option:', error);
      res.status(500).json({ message: 'Failed to update bundle option' });
    }
  });

  app.delete('/api/admin/bundle-options/:id', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    try {
      const optionId = parseInt(req.params.id);
      if (isNaN(optionId)) {
        return res.status(400).json({ message: 'Invalid option ID' });
      }
      
      await storage.deleteBundleOption(optionId);
      res.status(204).end();
    } catch (error) {
      console.error('Error deleting bundle option:', error);
      res.status(500).json({ message: 'Failed to delete bundle option' });
    }
  });

  // Bookings now handle the complete event flow (no separate event requests needed)

  // Media gateway: create an S3 image upload intent. The current implementation
  // returns the S3 key/public URL contract; a presigned upload provider can be
  // swapped in behind the gateway without changing API consumers.
  app.post('/api/admin/media/image-upload-intent', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    try {
      const input = imageUploadIntentSchema.parse(req.body);
      const intent = await mediaGateway.createImageUploadIntent(input);
      res.status(201).json(intent);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid image upload data', errors: error.errors });
      }
      console.error('Error creating image upload intent:', error);
      res.status(500).json({ message: 'Failed to create image upload intent' });
    }
  });

  app.post('/api/admin/media/upload-intent', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    if (req.user.userType !== USER_TYPES.ADMIN) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    try {
      const input = imageUploadIntentSchema.parse(req.body);
      const intent = await mediaGateway.createImageUploadIntent(input);
      res.json(intent);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid media upload request', errors: error.errors });
      }
      console.error('Error creating media upload intent:', error);
      res.status(500).json({ message: 'Failed to create upload intent' });
    }
  });

  app.post('/api/mobile/media/upload-intent', async (req, res) => {
    const mobileUser = await requireMobileClient(req, res);
    if (!mobileUser) return;

    try {
      const input = imageUploadIntentSchema.parse({
        ...req.body,
        folder: req.body.folder || `saneea/receipts/client-${mobileUser.id}`,
      });
      const intent = await mediaGateway.createImageUploadIntent(input);
      res.json(intent);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid media upload request', errors: error.errors });
      }
      console.error('Error creating mobile media upload intent:', error);
      res.status(500).json({ message: 'Failed to create upload intent' });
    }
  });

  app.post('/api/mobile/push-devices', async (req, res) => {
    const mobileUser = await requireMobileClient(req, res);
    if (!mobileUser) return;

    try {
      const input = pushDeviceSchema.parse(req.body);
      const [device] = await db
        .insert(pushNotificationDevicesTable)
        .values({
          userId: mobileUser.id,
          token: input.token,
          provider: input.provider,
          platform: input.platform || null,
          enabled: true,
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: pushNotificationDevicesTable.token,
          set: {
            userId: mobileUser.id,
            provider: input.provider,
            platform: input.platform || null,
            enabled: true,
            lastSeenAt: new Date(),
            updatedAt: new Date(),
          },
        })
        .returning();

      res.status(201).json(device);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid push device data', errors: error.errors });
      }
      console.error('Error registering push device:', error);
      res.status(500).json({ message: 'Failed to register push device' });
    }
  });

  // Event items: admin-defined pieces inside an event type (venue, catering, etc.)
  app.get('/api/event-types/:eventTypeId/items', async (req, res) => {
    try {
      const eventTypeId = parseInt(req.params.eventTypeId);
      if (isNaN(eventTypeId)) return res.status(400).json({ message: 'Invalid event type ID' });

      const items = await db
        .select()
        .from(eventItemsTable)
        .where(eq(eventItemsTable.eventTypeId, eventTypeId))
        .orderBy(eventItemsTable.displayOrder);

      const options = await db
        .select({
          id: itemVendorOptionsTable.id,
          eventItemId: itemVendorOptionsTable.eventItemId,
          vendorId: itemVendorOptionsTable.vendorId,
          optionName: itemVendorOptionsTable.optionName,
          description: itemVendorOptionsTable.description,
          price: itemVendorOptionsTable.price,
          images: itemVendorOptionsTable.images,
          isDefault: itemVendorOptionsTable.isDefault,
          isActive: itemVendorOptionsTable.isActive,
          vendorName: vendorsTable.businessName,
        })
        .from(itemVendorOptionsTable)
        .leftJoin(vendorsTable, eq(itemVendorOptionsTable.vendorId, vendorsTable.id));

      const optionsByItem = options.reduce((acc, option) => {
        if (!acc[option.eventItemId]) acc[option.eventItemId] = [];
        acc[option.eventItemId].push(option);
        return acc;
      }, {} as Record<number, typeof options>);

      res.json(items.map(item => ({
        ...item,
        vendorOptions: optionsByItem[item.id] || [],
      })));
    } catch (error) {
      console.error('Error fetching event items:', error);
      res.status(500).json({ message: 'Failed to fetch event items' });
    }
  });

  app.post('/api/admin/event-types/:eventTypeId/items', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    try {
      const eventTypeId = parseInt(req.params.eventTypeId);
      if (isNaN(eventTypeId)) return res.status(400).json({ message: 'Invalid event type ID' });
      const itemData = eventItemSchema.parse(req.body);

      const [item] = await db
        .insert(eventItemsTable)
        .values({ ...itemData, eventTypeId })
        .returning();

      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid event item data', errors: error.errors });
      }
      console.error('Error creating event item:', error);
      res.status(500).json({ message: 'Failed to create event item' });
    }
  });

  app.patch('/api/admin/event-items/:id', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: 'Invalid event item ID' });
      const itemData = eventItemSchema.partial().parse(req.body);

      const [item] = await db
        .update(eventItemsTable)
        .set({ ...itemData, updatedAt: new Date() })
        .where(eq(eventItemsTable.id, id))
        .returning();

      if (!item) return res.status(404).json({ message: 'Event item not found' });
      res.json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid event item data', errors: error.errors });
      }
      console.error('Error updating event item:', error);
      res.status(500).json({ message: 'Failed to update event item' });
    }
  });

  app.delete('/api/admin/event-items/:id', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: 'Invalid event item ID' });

      await db.delete(bundleItemsTable).where(eq(bundleItemsTable.eventItemId, id));
      await db.delete(itemVendorOptionsTable).where(eq(itemVendorOptionsTable.eventItemId, id));
      await db.delete(eventItemsTable).where(eq(eventItemsTable.id, id));
      res.status(204).end();
    } catch (error) {
      console.error('Error deleting event item:', error);
      res.status(500).json({ message: 'Failed to delete event item' });
    }
  });

  // Vendor options for an event item
  app.post('/api/admin/event-items/:eventItemId/vendor-options', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    try {
      const eventItemId = parseInt(req.params.eventItemId);
      if (isNaN(eventItemId)) return res.status(400).json({ message: 'Invalid event item ID' });
      const optionData = itemVendorOptionSchema.parse(req.body);

      const [option] = await db
        .insert(itemVendorOptionsTable)
        .values({ ...optionData, eventItemId })
        .returning();

      res.status(201).json(option);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid vendor option data', errors: error.errors });
      }
      console.error('Error creating item vendor option:', error);
      res.status(500).json({ message: 'Failed to create item vendor option' });
    }
  });

  app.patch('/api/admin/item-vendor-options/:id', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: 'Invalid vendor option ID' });
      const optionData = itemVendorOptionSchema.partial().parse(req.body);

      const [option] = await db
        .update(itemVendorOptionsTable)
        .set({ ...optionData, updatedAt: new Date() })
        .where(eq(itemVendorOptionsTable.id, id))
        .returning();

      if (!option) return res.status(404).json({ message: 'Vendor option not found' });
      res.json(option);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid vendor option data', errors: error.errors });
      }
      console.error('Error updating item vendor option:', error);
      res.status(500).json({ message: 'Failed to update item vendor option' });
    }
  });

  app.delete('/api/admin/item-vendor-options/:id', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: 'Invalid vendor option ID' });

      await db
        .update(bundleItemsTable)
        .set({ defaultOptionId: null, updatedAt: new Date() })
        .where(eq(bundleItemsTable.defaultOptionId, id));
      await db.delete(itemVendorOptionsTable).where(eq(itemVendorOptionsTable.id, id));
      res.status(204).end();
    } catch (error) {
      console.error('Error deleting item vendor option:', error);
      res.status(500).json({ message: 'Failed to delete item vendor option' });
    }
  });

  // Bundle items link a tier/package to concrete event items and default vendor options.
  app.get('/api/admin/bundles/:bundleId/items', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    try {
      const bundleId = parseInt(req.params.bundleId);
      if (isNaN(bundleId)) return res.status(400).json({ message: 'Invalid bundle ID' });

      const items = await db
        .select({
          id: bundleItemsTable.id,
          bundleId: bundleItemsTable.bundleId,
          eventItemId: bundleItemsTable.eventItemId,
          defaultOptionId: bundleItemsTable.defaultOptionId,
          isIncluded: bundleItemsTable.isIncluded,
          quantity: bundleItemsTable.quantity,
          priceOverride: bundleItemsTable.priceOverride,
          displayOrder: bundleItemsTable.displayOrder,
          itemName: eventItemsTable.name,
          itemCategory: eventItemsTable.category,
          optionName: itemVendorOptionsTable.optionName,
          optionPrice: itemVendorOptionsTable.price,
          vendorName: vendorsTable.businessName,
        })
        .from(bundleItemsTable)
        .leftJoin(eventItemsTable, eq(bundleItemsTable.eventItemId, eventItemsTable.id))
        .leftJoin(itemVendorOptionsTable, eq(bundleItemsTable.defaultOptionId, itemVendorOptionsTable.id))
        .leftJoin(vendorsTable, eq(itemVendorOptionsTable.vendorId, vendorsTable.id))
        .where(eq(bundleItemsTable.bundleId, bundleId))
        .orderBy(bundleItemsTable.displayOrder);

      res.json(items);
    } catch (error) {
      console.error('Error fetching bundle items:', error);
      res.status(500).json({ message: 'Failed to fetch bundle items' });
    }
  });

  app.post('/api/admin/bundles/:bundleId/items', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    try {
      const bundleId = parseInt(req.params.bundleId);
      if (isNaN(bundleId)) return res.status(400).json({ message: 'Invalid bundle ID' });
      const itemData = bundleItemSchema.parse(req.body);

      const [bundleItem] = await db
        .insert(bundleItemsTable)
        .values({ ...itemData, bundleId })
        .returning();

      res.status(201).json(bundleItem);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid bundle item data', errors: error.errors });
      }
      console.error('Error creating bundle item:', error);
      res.status(500).json({ message: 'Failed to create bundle item' });
    }
  });

  app.patch('/api/admin/bundle-items/:id', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: 'Invalid bundle item ID' });
      const itemData = bundleItemSchema.partial().parse(req.body);

      const [bundleItem] = await db
        .update(bundleItemsTable)
        .set({ ...itemData, updatedAt: new Date() })
        .where(eq(bundleItemsTable.id, id))
        .returning();

      if (!bundleItem) return res.status(404).json({ message: 'Bundle item not found' });
      res.json(bundleItem);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid bundle item data', errors: error.errors });
      }
      console.error('Error updating bundle item:', error);
      res.status(500).json({ message: 'Failed to update bundle item' });
    }
  });

  app.delete('/api/admin/bundle-items/:id', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: 'Invalid bundle item ID' });
      await db.delete(bundleItemsTable).where(eq(bundleItemsTable.id, id));
      res.status(204).end();
    } catch (error) {
      console.error('Error deleting bundle item:', error);
      res.status(500).json({ message: 'Failed to delete bundle item' });
    }
  });

  // Mobile API: event-centric read model for the React mobile client.
  app.get('/api/mobile/event-types', async (req, res) => {
    try {
      const eventTypes = await db
        .select()
        .from(eventTypesTable)
        .where(eq(eventTypesTable.isActive, true))
        .orderBy(eventTypesTable.name);

      const activeBundles = await db
        .select()
        .from(eventBundlesTable)
        .where(eq(eventBundlesTable.isActive, true));

      const items = await db
        .select()
        .from(eventItemsTable)
        .where(eq(eventItemsTable.isActive, true));

      const bundleCountByEvent = activeBundles.reduce((acc, bundle) => {
        acc[bundle.eventTypeId] = (acc[bundle.eventTypeId] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);

      const itemCountByEvent = items.reduce((acc, item) => {
        acc[item.eventTypeId] = (acc[item.eventTypeId] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);

      res.json(eventTypes.map((eventType) => ({
        id: eventType.id,
        name: eventType.name,
        description: eventType.description,
        icon: eventType.icon,
        category: eventType.category,
        images: eventType.images || [],
        videos: eventType.videos || [],
        packageCount: bundleCountByEvent[eventType.id] || 0,
        itemCount: itemCountByEvent[eventType.id] || 0,
      })));
    } catch (error) {
      console.error('Error fetching mobile event types:', error);
      res.status(500).json({ message: 'Failed to fetch event types' });
    }
  });

  app.get('/api/mobile/event-types/:eventTypeId', async (req, res) => {
    try {
      const eventTypeId = parseInt(req.params.eventTypeId);
      if (isNaN(eventTypeId)) return res.status(400).json({ message: 'Invalid event type ID' });

      const [eventType] = await db
        .select()
        .from(eventTypesTable)
        .where(and(eq(eventTypesTable.id, eventTypeId), eq(eventTypesTable.isActive, true)));

      if (!eventType) return res.status(404).json({ message: 'Event type not found' });

      const items = await db
        .select()
        .from(eventItemsTable)
        .where(and(eq(eventItemsTable.eventTypeId, eventTypeId), eq(eventItemsTable.isActive, true)))
        .orderBy(eventItemsTable.displayOrder);

      const packages = await db
        .select()
        .from(eventBundlesTable)
        .where(and(eq(eventBundlesTable.eventTypeId, eventTypeId), eq(eventBundlesTable.isActive, true)))
        .orderBy(eventBundlesTable.displayOrder);

      res.json({
        ...eventType,
        images: eventType.images || [],
        videos: eventType.videos || [],
        items,
        packages: packages.map((bundle) => ({
          ...bundle,
          features: bundle.features || [],
          images: bundle.images || [],
          videos: bundle.videos || [],
        })),
      });
    } catch (error) {
      console.error('Error fetching mobile event detail:', error);
      res.status(500).json({ message: 'Failed to fetch event details' });
    }
  });

  app.get('/api/mobile/event-types/:eventTypeId/packages', async (req, res) => {
    try {
      const eventTypeId = parseInt(req.params.eventTypeId);
      if (isNaN(eventTypeId)) return res.status(400).json({ message: 'Invalid event type ID' });

      const packages = await db
        .select()
        .from(eventBundlesTable)
        .where(and(eq(eventBundlesTable.eventTypeId, eventTypeId), eq(eventBundlesTable.isActive, true)))
        .orderBy(eventBundlesTable.displayOrder);

      const packageIds = packages.map((bundle) => bundle.id);
      const allBundleItems = packageIds.length > 0
        ? await db
            .select({
              id: bundleItemsTable.id,
              bundleId: bundleItemsTable.bundleId,
              eventItemId: bundleItemsTable.eventItemId,
              defaultOptionId: bundleItemsTable.defaultOptionId,
              isIncluded: bundleItemsTable.isIncluded,
              quantity: bundleItemsTable.quantity,
              priceOverride: bundleItemsTable.priceOverride,
              displayOrder: bundleItemsTable.displayOrder,
              itemName: eventItemsTable.name,
              itemDescription: eventItemsTable.description,
              itemCategory: eventItemsTable.category,
              optionName: itemVendorOptionsTable.optionName,
              optionDescription: itemVendorOptionsTable.description,
              optionPrice: itemVendorOptionsTable.price,
              optionImages: itemVendorOptionsTable.images,
              vendorId: itemVendorOptionsTable.vendorId,
              vendorName: vendorsTable.businessName,
            })
            .from(bundleItemsTable)
            .leftJoin(eventItemsTable, eq(bundleItemsTable.eventItemId, eventItemsTable.id))
            .leftJoin(itemVendorOptionsTable, eq(bundleItemsTable.defaultOptionId, itemVendorOptionsTable.id))
            .leftJoin(vendorsTable, eq(itemVendorOptionsTable.vendorId, vendorsTable.id))
        : [];

      const itemsByBundle = allBundleItems.reduce((acc, item) => {
        if (!packageIds.includes(item.bundleId)) return acc;
        if (!acc[item.bundleId]) acc[item.bundleId] = [];
        acc[item.bundleId].push(item);
        return acc;
      }, {} as Record<number, typeof allBundleItems>);

      res.json(packages.map((bundle) => {
        const concreteItems = (itemsByBundle[bundle.id] || []).sort(
          (a, b) => (a.displayOrder || 0) - (b.displayOrder || 0)
        );
        const itemTotal = concreteItems.reduce((sum, item) => {
          const price = item.priceOverride ?? item.optionPrice ?? 0;
          return sum + price * (item.quantity || 1);
        }, 0);

        return {
          ...bundle,
          features: bundle.features || [],
          images: bundle.images || [],
          videos: bundle.videos || [],
          items: concreteItems,
          calculatedBasePrice: concreteItems.length > 0 ? itemTotal : bundle.basePrice,
        };
      }));
    } catch (error) {
      console.error('Error fetching mobile packages:', error);
      res.status(500).json({ message: 'Failed to fetch packages' });
    }
  });

  app.get('/api/mobile/packages/:bundleId/customization', async (req, res) => {
    try {
      const bundleId = parseInt(req.params.bundleId);
      if (isNaN(bundleId)) return res.status(400).json({ message: 'Invalid package ID' });

      const [bundle] = await db
        .select()
        .from(eventBundlesTable)
        .where(and(eq(eventBundlesTable.id, bundleId), eq(eventBundlesTable.isActive, true)));

      if (!bundle) return res.status(404).json({ message: 'Package not found' });

      const [eventType] = await db
        .select()
        .from(eventTypesTable)
        .where(eq(eventTypesTable.id, bundle.eventTypeId));

      const includedItems = await db
        .select({
          bundleItemId: bundleItemsTable.id,
          eventItemId: bundleItemsTable.eventItemId,
          defaultOptionId: bundleItemsTable.defaultOptionId,
          quantity: bundleItemsTable.quantity,
          priceOverride: bundleItemsTable.priceOverride,
          displayOrder: bundleItemsTable.displayOrder,
          itemName: eventItemsTable.name,
          itemDescription: eventItemsTable.description,
          itemCategory: eventItemsTable.category,
          isRequired: eventItemsTable.isRequired,
        })
        .from(bundleItemsTable)
        .leftJoin(eventItemsTable, eq(bundleItemsTable.eventItemId, eventItemsTable.id))
        .where(and(eq(bundleItemsTable.bundleId, bundleId), eq(bundleItemsTable.isIncluded, true)))
        .orderBy(bundleItemsTable.displayOrder);

      const eventItemIds = includedItems.map((item) => item.eventItemId);
      const options = eventItemIds.length > 0
        ? await db
            .select({
              id: itemVendorOptionsTable.id,
              eventItemId: itemVendorOptionsTable.eventItemId,
              vendorId: itemVendorOptionsTable.vendorId,
              optionName: itemVendorOptionsTable.optionName,
              description: itemVendorOptionsTable.description,
              price: itemVendorOptionsTable.price,
              images: itemVendorOptionsTable.images,
              isDefault: itemVendorOptionsTable.isDefault,
              vendorName: vendorsTable.businessName,
              vendorCategory: vendorsTable.category,
              vendorRating: vendorsTable.rating,
            })
            .from(itemVendorOptionsTable)
            .leftJoin(vendorsTable, eq(itemVendorOptionsTable.vendorId, vendorsTable.id))
            .where(eq(itemVendorOptionsTable.isActive, true))
        : [];

      const optionsByItem = options.reduce((acc, option) => {
        if (!eventItemIds.includes(option.eventItemId)) return acc;
        if (!acc[option.eventItemId]) acc[option.eventItemId] = [];
        acc[option.eventItemId].push({
          ...option,
          images: option.images || [],
        });
        return acc;
      }, {} as Record<number, Array<typeof options[number] & { images: string[] }>>);

      const items = includedItems.map((item) => {
        const itemOptions = optionsByItem[item.eventItemId] || [];
        const defaultOption = itemOptions.find((option) => option.id === item.defaultOptionId) || itemOptions[0] || null;
        return {
          ...item,
          vendorOptions: itemOptions,
          defaultOption,
        };
      });

      const calculatedBasePrice = items.reduce((sum, item) => {
        const price = item.priceOverride ?? item.defaultOption?.price ?? 0;
        return sum + price * (item.quantity || 1);
      }, 0);

      res.json({
        eventType,
        package: {
          ...bundle,
          features: bundle.features || [],
          images: bundle.images || [],
          videos: bundle.videos || [],
          calculatedBasePrice: items.length > 0 ? calculatedBasePrice : bundle.basePrice,
        },
        items,
      });
    } catch (error) {
      console.error('Error fetching package customization:', error);
      res.status(500).json({ message: 'Failed to fetch package customization' });
    }
  });

  app.post('/api/mobile/bookings', async (req, res) => {
    const mobileUser = await requireMobileClient(req, res);
    if (!mobileUser) return;

    try {
      const bookingData = mobileBookingSchema.parse(req.body);
      const today = normalizeStartOfDay(new Date());
      if (normalizeStartOfDay(bookingData.eventDate) < today) {
        return res.status(400).json({ message: 'Event date cannot be in the past' });
      }

      const booking = await db.transaction(async (tx) => {
        let basePrice = 0;
        let optionsPrice = 0;

        if (bookingData.bundleId) {
          const [bundle] = await tx
            .select()
            .from(eventBundlesTable)
            .where(
              and(
                eq(eventBundlesTable.id, bookingData.bundleId),
                eq(eventBundlesTable.eventTypeId, bookingData.eventTypeId),
                eq(eventBundlesTable.isActive, true)
              )
            );

          if (!bundle) {
            throw new Error('Package not found for this event type');
          }
          if ((bundle.availableQuantity ?? 0) <= 0) {
            throw new Error('Package is not available');
          }

          const packageItems = await tx
            .select({
              eventItemId: bundleItemsTable.eventItemId,
              defaultOptionId: bundleItemsTable.defaultOptionId,
              isRequired: eventItemsTable.isRequired,
              itemName: eventItemsTable.name,
              quantity: bundleItemsTable.quantity,
              priceOverride: bundleItemsTable.priceOverride,
              defaultPrice: itemVendorOptionsTable.price,
              defaultOptionActive: itemVendorOptionsTable.isActive,
            })
            .from(bundleItemsTable)
            .leftJoin(eventItemsTable, eq(bundleItemsTable.eventItemId, eventItemsTable.id))
            .leftJoin(itemVendorOptionsTable, eq(bundleItemsTable.defaultOptionId, itemVendorOptionsTable.id))
            .where(
              and(
                eq(bundleItemsTable.bundleId, bookingData.bundleId),
                eq(bundleItemsTable.isIncluded, true),
                eq(eventItemsTable.isActive, true)
              )
            );

          const selectionByItem = new Map<number, typeof bookingData.selectedItemOptions[number]>();
          for (const selection of bookingData.selectedItemOptions) {
            if (selectionByItem.has(selection.eventItemId)) {
              throw new Error(`Duplicate selection for event item: ${selection.eventItemId}`);
            }
            selectionByItem.set(selection.eventItemId, selection);
          }

          for (const packageItem of packageItems) {
            const hasSelection = selectionByItem.has(packageItem.eventItemId);
            const hasDefault = !!packageItem.defaultOptionId && packageItem.defaultOptionActive !== false;
            if (packageItem.isRequired && !hasSelection && !hasDefault) {
              throw new Error(`Required event item needs a vendor option: ${packageItem.itemName || packageItem.eventItemId}`);
            }
          }

          if (packageItems.length > 0) {
            for (const item of packageItems) {
              basePrice += (item.priceOverride ?? item.defaultPrice ?? 0) * (item.quantity || 1);
            }
          } else {
            basePrice = bundle.basePrice;
          }

          for (const itemSelection of bookingData.selectedItemOptions) {
            const packageItem = packageItems.find((item) => item.eventItemId === itemSelection.eventItemId);
            if (!packageItem) {
              throw new Error(`Event item is not part of this package: ${itemSelection.eventItemId}`);
            }

            const [selectedOption] = await tx
              .select()
              .from(itemVendorOptionsTable)
              .leftJoin(vendorsTable, eq(itemVendorOptionsTable.vendorId, vendorsTable.id))
              .where(
                and(
                  eq(itemVendorOptionsTable.id, itemSelection.optionId),
                  eq(itemVendorOptionsTable.eventItemId, itemSelection.eventItemId),
                  eq(itemVendorOptionsTable.isActive, true),
                  eq(vendorsTable.id, itemVendorOptionsTable.vendorId)
                )
              );

            if (!selectedOption) {
              throw new Error(`Invalid vendor option ID: ${itemSelection.optionId}`);
            }

            const defaultPrice = packageItem.priceOverride ?? packageItem.defaultPrice ?? 0;
            optionsPrice += (selectedOption.item_vendor_options.price - defaultPrice) * (itemSelection.quantity || packageItem.quantity || 1);
          }

          const [updatedBundle] = await tx
            .update(eventBundlesTable)
            .set({ availableQuantity: sql`${eventBundlesTable.availableQuantity} - 1` })
            .where(and(eq(eventBundlesTable.id, bookingData.bundleId), gt(eventBundlesTable.availableQuantity, 0)))
            .returning();

          if (!updatedBundle) {
            throw new Error('Package is not available');
          }
        } else {
          const [eventType] = await tx
            .select()
            .from(eventTypesTable)
            .where(and(eq(eventTypesTable.id, bookingData.eventTypeId), eq(eventTypesTable.isActive, true)));

          if (!eventType) {
            throw new Error('Event type not found');
          }
        }

        const totalPrice = basePrice + optionsPrice;
        const [createdBooking] = await tx
            .insert(bookingsTable)
            .values({
            clientId: mobileUser.id,
            eventTypeId: bookingData.eventTypeId,
            bundleId: bookingData.bundleId || null,
            eventDate: bookingData.eventDate,
            eventTime: bookingData.eventTime || null,
            location: bookingData.location,
            guestCount: bookingData.guestCount,
            budget: bookingData.budget || null,
            specialRequests: bookingData.specialRequests || null,
            clientAttachments: bookingData.clientAttachments,
            questionnaireResponses: bookingData.questionnaireResponses,
            selectedOptions: {
              itemOptions: bookingData.selectedItemOptions,
            },
            basePrice,
            optionsPrice,
            totalPrice,
            status: BOOKING_STATUS.VENDOR_REVIEW,
          })
          .returning();

        await tx.insert(pricingHistoryTable).values({
          bookingId: createdBooking.id,
          bundleId: bookingData.bundleId || null,
          basePrice,
          additionalOptions: {
            itemOptions: bookingData.selectedItemOptions,
          },
          totalPrice,
          calculatedBy: mobileUser.id,
        });

        return createdBooking;
      });

      sendBookingTemplate({
        bookingId: booking.id,
        template: "booking_received",
      }).catch((error) => {
        console.error("Failed to send booking received template:", error);
      });

      syncBookingToErp(booking.id).catch((error) => {
        console.error("Failed to sync mobile booking to ERP:", error);
      });

      res.status(201).json(booking);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid booking data', errors: error.errors });
      }
      console.error('Error creating mobile booking:', error);
      res.status(400).json({ message: error?.message || 'Failed to create booking' });
    }
  });

  app.get('/api/mobile/bookings', async (req, res) => {
    const mobileUser = await requireMobileClient(req, res);
    if (!mobileUser) return;

    try {
      const bookings = await db
        .select({
          id: bookingsTable.id,
          status: bookingsTable.status,
          eventDate: bookingsTable.eventDate,
          eventTime: bookingsTable.eventTime,
          location: bookingsTable.location,
          guestCount: bookingsTable.guestCount,
          budget: bookingsTable.budget,
          totalPrice: bookingsTable.totalPrice,
          createdAt: bookingsTable.createdAt,
          eventTypeId: bookingsTable.eventTypeId,
          eventTypeName: eventTypesTable.name,
          eventTypeIcon: eventTypesTable.icon,
          eventTypeImages: eventTypesTable.images,
          bundleId: bookingsTable.bundleId,
          bundleName: eventBundlesTable.name,
          bundleTier: eventBundlesTable.tier,
        })
        .from(bookingsTable)
        .leftJoin(eventTypesTable, eq(bookingsTable.eventTypeId, eventTypesTable.id))
        .leftJoin(eventBundlesTable, eq(bookingsTable.bundleId, eventBundlesTable.id))
        .where(eq(bookingsTable.clientId, mobileUser.id))
        .orderBy(sql`${bookingsTable.createdAt} desc`);

      res.json(bookings.map((booking) => ({
        ...booking,
        eventTypeImages: booking.eventTypeImages || [],
      })));
    } catch (error) {
      console.error('Error fetching mobile bookings:', error);
      res.status(500).json({ message: 'Failed to fetch bookings' });
    }
  });

  app.get('/api/mobile/bookings/:bookingId', async (req, res) => {
    const mobileUser = await requireMobileClient(req, res);
    if (!mobileUser) return;

    try {
      const bookingId = parseInt(req.params.bookingId);
      if (isNaN(bookingId)) return res.status(400).json({ message: 'Invalid booking ID' });

      const [booking] = await db
        .select({
          id: bookingsTable.id,
          clientId: bookingsTable.clientId,
          status: bookingsTable.status,
          eventDate: bookingsTable.eventDate,
          eventTime: bookingsTable.eventTime,
          location: bookingsTable.location,
          guestCount: bookingsTable.guestCount,
          budget: bookingsTable.budget,
          specialRequests: bookingsTable.specialRequests,
          clientAttachments: bookingsTable.clientAttachments,
          questionnaireResponses: bookingsTable.questionnaireResponses,
          selectedOptions: bookingsTable.selectedOptions,
          basePrice: bookingsTable.basePrice,
          optionsPrice: bookingsTable.optionsPrice,
          totalPrice: bookingsTable.totalPrice,
          createdAt: bookingsTable.createdAt,
          eventTypeId: bookingsTable.eventTypeId,
          eventTypeName: eventTypesTable.name,
          eventTypeDescription: eventTypesTable.description,
          eventTypeImages: eventTypesTable.images,
          bundleId: bookingsTable.bundleId,
          bundleName: eventBundlesTable.name,
          bundleTier: eventBundlesTable.tier,
          bundleDescription: eventBundlesTable.description,
        })
        .from(bookingsTable)
        .leftJoin(eventTypesTable, eq(bookingsTable.eventTypeId, eventTypesTable.id))
        .leftJoin(eventBundlesTable, eq(bookingsTable.bundleId, eventBundlesTable.id))
        .where(and(eq(bookingsTable.id, bookingId), eq(bookingsTable.clientId, mobileUser.id)));

      if (!booking) return res.status(404).json({ message: 'Booking not found' });

      const payments = await db
        .select()
        .from(paymentsTable)
        .where(eq(paymentsTable.bookingId, bookingId))
        .orderBy(paymentsTable.createdAt);

      const packageItems = booking.bundleId
        ? await db
            .select({
              bundleItemId: bundleItemsTable.id,
              eventItemId: bundleItemsTable.eventItemId,
              defaultOptionId: bundleItemsTable.defaultOptionId,
              quantity: bundleItemsTable.quantity,
              priceOverride: bundleItemsTable.priceOverride,
              itemName: eventItemsTable.name,
              itemCategory: eventItemsTable.category,
              optionName: itemVendorOptionsTable.optionName,
              optionPrice: itemVendorOptionsTable.price,
              optionImages: itemVendorOptionsTable.images,
              vendorName: vendorsTable.businessName,
            })
            .from(bundleItemsTable)
            .leftJoin(eventItemsTable, eq(bundleItemsTable.eventItemId, eventItemsTable.id))
            .leftJoin(itemVendorOptionsTable, eq(bundleItemsTable.defaultOptionId, itemVendorOptionsTable.id))
            .leftJoin(vendorsTable, eq(itemVendorOptionsTable.vendorId, vendorsTable.id))
            .where(eq(bundleItemsTable.bundleId, booking.bundleId))
            .orderBy(bundleItemsTable.displayOrder)
        : [];

      const selectedItemOptions = parseMobileSelectedItemOptions(booking.selectedOptions);
      const selectedOptionIds = selectedItemOptions.map((selection) => selection.optionId);
      const selectedOptions = selectedOptionIds.length > 0
        ? await db
            .select({
              id: itemVendorOptionsTable.id,
              eventItemId: itemVendorOptionsTable.eventItemId,
              vendorId: itemVendorOptionsTable.vendorId,
              optionName: itemVendorOptionsTable.optionName,
              description: itemVendorOptionsTable.description,
              price: itemVendorOptionsTable.price,
              images: itemVendorOptionsTable.images,
              vendorName: vendorsTable.businessName,
              vendorCategory: vendorsTable.category,
            })
            .from(itemVendorOptionsTable)
            .leftJoin(vendorsTable, eq(itemVendorOptionsTable.vendorId, vendorsTable.id))
            .where(sql`${itemVendorOptionsTable.id} in ${selectedOptionIds}`)
        : [];

      const selectedOptionById = selectedOptions.reduce((acc, option) => {
        if (selectedOptionIds.includes(option.id)) {
          acc[option.id] = {
            ...option,
            images: option.images || [],
          };
        }
        return acc;
      }, {} as Record<number, typeof selectedOptions[number] & { images: string[] }>);

      const selectionByItemId = selectedItemOptions.reduce((acc, selection) => {
        acc[selection.eventItemId] = {
          ...selection,
          selectedOption: selectedOptionById[selection.optionId] || null,
        };
        return acc;
      }, {} as Record<number, typeof selectedItemOptions[number] & { selectedOption: (typeof selectedOptions[number] & { images: string[] }) | null }>);

      res.json({
        ...booking,
        eventTypeImages: booking.eventTypeImages || [],
        packageItems: packageItems.map((item) => ({
          ...item,
          optionImages: item.optionImages || [],
          selected: selectionByItemId[item.eventItemId] || null,
          effectiveOption: selectionByItemId[item.eventItemId]?.selectedOption || {
            optionName: item.optionName,
            price: item.optionPrice,
            images: item.optionImages || [],
            vendorName: item.vendorName,
          },
        })),
        selectedItemOptions: Object.values(selectionByItemId),
        payments,
      });
    } catch (error) {
      console.error('Error fetching mobile booking detail:', error);
      res.status(500).json({ message: 'Failed to fetch booking' });
    }
  });
  
  // Get all users (admin only)
  app.get('/api/users', async (req, res) => {
    console.log('API /api/users called by user:', req.user?.username, 'type:', req.user?.userType);
    
    if (!req.isAuthenticated()) {
      console.log('User not authenticated');
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    // Only admins can view all users
    if (req.user.userType !== 'admin') {
      console.log('User is not admin:', req.user.userType);
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    try {
      const users = await storage.getAllUsers();
      console.log('Found users:', users.length);
      
      // Remove passwords from response
      const safeUsers = users.map((user: User) => {
        const { password, ...safeUser } = user;
        return safeUser;
      });
      
      console.log('Returning safe users:', safeUsers.length);
      res.json(safeUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: 'Error fetching users' });
    }
  });
  
  // Users map for admin dashboard
  app.get('/api/users/map', async (req, res) => {
    // Only admins can access user map
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    const hasPermission = await storage.checkAdminPermission(req.user.id, 'view_users');
    if (!hasPermission) {
      return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
    }
    
    try {
      const users = await db.query.users.findMany({
        columns: {
          id: true,
          username: true,
          email: true,
        }
      });
      
      // Convert to a map
      const userMap = users.reduce((acc, user) => {
        acc[user.id] = {
          username: user.username,
          email: user.email
        };
        return acc;
      }, {} as Record<number, { username: string; email: string }>);
      
      res.json(userMap);
    } catch (error) {
      console.error('Error creating user map:', error);
      res.status(500).json({ message: 'Failed to create user map' });
    }
  });
  
  // Admin routes
  app.get('/api/admin/check-permission', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    // Check if user is admin
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    try {
      const { permission } = req.query;
      if (!permission) {
        return res.status(400).json({ message: 'Permission parameter is required' });
      }
      
      const hasPermission = await storage.checkAdminPermission(req.user.id, permission as string);
      res.json(hasPermission);
    } catch (error) {
      console.error('Error checking admin permission:', error);
      res.status(500).json({ message: 'Error checking admin permission' });
    }
  });
  
  app.get('/api/admin/bookings', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    // Check if user is admin
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    try {
      // Get all bookings for admin
      const bookings = await storage.getAllBookings();
      
      // Enhance bookings with vendor/client data
      const enhancedBookings = await Promise.all(
        bookings.map(async booking => {
          const vendor = booking.vendorId ? await storage.getVendor(booking.vendorId) : null;
          const client = await storage.getUser(booking.clientId);
          
          return {
            ...booking,
            vendor,
            clientName: client?.fullName || client?.username
          };
        })
      );
      
      res.json(enhancedBookings);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching bookings for admin' });
    }
  });

  app.get('/api/admin/event-schedule', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    if (req.user.userType !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    try {
      const from = req.query.from ? new Date(String(req.query.from)) : null;
      const to = req.query.to ? new Date(String(req.query.to)) : null;
      const conditions = [];

      if (from && !isNaN(from.getTime())) {
        conditions.push(sql`${bookingsTable.eventDate} >= ${from}`);
      }
      if (to && !isNaN(to.getTime())) {
        conditions.push(sql`${bookingsTable.eventDate} <= ${to}`);
      }

      const schedule = await db
        .select({
          id: bookingsTable.id,
          status: bookingsTable.status,
          eventDate: bookingsTable.eventDate,
          eventTime: bookingsTable.eventTime,
          location: bookingsTable.location,
          guestCount: bookingsTable.guestCount,
          budget: bookingsTable.budget,
          totalPrice: bookingsTable.totalPrice,
          clientId: bookingsTable.clientId,
          clientName: users.fullName,
          clientPhone: users.phone,
          eventTypeName: eventTypesTable.name,
          bundleName: eventBundlesTable.name,
          vendorId: vendorsTable.id,
          vendorName: vendorsTable.businessName,
          vendorCity: vendorsTable.city,
        })
        .from(bookingsTable)
        .leftJoin(users, eq(bookingsTable.clientId, users.id))
        .leftJoin(eventTypesTable, eq(bookingsTable.eventTypeId, eventTypesTable.id))
        .leftJoin(eventBundlesTable, eq(bookingsTable.bundleId, eventBundlesTable.id))
        .leftJoin(vendorsTable, eq(bookingsTable.vendorId, vendorsTable.id))
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(bookingsTable.eventDate, bookingsTable.eventTime);

      res.json(schedule);
    } catch (error) {
      console.error('Error fetching event schedule:', error);
      res.status(500).json({ message: 'Failed to fetch event schedule' });
    }
  });

  // Delete booking/event request (Admin only)
  app.delete('/api/admin/bookings/:id', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    // Check if user is admin
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid booking ID' });
      }
      
      await db.transaction(async (tx) => {
        await tx.delete(paymentsTable).where(eq(paymentsTable.bookingId, id));
        await tx.delete(pricingHistoryTable).where(eq(pricingHistoryTable.bookingId, id));
        await tx.delete(bookingConfirmationsTable).where(eq(bookingConfirmationsTable.bookingId, id));
        await tx.delete(reviewsTable).where(eq(reviewsTable.bookingId, id));
        await tx.delete(bookingsTable).where(eq(bookingsTable.id, id));
      });
      res.status(204).end();
    } catch (error) {
      console.error('Error deleting booking:', error);
      res.status(500).json({ message: 'Failed to delete booking' });
    }
  });
  
  // Admin client management endpoint for chat functionality
  app.get('/api/admin/clients', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    // Check if user is admin
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    try {
      // Get all non-admin users (clients) for chat
      const allUsers = await storage.getAllUsers();
      const clients = allUsers.filter(user => user.userType !== 'admin');
      
      // Remove passwords and add chat metadata
      const clientsForChat = clients.map(client => {
        const { password, ...clientWithoutPassword } = client;
        return {
          ...clientWithoutPassword,
          name: client.fullName || client.username,
          lastMessage: null,
          lastMessageTime: null,
          hasUnreadMessages: false
        };
      });
      
      res.json(clientsForChat);
    } catch (error) {
      console.error('Error fetching clients:', error);
      res.status(500).json({ message: 'Error fetching clients' });
    }
  });

  // Admin Users Management Endpoints
  
  // Get admin users with permissions for admin dashboard
  app.get('/api/admin/users', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    // Check if user is admin
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    try {
      // Check if current admin has permission to manage admins
      const hasPermission = await storage.checkAdminPermission(req.user.id, 'manage_admins');
      if (!hasPermission) {
        return res.status(403).json({ message: 'You do not have permission to view admin users' });
      }
      
      // Get only admin users
      const adminUsers = await storage.getAdminUsers();
      
      // Get permissions for each admin user
      const adminUsersWithPermissions = await Promise.all(
        adminUsers.map(async (adminUser) => {
          const permissions = await storage.getUserPermissions(adminUser.id);
          const { password, ...userWithoutPassword } = adminUser;
          
          return {
            ...userWithoutPassword,
            permissions
          };
        })
      );
      
      res.json(adminUsersWithPermissions);
    } catch (error) {
      console.error('Error fetching admin users:', error);
      res.status(500).json({ message: 'Error fetching admin users' });
    }
  });

  // Get admin users specifically
  app.get('/api/admin/admin-users', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    // Check if user is admin
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    try {
      // Check if current admin has permission to manage admins
      const hasPermission = await storage.checkAdminPermission(req.user.id, 'manage_admins');
      if (!hasPermission) {
        return res.status(403).json({ message: 'You do not have permission to manage admin users' });
      }
      
      // Get all admin users
      const adminUsers = await storage.getAdminUsers();
      
      // Enhance admin users with their permissions
      const enhancedAdmins = await Promise.all(
        adminUsers.map(async admin => {
          const permissions = await storage.getUserPermissions(admin.id);
          
          // Don't include password in the response
          const { password, ...adminWithoutPassword } = admin;
          
          return {
            ...adminWithoutPassword,
            permissions
          };
        })
      );
      
      res.json(enhancedAdmins);
    } catch (error) {
      console.error('Error fetching admin users:', error);
      res.status(500).json({ message: 'Error fetching admin users' });
    }
  });
  
  // Create a new admin user
  app.post('/api/admin/users', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    // Check if user is admin
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    try {
      // Check if current admin has permission to manage admins
      const hasPermission = await storage.checkAdminPermission(req.user.id, 'manage_admins');
      if (!hasPermission) {
        return res.status(403).json({ message: 'You do not have permission to manage admin users' });
      }
      
      const { username, password, email, fullName, phone, permissions = [] } = req.body;
      
      // Create the new admin user
      const newAdmin = await storage.createUser({
        username,
        password,
        email,
        fullName,
        phone,
        userType: USER_TYPES.ADMIN
      });
      
      // Add permissions for the new admin
      if (permissions.length > 0) {
        await Promise.all(
          permissions.map((permission: string) => 
            storage.addAdminPermission({
              userId: newAdmin.id,
              permission,
              granted: true,
              grantedBy: req.user.id
            })
          )
        );
      }
      
      // Don't return the password
      const { password: _, ...adminWithoutPassword } = newAdmin;
      
      res.status(201).json({
        ...adminWithoutPassword,
        permissions
      });
    } catch (error) {
      console.error('Error creating admin user:', error);
      res.status(500).json({ message: 'Error creating admin user' });
    }
  });
  
  // Update an admin user's permissions
  app.put('/api/admin/users/:id/permissions', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    // Check if user is admin
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    try {
      // Check if current admin has permission to manage admins
      const hasPermission = await storage.checkAdminPermission(req.user.id, 'manage_admins');
      if (!hasPermission) {
        return res.status(403).json({ message: 'You do not have permission to manage admin users' });
      }
      
      const adminId = parseInt(req.params.id);
      
      // Can't modify your own permissions
      if (adminId === req.user.id) {
        return res.status(403).json({ message: 'You cannot modify your own permissions' });
      }
      
      const { permissions } = req.body;
      
      // Verify the user exists and is an admin
      const adminUser = await storage.getUser(adminId);
      if (!adminUser) {
        return res.status(404).json({ message: 'Admin user not found' });
      }
      
      if (adminUser.userType !== USER_TYPES.ADMIN) {
        return res.status(400).json({ message: 'User is not an admin' });
      }
      
      // Delete current permissions
      await storage.removeAllUserPermissions(adminId);
      
      // Add new permissions
      if (permissions && permissions.length > 0) {
        await Promise.all(
          permissions.map((permission: string) => 
            storage.addAdminPermission({
              userId: adminId,
              permission,
              granted: true,
              grantedBy: req.user.id
            })
          )
        );
      }
      
      // Return updated user with permissions
      const updatedPermissions = await storage.getUserPermissions(adminId);
      
      res.json({
        id: adminId,
        permissions: updatedPermissions
      });
    } catch (error) {
      console.error('Error updating admin permissions:', error);
      res.status(500).json({ message: 'Error updating admin permissions' });
    }
  });
  
  // Promote user to admin
  app.patch('/api/admin/users/:id/promote', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    // Check if user is admin
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    try {
      const userId = parseInt(req.params.id);
      const { userType } = req.body;
      
      if (userType !== 'admin') {
        return res.status(400).json({ message: 'Can only promote to admin' });
      }
      
      // Get the user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      if (user.userType === 'admin') {
        return res.status(400).json({ message: 'User is already an admin' });
      }
      
      // Update user type to admin
      const updatedUser = await storage.updateUser(userId, { userType: 'admin' });
      
      res.json(updatedUser);
    } catch (error) {
      console.error('Error promoting user:', error);
      res.status(500).json({ message: 'Error promoting user' });
    }
  });

  // Delete permissions for admin user
  app.delete('/api/admin/users/:id/permissions', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    // Check if user is admin
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    try {
      const adminId = parseInt(req.params.id);
      
      // Remove all permissions for this user
      await storage.removeAllUserPermissions(adminId);
      
      res.status(204).end();
    } catch (error) {
      console.error('Error removing permissions:', error);
      res.status(500).json({ message: 'Error removing permissions' });
    }
  });

  // Delete an admin user
  app.delete('/api/admin/users/:id', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    // Check if user is admin
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    try {
      // Check if current admin has permission to manage admins
      const hasPermission = await storage.checkAdminPermission(req.user.id, 'manage_admins');
      if (!hasPermission) {
        return res.status(403).json({ message: 'You do not have permission to manage admin users' });
      }
      
      const adminId = parseInt(req.params.id);
      
      // Can't delete yourself
      if (adminId === req.user.id) {
        return res.status(403).json({ message: 'You cannot delete your own account' });
      }
      
      // Verify the user exists and is an admin
      const adminUser = await storage.getUser(adminId);
      if (!adminUser) {
        return res.status(404).json({ message: 'Admin user not found' });
      }
      
      if (adminUser.userType !== USER_TYPES.ADMIN) {
        return res.status(400).json({ message: 'User is not an admin' });
      }
      
      // Delete permissions first
      await storage.removeAllUserPermissions(adminId);
      
      // Delete the admin user
      await storage.deleteUser(adminId);
      
      res.status(204).end();
    } catch (error) {
      console.error('Error deleting admin user:', error);
      res.status(500).json({ message: 'Error deleting admin user' });
    }
  });
  
  // Health check endpoint for load balancers and uptime checks
  app.get('/health', (req, res) => {
    res.status(200).json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development'
    });
  });

  const httpServer = createServer(app);
  
  // Set up WebSocket server
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  wss.on('connection', (ws: WebSocket) => {
    let userId: number | null = null;
    
    ws.on('message', async (message: string) => {
      try {
        const data = JSON.parse(message) as WSMessage;
        
        if (data.type === 'auth') {
          userId = parseInt(data.content);
          connections.push({ userId, socket: ws });
          console.log(`User ${userId} connected to WebSocket`);
          return;
        }
        
        if (data.type === 'message' && userId !== null) {
          console.log('WebSocket message data:', data);
          
          const receiverId = data.receiver || (data as any).receiverId;
          if (!receiverId) {
            console.error('No receiver ID provided in message data');
            return;
          }
          
          // REST persists messages and sends WhatsApp. WebSocket is only for live delivery.
          const recipientConnection = connections.find(conn => conn.userId === receiverId);
          if (recipientConnection && recipientConnection.socket.readyState === WebSocket.OPEN) {
            recipientConnection.socket.send(JSON.stringify({
              type: 'message',
              sender: userId,
              senderId: userId,
              receiver: receiverId,
              receiverId,
              content: data.content,
              timestamp: new Date()
            }));
          }
          
          console.log(`Live message forwarded from user ${userId} to user ${receiverId}`);
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });
    
    ws.on('close', () => {
      if (userId !== null) {
        const index = connections.findIndex(conn => conn.userId === userId);
        if (index !== -1) {
          connections.splice(index, 1);
          console.log(`User ${userId} disconnected from WebSocket`);
        }
      }
    });
  });
  
  // Vendor routes
  app.get('/api/vendors', async (req, res) => {
    try {
      const { category, search } = req.query;
      
      let vendors;
      if (category) {
        vendors = await storage.getVendorsByCategory(category as string);
      } else if (search) {
        vendors = await storage.searchVendors(search as string);
      } else {
        vendors = await storage.getAllVendors();
      }
      
      // Enhance vendors with user data
      const enhancedVendors = await Promise.all(
        vendors.map(async vendor => {
          const user = await storage.getUser(vendor.userId);
          return {
            ...vendor,
            email: user?.email,
            phone: user?.phone
          };
        })
      );
      
      res.json(enhancedVendors);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching vendors' });
    }
  });
  
  app.get('/api/vendors/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const vendor = await storage.getVendor(id);
      
      if (!vendor) {
        return res.status(404).json({ message: 'Vendor not found' });
      }
      
      // Get user data, services, and reviews
      const user = await storage.getUser(vendor.userId);
      const services = await storage.getServicesByVendor(id);
      const reviews = await storage.getReviewsByVendor(id);
      
      // Enhance reviews with user data
      const enhancedReviews = await Promise.all(
        reviews.map(async review => {
          const reviewer = await storage.getUser(review.clientId);
          return {
            ...review,
            reviewerName: reviewer?.fullName || reviewer?.username
          };
        })
      );
      
      res.json({
        ...vendor,
        email: user?.email,
        phone: user?.phone,
        services,
        reviews: enhancedReviews
      });
    } catch (error) {
      res.status(500).json({ message: 'Error fetching vendor details' });
    }
  });
  
  // Create or update vendor (for vendor users)
  app.post('/api/vendors', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    try {
      if (req.user.userType === 'admin') {
        const email = String(req.body.email || "").trim();
        const phone = req.body.phone ? String(req.body.phone).trim() : null;
        const businessName = String(req.body.businessName || "").trim();

        if (!email || !businessName || !req.body.category) {
          return res.status(400).json({ message: 'Business name, category, and email are required' });
        }

        let user = await storage.getUserByEmail(email);
        const temporaryPassword = `Vendor-${Math.random().toString(36).slice(2, 10)}`;
        let createdVendorUser = false;

        if (!user) {
          const usernameBase = email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "_") || `vendor_${Date.now()}`;
          let username = usernameBase;
          let suffix = 1;
          while (await storage.getUserByUsername(username)) {
            username = `${usernameBase}_${suffix++}`;
          }

          user = await storage.createUser({
            username,
            password: temporaryPassword,
            email,
            fullName: businessName,
            phone,
            userType: USER_TYPES.VENDOR,
          } as any);
          createdVendorUser = true;
        } else if (user.userType !== USER_TYPES.VENDOR) {
          user = await storage.updateUser(user.id, { userType: USER_TYPES.VENDOR, fullName: businessName, phone: phone || user.phone }) as User;
        }

        let vendor = await storage.getVendorByUserId(user.id);
        const vendorData: Partial<InsertVendor> = {
          userId: user.id,
          businessName,
          category: req.body.category,
          description: req.body.description || null,
          address: req.body.address || null,
          city: req.body.city || null,
          priceRange: req.body.priceRange || null,
          capacity: req.body.capacity ? Number(req.body.capacity) : null,
        };

        const existedVendor = Boolean(vendor);
        vendor = vendor
          ? await storage.updateVendor(vendor.id, vendorData)
          : await storage.createVendor(vendorData as InsertVendor);

        return res.status(existedVendor ? 200 : 201).json({
          ...vendor,
          email: user.email,
          phone: user.phone,
          temporaryPassword: createdVendorUser ? temporaryPassword : undefined,
        });
      }

      // Check if user is a vendor
      if (req.user.userType !== 'vendor') {
        return res.status(403).json({ message: 'Not authorized to create vendor profile' });
      }
      
      // Check if vendor profile already exists
      let vendor = await storage.getVendorByUserId(req.user.id);
      
      if (vendor) {
        // Update existing vendor
        const vendorData: Partial<InsertVendor> = {
          ...req.body,
          userId: req.user.id
        };
        
        vendor = await storage.updateVendor(vendor.id, vendorData);
        return res.json(vendor);
      } else {
        // Create new vendor
        const vendorData: InsertVendor = {
          ...req.body,
          userId: req.user.id
        };
        
        vendor = await storage.createVendor(vendorData);
        return res.status(201).json(vendor);
      }
    } catch (error) {
      console.error('Error creating/updating vendor profile:', error);
      res.status(500).json({ message: 'Error creating/updating vendor profile' });
    }
  });

  app.patch('/api/vendors/:id', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    if (req.user.userType !== USER_TYPES.ADMIN) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: 'Invalid vendor ID' });

      const vendor = await storage.getVendor(id);
      if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

      const vendorData: Partial<InsertVendor> = {
        businessName: req.body.businessName,
        category: req.body.category,
        description: req.body.description || null,
        address: req.body.address || null,
        city: req.body.city || null,
        priceRange: req.body.priceRange || null,
        capacity: req.body.capacity ? Number(req.body.capacity) : null,
      };

      const updatedVendor = await storage.updateVendor(id, vendorData);
      const userUpdates: Partial<User> = {};
      if (req.body.email) userUpdates.email = String(req.body.email);
      if (req.body.phone !== undefined) userUpdates.phone = req.body.phone || null;
      if (req.body.businessName) userUpdates.fullName = req.body.businessName;
      const updatedUser = Object.keys(userUpdates).length
        ? await storage.updateUser(vendor.userId, userUpdates)
        : await storage.getUser(vendor.userId);

      res.json({
        ...updatedVendor,
        email: updatedUser?.email,
        phone: updatedUser?.phone,
      });
    } catch (error) {
      console.error('Error updating vendor:', error);
      res.status(500).json({ message: 'Error updating vendor' });
    }
  });

  app.delete('/api/vendors/:id', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    if (req.user.userType !== USER_TYPES.ADMIN) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: 'Invalid vendor ID' });

      await db.transaction(async (tx) => {
        await tx.update(bookingsTable).set({ vendorId: null }).where(eq(bookingsTable.vendorId, id));
        await tx.delete(bookingConfirmationsTable).where(eq(bookingConfirmationsTable.vendorId, id));
        await tx
          .update(bundleItemsTable)
          .set({ defaultOptionId: null })
          .where(sql`${bundleItemsTable.defaultOptionId} in (select id from item_vendor_options where vendor_id = ${id})`);
        await tx.delete(itemVendorOptionsTable).where(eq(itemVendorOptionsTable.vendorId, id));
        await tx.delete(servicesTable).where(eq(servicesTable.vendorId, id));
        await tx.delete(vendorsTable).where(eq(vendorsTable.id, id));
      });

      res.status(204).end();
    } catch (error) {
      console.error('Error deleting vendor:', error);
      res.status(500).json({ message: 'Error deleting vendor' });
    }
  });

  app.get('/api/vendors/:id/reviews', async (req, res) => {
    try {
      const vendorId = parseInt(req.params.id);
      if (isNaN(vendorId)) {
        return res.status(400).json({ message: 'Invalid vendor ID' });
      }

      const vendor = await storage.getVendor(vendorId);
      if (!vendor) {
        return res.status(404).json({ message: 'Vendor not found' });
      }

      const vendorReviews = await storage.getReviewsByVendor(vendorId);
      const enhancedReviews = await Promise.all(
        vendorReviews.map(async (review) => {
          const client = await storage.getUser(review.clientId);
          return {
            ...review,
            reviewerName: client?.fullName || client?.username || 'Client'
          };
        })
      );

      res.json(enhancedReviews);
    } catch (error) {
      console.error('Error fetching reviews:', error);
      res.status(500).json({ message: 'Error fetching reviews' });
    }
  });

  app.post('/api/reviews', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    if (req.user.userType !== USER_TYPES.CLIENT) {
      return res.status(403).json({ message: 'Only clients can create reviews' });
    }

    try {
      const reviewData = createReviewSchema.parse(req.body);
      const booking = await storage.getBooking(reviewData.bookingId);

      if (!booking) {
        return res.status(404).json({ message: 'Booking not found' });
      }
      if (booking.clientId !== req.user.id) {
        return res.status(403).json({ message: 'Not authorized to review this booking' });
      }
      if (booking.vendorId !== reviewData.vendorId) {
        return res.status(400).json({ message: 'Review vendor does not match booking vendor' });
      }
      if (booking.status !== BOOKING_STATUS.COMPLETED) {
        return res.status(400).json({ message: 'Only completed bookings can be reviewed' });
      }

      const review = await storage.createReview({
        clientId: req.user.id,
        vendorId: reviewData.vendorId,
        bookingId: reviewData.bookingId,
        rating: reviewData.rating,
        comment: reviewData.comment || null,
      });

      const vendorReviews = await storage.getReviewsByVendor(reviewData.vendorId);
      const averageRating = vendorReviews.reduce((sum, item) => sum + item.rating, 0) / vendorReviews.length;
      await storage.updateVendor(reviewData.vendorId, {
        rating: Math.round(averageRating * 10) / 10,
        reviewCount: vendorReviews.length,
      });

      res.status(201).json(review);
    } catch (error: any) {
      console.error('Error creating review:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid review data', errors: error.errors });
      }
      res.status(500).json({ message: 'Error creating review' });
    }
  });
  
  // Booking routes
  app.post('/api/bookings', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    try {
      // Validate that required fields are present
      if (!req.body.eventDate) {
        return res.status(400).json({ message: 'Missing required field: eventDate' });
      }
      
      let bookingData;
      try {
        bookingData = {
          clientId: req.user.id,
          vendorId: req.body.vendorId || null, // Allow null vendorId for mobile app submissions
          eventTypeId: req.body.eventTypeId,
          eventDate: new Date(req.body.eventDate),
          eventTime: req.body.eventTime || '',
          guestCount: req.body.estimatedGuests || req.body.guestCount || 0,
          specialRequests: req.body.specialRequests || req.body.notes || "",
          totalPrice: req.body.totalPrice || 0,
          status: BOOKING_STATUS.PENDING,
          serviceId: req.body.serviceId !== undefined ? req.body.serviceId : null,
          questionnaireResponses: req.body.questionnaireResponses || {},
          notes: req.body.notes || req.body.specialRequests || "",
        };
      } catch (parseError: any) {
        console.error("Error parsing booking data:", parseError);
        return res.status(400).json({ message: 'Invalid booking data', error: parseError?.message || 'Unknown parsing error' });
      }
      
      try {
        const booking = await storage.createBooking(bookingData);
        res.status(201).json(booking);
      } catch (dbError: any) {
        console.error("Database error creating booking:", dbError);
        return res.status(500).json({ 
          message: 'Database error creating booking', 
          error: dbError?.message || 'Unknown database error'
        });
      }
    } catch (error: any) {
      console.error("Booking creation error:", error);
      res.status(500).json({ 
        message: 'Error creating booking', 
        error: error?.message || 'Unknown error during booking creation'
      });
    }
  });

  // Get individual user details for chat
  app.get('/api/users/:userId', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ message: 'Invalid user ID' });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Remove password for security
      res.json(withoutPassword(user));
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ message: 'Error fetching user' });
    }
  });

  app.patch('/api/users/:userId', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ message: 'Invalid user ID' });
      }

      const isSelf = req.user.id === userId;
      const isAdmin = req.user.userType === USER_TYPES.ADMIN;
      if (!isSelf && !isAdmin) {
        return res.status(403).json({ message: 'Not authorized' });
      }

      const input = userProfileUpdateSchema.parse(req.body);
      const updateData: Partial<User> = {};

      if (input.fullName !== undefined) updateData.fullName = input.fullName;
      if (input.email !== undefined && input.email !== null) updateData.email = input.email;
      if (input.phone !== undefined) updateData.phone = input.phone || null;

      if (Object.keys(updateData).length === 0) {
        const user = await storage.getUser(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });
        return res.json(withoutPassword(user));
      }

      const updatedUser = await storage.updateUser(userId, updateData);
      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json(withoutPassword(updatedUser));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid profile data', errors: error.errors });
      }
      console.error('Error updating user:', error);
      res.status(500).json({ message: 'Error updating user' });
    }
  });

  app.post('/api/change-password', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    try {
      const input = changePasswordSchema.parse(req.body);
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const isCurrentPasswordValid = await storage.verifyPassword(input.currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }

      await storage.updateUserPassword(user.id, input.newPassword);
      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid password data', errors: error.errors });
      }
      console.error('Error changing password:', error);
      res.status(500).json({ message: 'Error changing password' });
    }
  });

  // Mobile app messages endpoints
  app.get('/api/messages/chats', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    try {
      // For mobile clients, return admin users they can chat with
      const adminUsers = await storage.getAdminUsers();
      
      const chatUsers = adminUsers.map(admin => ({
        id: admin.id,
        name: admin.fullName || admin.username,
        email: admin.email,
        avatar: null,
        userType: admin.userType,
        lastMessage: null,
        lastMessageTime: null,
        hasUnreadMessages: false,
        unreadCount: 0
      }));
      
      res.json(chatUsers);
    } catch (error) {
      console.error('Error fetching chat users:', error);
      res.status(500).json({ message: 'Error fetching chat users' });
    }
  });

  app.get('/api/messages/:userId', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    try {
      res.set('Cache-Control', 'no-store');
      const otherUserId = parseInt(req.params.userId);
      if (isNaN(otherUserId)) {
        return res.status(400).json({ message: 'Invalid user ID' });
      }

      const otherUser = await storage.getUser(otherUserId);
      let threadMessages;

      if (req.user.userType === USER_TYPES.ADMIN && otherUser?.userType === USER_TYPES.CLIENT) {
        const adminUsers = await storage.getAdminUsers();
        const adminIds = new Set(adminUsers.map((admin) => admin.id));
        const allMessages = await db.select().from(messages);
        threadMessages = allMessages
          .filter((message) => (
            message.senderId === otherUserId && adminIds.has(message.receiverId)
          ) || (
            adminIds.has(message.senderId) && message.receiverId === otherUserId
          ))
          .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
      } else {
        threadMessages = await storage.getMessagesBetweenUsers(req.user.id, otherUserId);
      }

      await Promise.all(
        threadMessages
          .filter(message => message.receiverId === req.user.id && !message.read)
          .map(message => storage.markMessageAsRead(message.id))
      );
      
      // Enhanced messages with sender/receiver names
      const enhancedMessages = await Promise.all(
        threadMessages.map(async message => {
          const sender = await storage.getUser(message.senderId);
          const receiver = await storage.getUser(message.receiverId);
          
          return {
            ...message,
            senderName: sender?.fullName || sender?.username || 'Unknown',
            receiverName: receiver?.fullName || receiver?.username || 'Unknown',
            senderUserType: sender?.userType,
            receiverUserType: receiver?.userType,
            senderAvatar: null,
            receiverAvatar: null
          };
        })
      );
      
      res.json(enhancedMessages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ message: 'Error fetching messages' });
    }
  });
  
  // Mobile app bookings endpoint
  app.get('/api/bookings/client/:clientId', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    try {
      const clientId = parseInt(req.params.clientId);
      if (isNaN(clientId)) {
        return res.status(400).json({ message: 'Invalid client ID' });
      }
      
      // Only allow users to see their own bookings (unless admin)
      if (req.user.userType !== 'admin' && req.user.id !== clientId) {
        return res.status(403).json({ message: 'Unauthorized' });
      }
      
      const bookings = await storage.getBookingsByClient(clientId);
      
      console.log(`Mobile bookings request for client ${clientId}:`, bookings);
      
      // Enhance bookings with vendor/client data and event type info
      const enhancedBookings = await Promise.all(
        bookings.map(async booking => {
          const vendor = booking.vendorId ? await storage.getVendor(booking.vendorId) : null;
          const client = await storage.getUser(booking.clientId);
          let eventType = null;
          if (booking.eventTypeId) {
            eventType = await storage.getEventType(booking.eventTypeId);
          }
          
          return {
            id: booking.id,
            clientId: booking.clientId,
            eventTypeId: booking.eventTypeId,
            vendorId: booking.vendorId,
            status: booking.status,
            eventDate: booking.eventDate,
            eventTime: booking.eventTime,
            location: booking.location,
            guestCount: booking.guestCount,
            budget: booking.budget,
            specialRequests: booking.specialRequests,
            notes: booking.notes,
            totalPrice: booking.totalPrice,
            createdAt: booking.createdAt,
            vendorName: vendor?.businessName || 'سنِّيع',
            clientName: client?.fullName || client?.username,
            eventTypeName: eventType?.name || 'Event'
          };
        })
      );
      
      res.json(enhancedBookings);
    } catch (error) {
      console.error('Error fetching client bookings:', error);
      res.status(500).json({ message: 'Error fetching bookings' });
    }
  });

  app.get('/api/bookings', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    try {
      let bookings;
      
      if (req.user.userType === 'client') {
        bookings = await storage.getBookingsByClient(req.user.id);
      } else if (req.user.userType === 'vendor') {
        const vendor = await storage.getVendorByUserId(req.user.id);
        if (!vendor) {
          return res.status(404).json({ message: 'Vendor profile not found' });
        }
        bookings = await storage.getBookingsByVendor(vendor.id);
      } else if (req.user.userType === 'admin') {
        bookings = await storage.getAllBookings();
      } else {
        return res.status(403).json({ message: 'Unauthorized' });
      }
      
      // Enhance bookings with vendor/client data
      const enhancedBookings = await Promise.all(
        bookings.map(async booking => {
          const vendor = booking.vendorId ? await storage.getVendor(booking.vendorId) : null;
          const client = await storage.getUser(booking.clientId);
          
          return {
            ...booking,
            vendorName: vendor?.businessName,
            clientName: client?.fullName || client?.username
          };
        })
      );
      
      res.json(enhancedBookings);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching bookings' });
    }
  });
  
  app.patch('/api/bookings/:id', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    try {
      const id = parseInt(req.params.id);
      const booking = await storage.getBooking(id);
      
      if (!booking) {
        return res.status(404).json({ message: 'Booking not found' });
      }
      
      // Check authorization: client who made booking, vendor who received it, or admin
      const vendor = await storage.getVendorByUserId(req.user.id);
      const isAdmin = req.user.userType === 'admin';
      const isClient = booking.clientId === req.user.id;
      const isVendor = vendor && booking.vendorId === vendor.id;
      
      if (!isAdmin && !isClient && !isVendor) {
        return res.status(403).json({ message: 'Not authorized to update this booking' });
      }
      
      // Convert string dates to Date objects for timestamp fields
      const updateData = { ...req.body };
      if (updateData.quotationValidUntil && typeof updateData.quotationValidUntil === 'string') {
        const date = new Date(updateData.quotationValidUntil);
        updateData.quotationValidUntil = isNaN(date.getTime()) ? null : date;
      }
      if (updateData.eventDate && typeof updateData.eventDate === 'string') {
        const date = new Date(updateData.eventDate);
        updateData.eventDate = isNaN(date.getTime()) ? null : date;
      }

      if (
        updateData.status &&
        typeof updateData.status === 'string' &&
        !isAdmin &&
        !canTransitionBookingStatus(booking.status, updateData.status)
      ) {
        return res.status(400).json({
          message: `Invalid booking status transition from ${booking.status} to ${updateData.status}`
        });
      }

      if (updateData.status === BOOKING_STATUS.CANCELLED) {
        updateData.cancelledAt = updateData.cancelledAt || new Date();
        updateData.cancelledBy = updateData.cancelledBy || req.user.id;
      }
      
      const updatedBooking = await storage.updateBooking(id, updateData);

      if (updatedBooking && updateData.status && updateData.status !== booking.status) {
        const template =
          updateData.status === BOOKING_STATUS.CONFIRMED
            ? "booking_confirmed"
            : updateData.status === BOOKING_STATUS.CANCELLED
              ? "booking_cancelled"
              : null;

        if (template) {
          sendBookingTemplate({
            bookingId: id,
            template,
            adminId: isAdmin ? req.user.id : undefined,
          }).catch((error) => {
            console.error("Failed to send booking status template:", error);
          });
        }

        syncBookingStatusToErp(id, updateData.status).catch((error) => {
          console.error("Failed to sync booking status to ERP:", error);
        });
      }

      res.json(updatedBooking);
    } catch (error) {
      res.status(500).json({ message: 'Error updating booking' });
    }
  });
  
  app.post('/api/messages', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    try {
      const messageData: InsertMessage = {
        senderId: req.user.id,
        receiverId: req.body.receiverId,
        content: req.body.content,
        read: false,
        createdAt: new Date()
      };
      
      const message = await storage.createMessage(messageData);

      if (req.user.userType === USER_TYPES.ADMIN) {
        const receiver = await storage.getUser(req.body.receiverId);
        if (receiver?.userType === USER_TYPES.CLIENT && receiver.phone) {
          try {
            await whatsappGateway.sendMessage({
              to: receiver.phone,
              body: req.body.content,
              context: {
                source: "admin_chat",
                messageId: message.id,
                senderId: req.user.id,
                receiverId: receiver.id,
              },
            });
            console.log(`WhatsApp admin chat message sent to ${receiver.phone} for user ${receiver.id}`);
          } catch (whatsappError) {
            console.error('WhatsApp gateway send failed for admin chat:', whatsappError);
          }
        }
      }
      
      // Notify recipient via WebSocket if connected
      const recipientConnection = connections.find(conn => conn.userId === req.body.receiverId);
      if (recipientConnection && recipientConnection.socket.readyState === WebSocket.OPEN) {
        recipientConnection.socket.send(JSON.stringify({
          type: 'message',
          sender: req.user.id,
          senderId: req.user.id,
          receiver: req.body.receiverId,
          receiverId: req.body.receiverId,
          content: req.body.content,
          id: message.id,
          timestamp: message.createdAt
        }));
      }
      
      res.status(201).json(message);
    } catch (error) {
      res.status(500).json({ message: 'Error sending message' });
    }
  });
  // Vendor Dashboard Routes
  
  // Get vendor dashboard data
  app.get('/api/vendors/dashboard', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    if (req.user.userType !== 'vendor') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    try {
      // Get vendor profile
      const vendor = await storage.getVendorByUserId(req.user.id);
      
      if (!vendor) {
        return res.status(404).json({ message: 'Vendor profile not found' });
      }
      
      // Get bookings for this vendor
      const bookings = await storage.getBookingsByVendor(vendor.id);
      
      // Get services for this vendor
      const services = await storage.getServicesByVendor(vendor.id);
      
      // Get reviews for this vendor
      const reviews = await storage.getReviewsByVendor(vendor.id);
      
      // Calculate stats
      const totalBookings = bookings.length;
      const pendingBookings = bookings.filter(b => b.status === BOOKING_STATUS.PENDING).length;
      const confirmedBookings = bookings.filter(b => b.status === BOOKING_STATUS.CONFIRMED).length;
      const totalEarnings = bookings
        .filter(b => b.status !== BOOKING_STATUS.CANCELLED)
        .reduce((sum, booking) => sum + (booking.totalPrice || 0), 0);
      
      // Calculate average rating
      const avgRating = reviews.length > 0 
        ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length 
        : 0;
      
      res.json({
        vendor,
        stats: {
          totalBookings,
          pendingBookings,
          confirmedBookings,
          totalEarnings,
          avgRating,
          totalReviews: reviews.length,
          totalServices: services.length
        }
      });
    } catch (error) {
      console.error('Error fetching vendor dashboard:', error);
      res.status(500).json({ message: 'Error fetching vendor dashboard' });
    }
  });
  
  // Get recent bookings for vendor dashboard
  app.get('/api/bookings/recent', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    if (req.user.userType !== 'vendor') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    try {
      const vendor = await storage.getVendorByUserId(req.user.id);
      
      if (!vendor) {
        return res.status(404).json({ message: 'Vendor profile not found' });
      }
      
      // Get all bookings for this vendor
      const allBookings = await storage.getBookingsByVendor(vendor.id);
      
      // Sort by creation date (newest first) and take the first 5
      const recentBookings = allBookings
        .sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        })
        .slice(0, 5);
      
      // Enhance bookings with client names
      const enhancedBookings = await Promise.all(
        recentBookings.map(async booking => {
          const client = await storage.getUser(booking.clientId);
          const service = booking.serviceId ? await storage.getService(booking.serviceId) : null;
          
          return {
            ...booking,
            clientName: client?.fullName || client?.username,
            serviceName: service?.name
          };
        })
      );
      
      res.json(enhancedBookings);
    } catch (error) {
      console.error('Error fetching recent bookings:', error);
      res.status(500).json({ message: 'Error fetching recent bookings' });
    }
  });
  
  // Get vendor-specific bookings with filters
  app.get('/api/vendor/bookings', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    if (req.user.userType !== 'vendor') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    try {
      const vendor = await storage.getVendorByUserId(req.user.id);
      
      if (!vendor) {
        return res.status(404).json({ message: 'Vendor profile not found' });
      }
      
      // Get bookings for this vendor
      const allBookings = await storage.getBookingsByVendor(vendor.id);
      
      // Apply filter based on query param
      const { filter } = req.query;
      let filteredBookings = [...allBookings];
      
      if (filter === 'upcoming') {
        const now = new Date();
        filteredBookings = allBookings.filter(booking => 
          new Date(booking.eventDate) >= now && 
          booking.status !== BOOKING_STATUS.CANCELLED
        );
      } else if (filter === 'pending') {
        filteredBookings = allBookings.filter(booking => 
          booking.status === BOOKING_STATUS.PENDING
        );
      } else if (filter === 'past') {
        const now = new Date();
        filteredBookings = allBookings.filter(booking => 
          new Date(booking.eventDate) < now || 
          booking.status === BOOKING_STATUS.CANCELLED ||
          booking.status === BOOKING_STATUS.COMPLETED
        );
      }
      
      // Enhance bookings with client names and service details
      const enhancedBookings = await Promise.all(
        filteredBookings.map(async booking => {
          const client = await storage.getUser(booking.clientId);
          const service = booking.serviceId ? await storage.getService(booking.serviceId) : null;
          
          return {
            ...booking,
            clientName: client?.fullName || client?.username,
            serviceName: service?.name,
            // For bookings with packages selected
            packageType: req.body.packageType || "Standard"
          };
        })
      );
      
      res.json(enhancedBookings);
    } catch (error) {
      console.error('Error fetching vendor bookings:', error);
      res.status(500).json({ message: 'Error fetching vendor bookings' });
    }
  });
  
  // Get vendor profile
  app.get('/api/vendor/profile', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    if (req.user.userType !== 'vendor') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    try {
      const vendor = await storage.getVendorByUserId(req.user.id);
      
      if (!vendor) {
        return res.status(404).json({ message: 'Vendor profile not found' });
      }
      
      // Return user data along with vendor profile
      const userData = {
        email: req.user.email,
        phone: req.user.phone,
        username: req.user.username,
        fullName: req.user.fullName
      };
      
      res.json({
        ...vendor,
        ...userData
      });
    } catch (error) {
      console.error('Error fetching vendor profile:', error);
      res.status(500).json({ message: 'Error fetching vendor profile' });
    }
  });
  
  // Update vendor profile
  app.put('/api/vendor/profile', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    if (req.user.userType !== 'vendor') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    try {
      const vendor = await storage.getVendorByUserId(req.user.id);
      
      if (!vendor) {
        return res.status(404).json({ message: 'Vendor profile not found' });
      }
      
      // Update user data
      const userUpdates = {
        email: req.body.email,
        phone: req.body.phone,
        fullName: req.body.businessName // Use business name as full name
      };
      
      await storage.updateUser(req.user.id, userUpdates);
      
      // Update vendor data
      const vendorUpdates = {
        businessName: req.body.businessName,
        description: req.body.description,
        address: req.body.address,
        city: req.body.city,
        categories: req.body.categories,
        eventTypes: req.body.eventTypes,
        profileImage: req.body.profileImage
      };
      
      const updatedVendor = await storage.updateVendor(vendor.id, vendorUpdates);
      
      res.json({
        ...updatedVendor,
        ...userUpdates
      });
    } catch (error) {
      console.error('Error updating vendor profile:', error);
      res.status(500).json({ message: 'Error updating vendor profile' });
    }
  });
  
  // Service management routes
  
  // Get all services for the logged-in vendor
  app.get('/api/services', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    if (req.user.userType !== 'vendor') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    try {
      const vendor = await storage.getVendorByUserId(req.user.id);
      
      if (!vendor) {
        return res.status(404).json({ message: 'Vendor profile not found' });
      }
      
      const services = await storage.getServicesByVendor(vendor.id);
      res.json(services);
    } catch (error) {
      console.error('Error fetching services:', error);
      res.status(500).json({ message: 'Error fetching services' });
    }
  });
  
  // Get specific service by ID
  app.get('/api/services/:id', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    try {
      const id = parseInt(req.params.id);
      const service = await storage.getService(id);
      
      if (!service) {
        return res.status(404).json({ message: 'Service not found' });
      }
      
      // Only allow vendors to access their own services
      if (req.user.userType === 'vendor') {
        const vendor = await storage.getVendorByUserId(req.user.id);
        if (!vendor || service.vendorId !== vendor.id) {
          return res.status(403).json({ message: 'Not authorized to access this service' });
        }
      }
      
      res.json(service);
    } catch (error) {
      console.error('Error fetching service:', error);
      res.status(500).json({ message: 'Error fetching service' });
    }
  });
  
  // Create a new service
  app.post('/api/services', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    if (req.user.userType !== 'vendor') {
      return res.status(403).json({ message: 'Not authorized to create services' });
    }
    
    try {
      const vendor = await storage.getVendorByUserId(req.user.id);
      
      if (!vendor) {
        return res.status(404).json({ message: 'Vendor profile not found' });
      }
      
      const serviceData = {
        ...req.body,
        vendorId: vendor.id,
        createdAt: new Date()
      };
      
      const service = await storage.createService(serviceData);
      res.status(201).json(service);
    } catch (error) {
      console.error('Error creating service:', error);
      res.status(500).json({ message: 'Error creating service' });
    }
  });
  
  // Update a service
  app.put('/api/services/:id', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    if (req.user.userType !== 'vendor') {
      return res.status(403).json({ message: 'Not authorized to update services' });
    }
    
    try {
      const id = parseInt(req.params.id);
      const service = await storage.getService(id);
      
      if (!service) {
        return res.status(404).json({ message: 'Service not found' });
      }
      
      const vendor = await storage.getVendorByUserId(req.user.id);
      
      if (!vendor || service.vendorId !== vendor.id) {
        return res.status(403).json({ message: 'Not authorized to update this service' });
      }
      
      const updatedService = await storage.updateService(id, {
        ...req.body,
        updatedAt: new Date()
      });
      
      res.json(updatedService);
    } catch (error) {
      console.error('Error updating service:', error);
      res.status(500).json({ message: 'Error updating service' });
    }
  });
  
  // Get conversations with proper cross-platform routing
  app.get('/api/conversations', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    try {
      res.set('Cache-Control', 'no-store');
      let conversations = [];
      
      if (req.user.userType === 'admin') {
        // Admin sees clients who have submitted bookings or exchanged chat/WhatsApp messages.
        const allBookings = await storage.getAllBookings();
        const adminUsers = await storage.getAdminUsers();
        const adminIds = new Set(adminUsers.map((admin) => admin.id));
        const allUsers = await storage.getAllUsers();
        const clientIdSet = new Set(
          allUsers
            .filter((user) => user.userType === USER_TYPES.CLIENT)
            .map((user) => user.id)
        );
        const allMessages = await db.select().from(messages);

        const clientIds = Array.from(new Set([
          ...allBookings.map(b => b.clientId),
          ...allMessages.flatMap((message) => {
            if (adminIds.has(message.senderId) && clientIdSet.has(message.receiverId)) {
              return [message.receiverId];
            }
            if (clientIdSet.has(message.senderId) && adminIds.has(message.receiverId)) {
              return [message.senderId];
            }
            return [];
          }),
        ]));
        
        conversations = await Promise.all(
          clientIds.map(async clientId => {
            const client = await storage.getUser(clientId);
            if (!client || client.userType !== 'client') return null;
            
            // Get messages between admin and this client
            const messagesBetween = allMessages
              .filter((message) => (
                message.senderId === clientId && adminIds.has(message.receiverId)
              ) || (
                adminIds.has(message.senderId) && message.receiverId === clientId
              ))
              .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
            const lastMessage = messagesBetween.length > 0 
              ? messagesBetween[messagesBetween.length - 1] 
              : null;
            
            const unreadCount = messagesBetween.filter(
              m => adminIds.has(m.receiverId) && !m.read
            ).length;
            
            return {
              userId: client.id,
              username: client.username,
              fullName: client.fullName || client.username,
              phone: client.phone,
              userType: client.userType,
              avatarUrl: client.avatarUrl,
              lastMessage: lastMessage ? {
                id: lastMessage.id,
                content: lastMessage.content,
                createdAt: lastMessage.createdAt,
                senderId: lastMessage.senderId
              } : null,
              unreadCount
            };
          })
        );
      } else {
        // Mobile users see admin conversations
        const adminUsers = await storage.getAdminUsers();
        
        conversations = await Promise.all(
          adminUsers.map(async admin => {
            const messagesBetween = await storage.getMessagesBetweenUsers(req.user.id, admin.id);
            const lastMessage = messagesBetween.length > 0 
              ? messagesBetween[messagesBetween.length - 1] 
              : null;
            
            const unreadCount = messagesBetween.filter(
              m => m.receiverId === req.user.id && !m.read
            ).length;
            
            return {
              userId: admin.id,
              username: admin.username,
              fullName: admin.fullName || 'Admin',
              userType: admin.userType,
              avatarUrl: admin.avatarUrl,
              lastMessage: lastMessage ? {
                id: lastMessage.id,
                content: lastMessage.content,
                createdAt: lastMessage.createdAt,
                senderId: lastMessage.senderId
              } : null,
              unreadCount
            };
          })
        );
      }
      
      // Remove null entries and sort by last message time
      const validConversations = conversations
        .filter(Boolean)
        .sort((a, b) => {
          const timeA = a?.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
          const timeB = b?.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
          return timeB - timeA;
        });
      
      res.json(validConversations);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      res.status(500).json({ message: 'Error fetching conversations' });
    }
  });
  
  // ========== NEW EVENT-BASED BOOKING FLOW ROUTES ==========
  
  // EVENT TYPES ROUTES (Admin)
  
  // Create a new event type (Admin only)
  app.post('/api/admin/event-types', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    if (req.user.userType !== USER_TYPES.ADMIN) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    try {
      // Validate the request body
      const eventTypeData: InsertEventType = {
        name: req.body.name,
        description: req.body.description || '',
        icon: req.body.icon || '',
        isActive: req.body.isActive !== undefined ? req.body.isActive : true,
        createdByType: 'admin',
        createdBy: req.user.id
      };
      
      const eventType = await storage.createEventType(eventTypeData);
      res.status(201).json(eventType);
    } catch (error) {
      console.error('Error creating event type:', error);
      res.status(500).json({ message: 'Error creating event type' });
    }
  });
  
  // Update an event type (Admin only)
  app.put('/api/admin/event-types/:id', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    if (req.user.userType !== USER_TYPES.ADMIN) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    try {
      const id = parseInt(req.params.id);
      const eventType = await storage.getEventType(id);
      
      if (!eventType) {
        return res.status(404).json({ message: 'Event type not found' });
      }
      
      // Update the event type
      const updatedEventType = await storage.updateEventType(id, {
        name: req.body.name !== undefined ? req.body.name : eventType.name,
        description: req.body.description !== undefined ? req.body.description : eventType.description,
        icon: req.body.icon !== undefined ? req.body.icon : eventType.icon,
        isActive: req.body.isActive !== undefined ? req.body.isActive : eventType.isActive,
        updatedAt: new Date()
      });
      
      res.json(updatedEventType);
    } catch (error) {
      console.error('Error updating event type:', error);
      res.status(500).json({ message: 'Error updating event type' });
    }
  });
  
  // Delete an event type (Admin only)
  app.delete('/api/admin/event-types/:id', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    if (req.user.userType !== USER_TYPES.ADMIN) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    try {
      const id = parseInt(req.params.id);
      const eventType = await storage.getEventType(id);
      
      if (!eventType) {
        return res.status(404).json({ message: 'Event type not found' });
      }
      
      // Instead of deleting, we can just mark it as inactive
      await storage.updateEventType(id, { isActive: false });
      
      res.status(204).end();
    } catch (error) {
      console.error('Error deleting event type:', error);
      res.status(500).json({ message: 'Error deleting event type' });
    }
  });
  
  // QUESTIONNAIRE ITEMS ROUTES (Admin)
  
  // Create a new questionnaire item (Admin only)
  app.post('/api/admin/event-types/:eventTypeId/questions', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    if (req.user.userType !== USER_TYPES.ADMIN) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    try {
      const eventTypeId = parseInt(req.params.eventTypeId);
      const eventType = await storage.getEventType(eventTypeId);
      
      if (!eventType) {
        return res.status(404).json({ message: 'Event type not found' });
      }
      
      // Validate the request body
      const questionData: InsertQuestionnaireItem = {
        eventTypeId,
        questionText: req.body.questionText,
        questionType: req.body.questionType,
        options: req.body.options,
        required: req.body.required !== undefined ? req.body.required : false,
        displayOrder: req.body.displayOrder,
        createdBy: req.user.id,
        createdAt: new Date()
      };
      
      const question = await storage.createQuestionnaireItem(questionData);
      res.status(201).json(question);
    } catch (error) {
      console.error('Error creating questionnaire item:', error);
      res.status(500).json({ message: 'Error creating questionnaire item' });
    }
  });
  
  // Update a questionnaire item (Admin only)
  app.put('/api/admin/questions/:id', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    if (req.user.userType !== USER_TYPES.ADMIN) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    try {
      const id = parseInt(req.params.id);
      const question = await storage.getQuestionnaireItem(id);
      
      if (!question) {
        return res.status(404).json({ message: 'Question not found' });
      }
      
      // Update the question
      const updatedQuestion = await storage.updateQuestionnaireItem(id, {
        questionText: req.body.questionText !== undefined ? req.body.questionText : question.questionText,
        questionType: req.body.questionType !== undefined ? req.body.questionType : question.questionType,
        options: req.body.options !== undefined ? req.body.options : question.options,
        required: req.body.required !== undefined ? req.body.required : question.required,
        displayOrder: req.body.displayOrder !== undefined ? req.body.displayOrder : question.displayOrder
      });
      
      res.json(updatedQuestion);
    } catch (error) {
      console.error('Error updating questionnaire item:', error);
      res.status(500).json({ message: 'Error updating questionnaire item' });
    }
  });
  
  // Delete a questionnaire item (Admin only)
  app.delete('/api/admin/questions/:id', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    if (req.user.userType !== USER_TYPES.ADMIN) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    try {
      const id = parseInt(req.params.id);
      const question = await storage.getQuestionnaireItem(id);
      
      if (!question) {
        return res.status(404).json({ message: 'Question not found' });
      }
      
      await storage.deleteQuestionnaireItem(id);
      res.status(204).end();
    } catch (error) {
      console.error('Error deleting questionnaire item:', error);
      res.status(500).json({ message: 'Error deleting questionnaire item' });
    }
  });
  
  // Event submissions now go directly to bookings table via /api/bookings endpoint
  
  // Bookings now handle the complete event flow (replacing event requests)
  
  // EVENT BUNDLE MANAGEMENT API
  
  // Get bundles for an event type
  app.get('/api/event-types/:eventTypeId/bundles', async (req, res) => {
    try {
      const eventTypeId = parseInt(req.params.eventTypeId);
      if (isNaN(eventTypeId)) {
        return res.status(400).json({ message: 'Invalid event type ID' });
      }

      const bundles = await storage.getEventBundlesByEventType(eventTypeId);
      
      // Enhance bundles with their options
      const enhancedBundles = await Promise.all(
        bundles.map(async bundle => {
          const options = await storage.getBundleOptionsByBundle(bundle.id);
          return { ...bundle, options };
        })
      );

      res.json(enhancedBundles);
    } catch (error) {
      console.error('Error fetching event bundles:', error);
      res.status(500).json({ message: 'Failed to fetch event bundles' });
    }
  });

  // Create bundle for event type (Admin/Vendor)
  app.post('/api/event-types/:eventTypeId/bundles', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const canCreate = req.user.userType === 'admin' || req.user.userType === 'vendor';
    if (!canCreate) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    try {
      const eventTypeId = parseInt(req.params.eventTypeId);
      const bundleData: InsertEventBundle = {
        eventTypeId,
        name: req.body.name,
        tier: req.body.tier,
        description: req.body.description,
        basePrice: req.body.basePrice,
        availableQuantity: req.body.availableQuantity || 0,
        totalQuantity: req.body.totalQuantity || 0,
        features: req.body.features || [],
        createdBy: req.user.id,
      };

      const bundle = await storage.createEventBundle(bundleData);
      
      // Create bundle options if provided
      if (req.body.options && Array.isArray(req.body.options)) {
        const options = await Promise.all(
          req.body.options.map((option: any) => 
            storage.createBundleOption({
              bundleId: bundle.id,
              name: option.name,
              description: option.description,
              price: option.price || 0,
              isRequired: option.isRequired || false,
              maxQuantity: option.maxQuantity || 1,
            })
          )
        );
        
        res.status(201).json({ ...bundle, options });
      } else {
        res.status(201).json(bundle);
      }
    } catch (error) {
      console.error('Error creating event bundle:', error);
      res.status(500).json({ message: 'Failed to create event bundle' });
    }
  });

  // VENDOR BOOKING CONFIRMATION SYSTEM
  
  // Vendor approval/rejection of booking
  app.post('/api/bookings/:bookingId/vendor-approval', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    try {
      const bookingId = parseInt(req.params.bookingId);
      const booking = await storage.getBooking(bookingId);
      
      if (!booking) {
        return res.status(404).json({ message: 'Booking not found' });
      }

      // Check if user is authorized (vendor or admin)
      let vendorId: number | null = null;
      if (req.user.userType === 'vendor') {
        const vendor = await storage.getVendorByUserId(req.user.id);
        if (!vendor || booking.vendorId !== vendor.id) {
          return res.status(403).json({ message: 'Not authorized for this booking' });
        }
        vendorId = vendor.id;
      } else if (req.user.userType === 'admin') {
        vendorId = booking.vendorId!;
      } else {
        return res.status(403).json({ message: 'Not authorized' });
      }

      const { status, notes } = req.body;
      if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ message: 'Status must be approved or rejected' });
      }

      // Create booking confirmation record
      const confirmation = await storage.createBookingConfirmation({
        bookingId,
        vendorId: vendorId!,
        status,
        notes,
        confirmedAt: new Date(),
        confirmedBy: req.user.id,
      });

      // Update booking status
      let newBookingStatus: string;
      if (status === 'approved') {
        newBookingStatus = BOOKING_STATUS.VENDOR_APPROVED;
      } else {
        newBookingStatus = BOOKING_STATUS.VENDOR_REJECTED;
      }

      await storage.updateBooking(bookingId, {
        status: newBookingStatus,
        vendorConfirmedAt: new Date(),
        confirmedBy: req.user.id,
        vendorNotes: notes,
      });

      res.json({ confirmation, bookingStatus: newBookingStatus });
    } catch (error) {
      console.error('Error processing vendor approval:', error);
      res.status(500).json({ message: 'Failed to process approval' });
    }
  });

  // ENHANCED BOOKING WITH BUNDLE SUPPORT
  
  // Create booking with bundle and options
  app.post('/api/bookings/with-bundle', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    try {
      const bookingData = bookingWithBundleSchema.parse(req.body);

      const booking = await db.transaction(async (tx) => {
        let totalPrice = 0;
        let basePrice = 0;
        let optionsPrice = 0;

        if (bookingData.bundleId) {
          const [bundle] = await tx
            .select()
            .from(eventBundlesTable)
            .where(eq(eventBundlesTable.id, bookingData.bundleId));

          if (!bundle) {
            throw new Error('Invalid bundle ID');
          }

          const packageItems = await tx
            .select({
              id: bundleItemsTable.id,
              eventItemId: bundleItemsTable.eventItemId,
              defaultOptionId: bundleItemsTable.defaultOptionId,
              quantity: bundleItemsTable.quantity,
              priceOverride: bundleItemsTable.priceOverride,
              defaultPrice: itemVendorOptionsTable.price,
            })
            .from(bundleItemsTable)
            .leftJoin(itemVendorOptionsTable, eq(bundleItemsTable.defaultOptionId, itemVendorOptionsTable.id))
            .where(
              and(
                eq(bundleItemsTable.bundleId, bookingData.bundleId),
                eq(bundleItemsTable.isIncluded, true)
              )
            );

          if (packageItems.length > 0) {
            for (const packageItem of packageItems) {
              const itemQuantity = packageItem.quantity || 1;
              const itemPrice = packageItem.priceOverride ?? packageItem.defaultPrice ?? 0;
              basePrice += itemPrice * itemQuantity;
            }
          } else {
            basePrice = bundle.basePrice;
          }

          totalPrice += basePrice;

          for (const optionSelection of bookingData.selectedOptions) {
            const option = await storage.getBundleOption(optionSelection.optionId);
            if (!option || option.bundleId !== bookingData.bundleId) {
              throw new Error(`Invalid bundle option ID: ${optionSelection.optionId}`);
            }
            if ((option.maxQuantity ?? 1) < optionSelection.quantity) {
              throw new Error(`Quantity exceeds limit for option: ${option.name}`);
            }
            optionsPrice += (option.price || 0) * optionSelection.quantity;
          }

          for (const itemSelection of bookingData.selectedItemOptions) {
            const packageItem = packageItems.find(item => item.eventItemId === itemSelection.eventItemId);
            if (!packageItem) {
              throw new Error(`Event item is not part of this bundle: ${itemSelection.eventItemId}`);
            }

            const [selectedOption] = await tx
              .select()
              .from(itemVendorOptionsTable)
              .where(
                and(
                  eq(itemVendorOptionsTable.id, itemSelection.optionId),
                  eq(itemVendorOptionsTable.eventItemId, itemSelection.eventItemId),
                  eq(itemVendorOptionsTable.isActive, true)
                )
              );

            if (!selectedOption) {
              throw new Error(`Invalid vendor option ID: ${itemSelection.optionId}`);
            }

            const quantity = itemSelection.quantity || packageItem.quantity || 1;
            const defaultPrice = packageItem.priceOverride ?? packageItem.defaultPrice ?? 0;
            optionsPrice += (selectedOption.price - defaultPrice) * quantity;
          }

          totalPrice += optionsPrice;

          const [updatedBundle] = await tx
            .update(eventBundlesTable)
            .set({
              availableQuantity: sql`${eventBundlesTable.availableQuantity} - 1`,
            })
            .where(
              and(
                eq(eventBundlesTable.id, bookingData.bundleId),
                gt(eventBundlesTable.availableQuantity, 0)
              )
            )
            .returning();

          if (!updatedBundle) {
            throw new Error('Bundle not available');
          }
        }

        const [createdBooking] = await tx
          .insert(bookingsTable)
          .values({
            clientId: req.user.id,
            eventTypeId: bookingData.eventTypeId,
            bundleId: bookingData.bundleId || null,
            vendorId: bookingData.vendorId || null,
            serviceId: bookingData.serviceId || null,
            eventDate: bookingData.eventDate,
            eventTime: bookingData.eventTime,
            location: bookingData.location,
            guestCount: bookingData.guestCount,
            budget: bookingData.budget || null,
            specialRequests: bookingData.specialRequests,
            clientAttachments: bookingData.clientAttachments,
            questionnaireResponses: bookingData.questionnaireResponses,
            selectedOptions: {
              addOns: bookingData.selectedOptions,
              itemOptions: bookingData.selectedItemOptions,
            },
            basePrice,
            optionsPrice,
            totalPrice,
            status: BOOKING_STATUS.VENDOR_REVIEW,
          })
          .returning();

        await tx.insert(pricingHistoryTable).values({
          bookingId: createdBooking.id,
          bundleId: bookingData.bundleId || null,
          basePrice,
          additionalOptions: {
            addOns: bookingData.selectedOptions,
            itemOptions: bookingData.selectedItemOptions,
          },
          totalPrice,
          calculatedBy: req.user.id,
        });

        return createdBooking;
      });

      sendBookingTemplate({
        bookingId: booking.id,
        template: "booking_received",
        adminId: req.user.userType === USER_TYPES.ADMIN ? req.user.id : undefined,
      }).catch((error) => {
        console.error("Failed to send booking received template:", error);
      });

      syncBookingToErp(booking.id).catch((error) => {
        console.error("Failed to sync booking to ERP:", error);
      });

      res.status(201).json(booking);
    } catch (error: any) {
      console.error('Error creating booking with bundle:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid booking data', errors: error.errors });
      }
      res.status(400).json({ message: error?.message || 'Failed to create booking' });
    }
  });

  // Payment tracking and provider gateway
  app.get('/api/bookings/:bookingId/payments', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    try {
      const bookingId = parseInt(req.params.bookingId);
      if (isNaN(bookingId)) return res.status(400).json({ message: 'Invalid booking ID' });

      const booking = await storage.getBooking(bookingId);
      if (!booking) return res.status(404).json({ message: 'Booking not found' });

      if (req.user.userType !== 'admin' && booking.clientId !== req.user.id) {
        if (req.user.userType !== 'vendor') {
          return res.status(403).json({ message: 'Not authorized' });
        }
        const vendor = await storage.getVendorByUserId(req.user.id);
        if (!vendor || booking.vendorId !== vendor.id) {
          return res.status(403).json({ message: 'Not authorized' });
        }
      }

      const payments = await db
        .select()
        .from(paymentsTable)
        .where(eq(paymentsTable.bookingId, bookingId))
        .orderBy(paymentsTable.createdAt);

      res.json(payments);
    } catch (error) {
      console.error('Error fetching payments:', error);
      res.status(500).json({ message: 'Failed to fetch payments' });
    }
  });

  app.post('/api/bookings/:bookingId/payments', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    try {
      const bookingId = parseInt(req.params.bookingId);
      if (isNaN(bookingId)) return res.status(400).json({ message: 'Invalid booking ID' });
      const booking = await storage.getBooking(bookingId);
      if (!booking) return res.status(404).json({ message: 'Booking not found' });

      if (req.user.userType !== 'admin' && booking.clientId !== req.user.id) {
        return res.status(403).json({ message: 'Not authorized' });
      }

      const paymentData = paymentCreateSchema.parse(req.body);
      const [payment] = await db
        .insert(paymentsTable)
        .values({
          bookingId,
          type: paymentData.type,
          amount: paymentData.amount,
          status: PAYMENT_STATUS.PENDING,
          dueDate: paymentData.dueDate || null,
        })
        .returning();

      const checkout = await paymentGateway.createCheckout({
        bookingId,
        paymentId: payment.id,
        type: payment.type,
        amount: payment.amount,
        currency: paymentData.currency,
        description: `${payment.type} payment for booking #${bookingId}`,
      });

      const [updatedPayment] = await db
        .update(paymentsTable)
        .set({
          provider: checkout.provider,
          providerPaymentId: checkout.providerPaymentId,
          paymentUrl: checkout.paymentUrl,
          status: checkout.status,
          metadata: checkout.metadata,
          updatedAt: new Date(),
        })
        .where(eq(paymentsTable.id, payment.id))
        .returning();

      sendBookingTemplate({
        bookingId,
        template: paymentData.type === "deposit" ? "deposit_request" : "payment_request",
        adminId: req.user.userType === USER_TYPES.ADMIN ? req.user.id : undefined,
        payment: updatedPayment,
      }).catch((error) => {
        console.error("Failed to send payment request template:", error);
      });

      if (updatedPayment.status === PAYMENT_STATUS.PAID) {
        syncPaymentToErp(updatedPayment).catch((error) => {
          console.error("Failed to sync paid payment to ERP:", error);
        });
      }

      res.status(201).json(updatedPayment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid payment data', errors: error.errors });
      }
      console.error('Error creating payment:', error);
      res.status(500).json({ message: 'Failed to create payment' });
    }
  });

  app.post('/api/payments/:paymentId/mark-paid', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    try {
      const paymentId = parseInt(req.params.paymentId);
      if (isNaN(paymentId)) return res.status(400).json({ message: 'Invalid payment ID' });

      const [payment] = await db
        .update(paymentsTable)
        .set({
          status: PAYMENT_STATUS.PAID,
          paidAt: new Date(),
          confirmedBy: req.user.id,
          updatedAt: new Date(),
        })
        .where(eq(paymentsTable.id, paymentId))
        .returning();

      if (!payment) return res.status(404).json({ message: 'Payment not found' });

      sendBookingTemplate({
        bookingId: payment.bookingId,
        template: "payment_confirmed",
        adminId: req.user.id,
        payment,
      }).catch((error) => {
        console.error("Failed to send payment confirmed template:", error);
      });

      syncPaymentToErp(payment).catch((error) => {
        console.error("Failed to sync payment to ERP:", error);
      });

      res.json(payment);
    } catch (error) {
      console.error('Error marking payment paid:', error);
      res.status(500).json({ message: 'Failed to update payment' });
    }
  });

  app.post('/api/bookings/:bookingId/messages/template', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    if (req.user.userType !== USER_TYPES.ADMIN) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    try {
      const bookingId = parseInt(req.params.bookingId);
      if (isNaN(bookingId)) return res.status(400).json({ message: 'Invalid booking ID' });

      const input = bookingMessageTemplateSchema.parse(req.body);
      const booking = await storage.getBooking(bookingId);
      if (!booking) return res.status(404).json({ message: 'Booking not found' });

      let payment = null;
      if (input.paymentId) {
        const [paymentRow] = await db
          .select()
          .from(paymentsTable)
          .where(and(eq(paymentsTable.id, input.paymentId), eq(paymentsTable.bookingId, bookingId)));
        if (!paymentRow) return res.status(404).json({ message: 'Payment not found for booking' });
        payment = paymentRow;
      }

      const message = await sendBookingTemplate({
        bookingId,
        template: input.template,
        adminId: req.user.id,
        payment,
      });

      res.status(201).json(message);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid template data', errors: error.errors });
      }
      console.error('Error sending booking template:', error);
      res.status(500).json({ message: 'Failed to send booking template' });
    }
  });

  app.post('/api/mobile/payments/:paymentId/receipt', async (req, res) => {
    const mobileUser = await requireMobileClient(req, res);
    if (!mobileUser) return;

    try {
      const paymentId = parseInt(req.params.paymentId);
      if (isNaN(paymentId)) return res.status(400).json({ message: 'Invalid payment ID' });

      const [paymentWithBooking] = await db
        .select({
          payment: paymentsTable,
          clientId: bookingsTable.clientId,
        })
        .from(paymentsTable)
        .leftJoin(bookingsTable, eq(paymentsTable.bookingId, bookingsTable.id))
        .where(eq(paymentsTable.id, paymentId));

      if (!paymentWithBooking?.payment) return res.status(404).json({ message: 'Payment not found' });
      if (paymentWithBooking.clientId !== mobileUser.id) {
        return res.status(403).json({ message: 'Not authorized' });
      }

      const input = paymentReceiptSchema.parse(req.body);
      const [payment] = await db
        .update(paymentsTable)
        .set({
          receiptUrl: input.receiptUrl,
          receiptFileName: input.receiptFileName || null,
          receiptContentType: input.receiptContentType || null,
          receiptSubmittedAt: new Date(),
          status: PAYMENT_STATUS.PROCESSING,
          updatedAt: new Date(),
        })
        .where(eq(paymentsTable.id, paymentId))
        .returning();

      res.json(payment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid receipt data', errors: error.errors });
      }
      console.error('Error submitting payment receipt:', error);
      res.status(500).json({ message: 'Failed to submit payment receipt' });
    }
  });

  // WhatsApp gateway endpoints. Provider-specific webhooks can be routed here
  // later; for now the gateway keeps the rest of the app provider-neutral.
  app.post('/api/admin/whatsapp/send', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    try {
      const input = whatsappSendSchema.parse(req.body);
      const result = await whatsappGateway.sendMessage(input);

      const normalizedPhone = normalizeSaudiPhone(input.to);
      let matchedClient: User | undefined;
      if (normalizedPhone) {
        for (const candidate of phoneLookupCandidates(normalizedPhone)) {
          matchedClient = await storage.getUserByPhone(candidate);
          if (matchedClient) break;
        }
      }

      if (matchedClient?.userType === USER_TYPES.CLIENT) {
        await storage.createMessage({
          senderId: req.user.id,
          receiverId: matchedClient.id,
          content: input.body,
          read: false,
          createdAt: new Date(),
        });
      }

      res.status(202).json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid WhatsApp message data', errors: error.errors });
      }
      console.error('Error sending WhatsApp message:', error);
      res.status(500).json({ message: 'Failed to send WhatsApp message' });
    }
  });

  app.post('/api/admin/push/send', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    try {
      const input = pushSendSchema.parse(req.body);
      const devices = await db
        .select()
        .from(pushNotificationDevicesTable)
        .where(
          and(
            eq(pushNotificationDevicesTable.userId, input.userId),
            eq(pushNotificationDevicesTable.enabled, true)
          )
        );

      const results = await pushNotificationGateway.sendToTokens({
        tokens: devices.map((device) => device.token),
        title: input.title,
        body: input.body,
        data: input.data,
      });

      res.status(202).json({ sent: results.length, results });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid push notification data', errors: error.errors });
      }
      console.error('Error sending push notification:', error);
      res.status(500).json({ message: 'Failed to send push notification' });
    }
  });

  app.post('/api/webhooks/whatsapp/:provider', async (req, res) => {
    const expectedToken = process.env.ULTRAMSG_WEBHOOK_TOKEN;
    const suppliedToken = req.query.token || req.headers["x-webhook-token"];

    if (expectedToken && suppliedToken !== expectedToken) {
      return res.status(401).json({ message: "Invalid webhook token" });
    }

    try {
      const incoming = extractIncomingWhatsappMessage(req.body);
      const phone = normalizeSaudiPhone(incoming.from);

      if (incoming.fromMe) {
        return res.status(202).json({
          accepted: true,
          provider: req.params.provider,
          ignored: true,
          reason: "outbound_echo",
        });
      }

      if (!phone || !incoming.body) {
        return res.status(202).json({
          accepted: true,
          provider: req.params.provider,
          stored: false,
          reason: "missing_phone_or_body",
        });
      }

      const client = await findOrCreateWhatsappClient(phone);
      const admin = await pickWhatsappAdminForClient(client.id);

      if (!admin) {
        return res.status(202).json({
          accepted: true,
          provider: req.params.provider,
          stored: false,
          reason: "no_admin_user",
          clientId: client.id,
        });
      }

      const message = await storage.createMessage({
        senderId: client.id,
        receiverId: admin.id,
        content: incoming.body,
        read: false,
        createdAt: new Date(),
      });

      const recipientConnection = connections.find(conn => conn.userId === admin.id);
      if (recipientConnection && recipientConnection.socket.readyState === WebSocket.OPEN) {
        recipientConnection.socket.send(JSON.stringify({
          type: 'message',
          sender: client.id,
          senderId: client.id,
          receiver: admin.id,
          receiverId: admin.id,
          content: incoming.body,
          id: message.id,
          timestamp: message.createdAt
        }));
      }

      res.status(202).json({
        accepted: true,
        provider: req.params.provider,
        stored: true,
        messageId: message.id,
        providerMessageId: incoming.providerMessageId,
        clientId: client.id,
        adminId: admin.id,
        type: incoming.type,
      });
    } catch (error) {
      console.error('WhatsApp webhook handling failed:', error);
      res.status(500).json({ message: 'Failed to handle WhatsApp webhook' });
    }
  });

  app.post('/api/webhooks/payments/:provider', async (req, res) => {
    res.status(202).json({
      accepted: true,
      provider: req.params.provider,
    });
  });

  // VENDOR EVENT CREATION
  
  // Create event type (Vendor)
  app.post('/api/vendor/event-types', async (req, res) => {
    if (!req.isAuthenticated() || req.user.userType !== 'vendor') {
      return res.status(403).json({ message: 'Vendor access required' });
    }

    try {
      const vendor = await storage.getVendorByUserId(req.user.id);
      if (!vendor) {
        return res.status(400).json({ message: 'Vendor profile not found' });
      }

      const eventTypeData: InsertEventType = {
        name: req.body.name,
        description: req.body.description,
        icon: req.body.icon,
        category: req.body.category,
        createdByType: 'vendor',
        createdBy: req.user.id,
        vendorId: vendor.id,
        requiresApproval: true, // Vendor-created events need approval
        isActive: false, // Start inactive until approved
      };

      const eventType = await storage.createEventType(eventTypeData);
      res.status(201).json(eventType);
    } catch (error) {
      console.error('Error creating vendor event type:', error);
      res.status(500).json({ message: 'Failed to create event type' });
    }
  });

  // Admin event type approval
  app.patch('/api/admin/event-types/:id/approve', async (req, res) => {
    if (!req.isAuthenticated() || req.user.userType !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    try {
      const id = parseInt(req.params.id);
      const eventType = await storage.updateEventType(id, {
        isActive: true,
        requiresApproval: false,
        approvedBy: req.user.id,
        approvedAt: new Date(),
      });

      if (!eventType) {
        return res.status(404).json({ message: 'Event type not found' });
      }

      res.json(eventType);
    } catch (error) {
      console.error('Error approving event type:', error);
      res.status(500).json({ message: 'Failed to approve event type' });
    }
  });

  return httpServer;
}
