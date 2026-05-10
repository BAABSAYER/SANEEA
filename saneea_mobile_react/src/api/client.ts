import Constants from "expo-constants";
import { Platform } from "react-native";
import { useAuthStore } from "../state/auth-store";

function getExpoHost() {
  const constants = Constants as typeof Constants & {
    manifest?: { debuggerHost?: string };
    manifest2?: { extra?: { expoClient?: { hostUri?: string } } };
  };
  const hostUri =
    Constants.expoConfig?.hostUri ||
    constants.manifest2?.extra?.expoClient?.hostUri ||
    constants.manifest?.debuggerHost;

  return hostUri?.split(":")[0];
}

const expoHost = getExpoHost();
const fallbackHost =
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === "web"
    ? "http://localhost:5000"
    : expoHost
      ? `http://${expoHost}:5000`
      : Platform.OS === "android"
        ? "http://10.0.2.2:5000"
        : "http://localhost:5000");
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || fallbackHost;

type RequestOptions = RequestInit & {
  auth?: boolean;
};

const localizedErrors: Record<string, { ar: string; en: string }> = {
  "This phone number is already registered. Please log in with your password.": {
    ar: "رقم الجوال مسجل مسبقا. الرجاء تسجيل الدخول بكلمة المرور.",
    en: "This phone number is already registered. Please log in with your password.",
  },
  "This phone number is already registered. Please log in.": {
    ar: "رقم الجوال مسجل مسبقا. الرجاء تسجيل الدخول.",
    en: "This phone number is already registered. Please log in.",
  },
  "Invalid phone number or password": {
    ar: "رقم الجوال أو كلمة المرور غير صحيحة.",
    en: "Invalid phone number or password.",
  },
  "Enter a valid Saudi mobile number": {
    ar: "أدخل رقم جوال سعودي صحيح.",
    en: "Enter a valid Saudi mobile number.",
  },
  "OTP not found or already used": {
    ar: "رمز التحقق غير موجود أو تم استخدامه مسبقا.",
    en: "OTP not found or already used.",
  },
  "OTP expired": {
    ar: "انتهت صلاحية رمز التحقق.",
    en: "OTP expired.",
  },
  "Too many OTP attempts": {
    ar: "محاولات كثيرة لرمز التحقق. حاول لاحقا.",
    en: "Too many OTP attempts.",
  },
  "Invalid OTP code": {
    ar: "رمز التحقق غير صحيح.",
    en: "Invalid OTP code.",
  },
  "No client account found for this phone number.": {
    ar: "لا يوجد حساب عميل لهذا الرقم.",
    en: "No client account found for this phone number.",
  },
  "Not authenticated": {
    ar: "الرجاء تسجيل الدخول أولا.",
    en: "Please log in first.",
  },
  "Client account required": {
    ar: "هذا الإجراء متاح لحسابات العملاء فقط.",
    en: "Client account required.",
  },
};

function localizeErrorMessage(message: string) {
  const language = useAuthStore.getState().language;
  const normalized = message.startsWith("Authentica send OTP failed")
    ? "تعذر إرسال رمز التحقق. حاول مرة أخرى."
    : message.startsWith("Authentica verify OTP failed")
      ? "تعذر التحقق من الرمز. حاول مرة أخرى."
      : message;

  if (normalized.startsWith("تعذر")) return language === "ar" ? normalized : "OTP service error. Please try again.";
  return localizedErrors[message]?.[language] || message;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = useAuthStore.getState().token;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (options.auth !== false && token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(localizeErrorMessage(data?.message || `Request failed (${response.status})`));
  }
  return data as T;
}
