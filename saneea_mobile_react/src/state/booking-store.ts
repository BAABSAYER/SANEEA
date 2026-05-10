import { create } from "zustand";
import type { EventPackage, PackageCustomization } from "../api/mobile";

export type SelectedItemOption = {
  eventItemId: number;
  optionId: number;
  quantity: number;
};

type BookingDraft = {
  eventTypeId: number | null;
  packageId: number | null;
  packageData: EventPackage | null;
  customization: PackageCustomization | null;
  selectedItemOptions: SelectedItemOption[];
  questionnaireResponses: Record<string, unknown>;
  eventDate: string;
  eventTime: string;
  location: string;
  guestCount: string;
  budget: string;
  specialRequests: string;
  clientAttachments: Array<{ url: string; fileName?: string | null; contentType?: string | null }>;
  setPackage: (eventTypeId: number, packageData: EventPackage) => void;
  setCustomization: (customization: PackageCustomization) => void;
  selectItemOption: (selection: SelectedItemOption) => void;
  setDetails: (details: Partial<Pick<BookingDraft, "eventDate" | "eventTime" | "location" | "guestCount" | "budget" | "specialRequests" | "clientAttachments">>) => void;
  setQuestionResponse: (questionId: number, response: unknown) => void;
  totalPrice: () => number;
  reset: () => void;
};

const initialDraft = {
  eventTypeId: null,
  packageId: null,
  packageData: null,
  customization: null,
  selectedItemOptions: [],
  questionnaireResponses: {},
  eventDate: "",
  eventTime: "",
  location: "",
  guestCount: "",
  budget: "",
  specialRequests: "",
  clientAttachments: [],
};

export const useBookingStore = create<BookingDraft>((set, get) => ({
  ...initialDraft,
  setPackage: (eventTypeId, packageData) =>
    set({
      eventTypeId,
      packageId: packageData.id,
      packageData,
      selectedItemOptions: [],
    }),
  setCustomization: (customization) => set({ customization }),
  selectItemOption: (selection) =>
    set((state) => ({
      selectedItemOptions: [
        ...state.selectedItemOptions.filter((item) => item.eventItemId !== selection.eventItemId),
        selection,
      ],
    })),
  setDetails: (details) => set(details),
  setQuestionResponse: (questionId, response) =>
    set((state) => ({
      questionnaireResponses: {
        ...state.questionnaireResponses,
        [String(questionId)]: response,
      },
    })),
  totalPrice: () => {
    const state = get();
    const customization = state.customization;
    if (!customization) return state.packageData?.calculatedBasePrice || state.packageData?.basePrice || 0;

    return customization.items.reduce((sum, item) => {
      const selected = state.selectedItemOptions.find((choice) => choice.eventItemId === item.eventItemId);
      const option = item.vendorOptions.find((vendorOption) => vendorOption.id === selected?.optionId) || item.defaultOption;
      const price = item.priceOverride ?? option?.price ?? 0;
      return sum + price * (selected?.quantity || item.quantity || 1);
    }, 0);
  },
  reset: () => set(initialDraft),
}));
