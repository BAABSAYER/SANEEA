import { apiRequest } from "./client";
import type { MobileUser } from "../state/auth-store";

export type EventType = {
  id: number;
  name: string;
  description?: string | null;
  icon?: string | null;
  category?: string | null;
  images: string[];
  videos: string[];
  availableCities?: CityOption[];
  packageCount: number;
  itemCount: number;
};

export type EventPackageItem = {
  id?: number;
  bundleItemId?: number;
  eventItemId: number;
  itemName: string;
  itemDescription?: string | null;
  itemCategory?: string | null;
  optionName?: string | null;
  optionDescription?: string | null;
  optionPrice?: number | null;
  optionImages?: string[] | null;
  vendorName?: string | null;
  quantity?: number;
  priceOverride?: number | null;
};

export type EventPackage = {
  id: number;
  templateId?: number;
  eventTypeId: number;
  sourceBundleId?: number | null;
  name: string;
  tier: string;
  description?: string | null;
  features: string[];
  tags?: string[];
  images: string[];
  videos: string[];
  basePrice: number;
  estimatedMinPrice?: number | null;
  estimatedMaxPrice?: number | null;
  calculatedBasePrice: number;
  availableQuantity?: number;
  items: EventPackageItem[];
};

export type EventTemplate = EventPackage;

export type EventTypeDetail = EventType & {
  items: Array<{
    id: number;
    name: string;
    description?: string | null;
    category?: string | null;
    isRequired?: boolean | null;
  }>;
  packages: EventPackage[];
  templates?: EventTemplate[];
};

export type VendorOption = {
  id: number;
  eventItemId: number;
  vendorId: number;
  optionName: string;
  description?: string | null;
  price: number;
  images: string[];
  isDefault?: boolean;
  vendorName?: string | null;
  vendorCategory?: string | null;
  vendorRating?: string | number | null;
};

export type CustomizationItem = {
  bundleItemId: number;
  templateItemId?: number;
  eventItemId: number;
  defaultOptionId?: number | null;
  quantity: number;
  priceOverride?: number | null;
  itemName: string;
  itemDescription?: string | null;
  itemCategory?: string | null;
  isRequired?: boolean;
  images?: string[];
  videos?: string[];
  vendorOptions: VendorOption[];
  defaultOption: VendorOption | null;
};

export type PackageCustomization = {
  eventType: EventType;
  package: EventPackage;
  template?: EventTemplate;
  items: CustomizationItem[];
};

export type BookingSummary = {
  id: number;
  status: string;
  eventDate: string;
  eventTime?: string | null;
  location: string;
  guestCount: number;
  budget?: number | null;
  totalPrice: number;
  basePrice?: number | null;
  optionsPrice?: number | null;
  quotationNotes?: string | null;
  quotationValidUntil?: string | null;
  eventTypeName?: string | null;
  eventTypeIcon?: string | null;
  eventTypeImages: string[];
  templateId?: number | null;
  templateName?: string | null;
  bundleName?: string | null;
  bundleTier?: string | null;
};

export type PaymentRequest = {
  id: number;
  bookingId: number;
  type: "deposit" | "final" | string;
  amount: number;
  status: string;
  provider?: string | null;
  providerPaymentId?: string | null;
  paymentUrl?: string | null;
  receiptUrl?: string | null;
  receiptFileName?: string | null;
  receiptContentType?: string | null;
  receiptSubmittedAt?: string | null;
  dueDate?: string | null;
  paidAt?: string | null;
};

export type BookingProposalItem = {
  id: number;
  proposalId: number;
  title: string;
  description?: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  vendorId?: number | null;
  eventItemId?: number | null;
};

export type BookingProposal = {
  id: number;
  bookingId: number;
  status: string;
  totalPrice: number;
  depositAmount?: number | null;
  finalAmount?: number | null;
  notes?: string | null;
  validUntil?: string | null;
  sentAt?: string | null;
  acceptedAt?: string | null;
  rejectedAt?: string | null;
  items: BookingProposalItem[];
};

type UploadIntent = {
  provider: "s3";
  bucket: string;
  key: string;
  publicUrl: string;
  uploadUrl: string | null;
  headers: Record<string, string>;
};

export type QuestionnaireItem = {
  id: number;
  eventTypeId: number;
  questionText: string;
  questionType: "text" | "textarea" | "number" | "select" | "checkbox" | "date" | "time" | string;
  options?: Array<string | { id?: number; value: string; labelAr?: string; labelEn?: string | null; imageUrl?: string | null }> | null;
  required?: boolean | null;
  displayOrder?: number | null;
};

export type CityOption = {
  value: string;
  labelAr: string;
  labelEn: string;
  active: boolean;
  displayOrder: number;
};

export type EventSettings = {
  availableCities: CityOption[];
};

export function requestSignupOtp(input: { phone: string; fullName: string; password: string }) {
  return apiRequest<{ phone: string; expiresInSeconds: number; devCode?: string }>("/api/mobile/auth/signup/request-otp", {
    method: "POST",
    auth: false,
    body: JSON.stringify(input),
  });
}

export function verifySignupOtp(input: { phone: string; code: string; fullName: string; password: string }) {
  return apiRequest<MobileUser & { user: MobileUser; token: string }>("/api/mobile/auth/signup/verify-otp", {
    method: "POST",
    auth: false,
    body: JSON.stringify(input),
  });
}

export function loginWithPhone(input: { phone: string; password: string }) {
  return apiRequest<MobileUser & { user: MobileUser; token: string }>("/api/mobile/auth/login", {
    method: "POST",
    auth: false,
    body: JSON.stringify(input),
  });
}

export function requestPasswordResetOtp(input: { phone: string }) {
  return apiRequest<{ phone: string; expiresInSeconds: number; devCode?: string }>("/api/mobile/auth/password-reset/request-otp", {
    method: "POST",
    auth: false,
    body: JSON.stringify(input),
  });
}

export function verifyPasswordResetOtp(input: { phone: string; code: string; password: string }) {
  return apiRequest<MobileUser & { user: MobileUser; token: string }>("/api/mobile/auth/password-reset/verify-otp", {
    method: "POST",
    auth: false,
    body: JSON.stringify(input),
  });
}

export function deleteMobileAccount() {
  return apiRequest<void>("/api/mobile/account", {
    method: "DELETE",
  });
}

export function getEventTypes() {
  return apiRequest<EventType[]>("/api/mobile/event-types", { auth: false });
}

export function getEventPackages(eventTypeId: number) {
  return apiRequest<EventPackage[]>(`/api/mobile/event-types/${eventTypeId}/packages`, { auth: false });
}

export function getEventTemplates(eventTypeId: number) {
  return apiRequest<EventTemplate[]>(`/api/mobile/event-types/${eventTypeId}/templates`, { auth: false });
}

export function getEventTypeDetail(eventTypeId: number) {
  return apiRequest<EventTypeDetail>(`/api/mobile/event-types/${eventTypeId}`, { auth: false });
}

export function getPackageCustomization(packageId: number) {
  return apiRequest<PackageCustomization>(`/api/mobile/packages/${packageId}/customization`, { auth: false });
}

export function getTemplateCustomization(templateId: number) {
  return apiRequest<PackageCustomization>(`/api/mobile/templates/${templateId}/customization`, { auth: false });
}

export function getQuestionnaireItems(eventTypeId: number) {
  return apiRequest<QuestionnaireItem[]>(`/api/event-types/${eventTypeId}/questionnaire-items`, { auth: false });
}

export function getEventSettings() {
  return apiRequest<EventSettings>("/api/mobile/event-settings", { auth: false });
}

export function createBooking(input: {
  eventTypeId: number;
  templateId?: number | null;
  bundleId?: number | null;
  eventDate: string;
  eventTime?: string;
  location: string;
  guestCount: number;
  specialRequests?: string;
  budget?: number | null;
  clientAttachments?: Array<{ url: string; fileName?: string | null; contentType?: string | null }>;
  questionnaireResponses?: Record<string, unknown>;
  selectedItemOptions: Array<{ eventItemId: number; optionId: number; quantity: number }>;
}) {
  return apiRequest<BookingSummary>("/api/mobile/bookings", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getBookings() {
  return apiRequest<BookingSummary[]>("/api/mobile/bookings");
}

export function getBooking(id: number) {
  return apiRequest<BookingSummary & { packageItems: EventPackageItem[]; payments: PaymentRequest[]; proposal?: BookingProposal | null }>(`/api/mobile/bookings/${id}`);
}

export function acceptBookingProposal(bookingId: number) {
  return apiRequest<BookingSummary>(`/api/mobile/bookings/${bookingId}/proposal/accept`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function rejectBookingProposal(bookingId: number, note?: string) {
  return apiRequest<BookingSummary>(`/api/mobile/bookings/${bookingId}/proposal/reject`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
}

export function createMobileUploadIntent(input: { filename: string; contentType: string; folder?: string }) {
  return apiRequest<UploadIntent>("/api/mobile/media/upload-intent", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function uploadMobileFile(input: {
  uri: string;
  filename: string;
  contentType: string;
  folder?: string;
}) {
  const intent = await createMobileUploadIntent({
    filename: input.filename,
    contentType: input.contentType,
    folder: input.folder,
  });
  if (!intent.uploadUrl) {
    throw new Error("uploadNotConfigured");
  }

  const fileResponse = await fetch(input.uri);
  const blob = await fileResponse.blob();
  const uploadResponse = await fetch(intent.uploadUrl, {
    method: "PUT",
    headers: intent.headers,
    body: blob,
  });
  if (!uploadResponse.ok) {
    throw new Error("uploadAttachmentFailed");
  }

  return {
    url: intent.publicUrl,
    fileName: input.filename,
    contentType: input.contentType,
  };
}

export function submitPaymentReceipt(input: {
  paymentId: number;
  receiptUrl: string;
  receiptFileName?: string | null;
  receiptContentType?: string | null;
}) {
  return apiRequest<PaymentRequest>(`/api/mobile/payments/${input.paymentId}/receipt`, {
    method: "POST",
    body: JSON.stringify({
      receiptUrl: input.receiptUrl,
      receiptFileName: input.receiptFileName,
      receiptContentType: input.receiptContentType,
    }),
  });
}

export function registerPushDevice(input: { token: string; provider?: string; platform?: string | null }) {
  return apiRequest<{ id: number; token: string; provider: string; platform?: string | null }>("/api/mobile/push-devices", {
    method: "POST",
    body: JSON.stringify({
      provider: "expo",
      ...input,
    }),
  });
}
