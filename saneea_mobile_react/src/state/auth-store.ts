import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type MobileUser = {
  id: number;
  username: string;
  email: string;
  fullName: string;
  phone?: string | null;
  userType: string;
};

type AuthState = {
  token: string | null;
  user: MobileUser | null;
  language: "ar" | "en";
  hasHydrated: boolean;
  setSession: (token: string, user: MobileUser) => void;
  setLanguage: (language: "ar" | "en") => void;
  setHasHydrated: (hasHydrated: boolean) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      language: "ar",
      hasHydrated: false,
      setSession: (token, user) => set({ token, user }),
      setLanguage: (language) => set({ language }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
      logout: () => set({ token: null, user: null }),
    }),
    {
      name: "saneea-auth",
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
