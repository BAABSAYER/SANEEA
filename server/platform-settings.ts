import { sql } from "drizzle-orm";
import { db } from "./db";

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

export const DEFAULT_AVAILABLE_CITIES: CityOption[] = [
  { value: "Riyadh", labelAr: "الرياض", labelEn: "Riyadh", active: true, displayOrder: 1 },
  { value: "Jeddah", labelAr: "جدة", labelEn: "Jeddah", active: true, displayOrder: 2 },
  { value: "Makkah", labelAr: "مكة", labelEn: "Makkah", active: true, displayOrder: 3 },
  { value: "Madinah", labelAr: "المدينة المنورة", labelEn: "Madinah", active: true, displayOrder: 4 },
  { value: "Dammam", labelAr: "الدمام", labelEn: "Dammam", active: true, displayOrder: 5 },
  { value: "Khobar", labelAr: "الخبر", labelEn: "Khobar", active: true, displayOrder: 6 },
  { value: "Dhahran", labelAr: "الظهران", labelEn: "Dhahran", active: true, displayOrder: 7 },
  { value: "Taif", labelAr: "الطائف", labelEn: "Taif", active: true, displayOrder: 8 },
  { value: "Tabuk", labelAr: "تبوك", labelEn: "Tabuk", active: true, displayOrder: 9 },
  { value: "Abha", labelAr: "أبها", labelEn: "Abha", active: true, displayOrder: 10 },
  { value: "Hail", labelAr: "حائل", labelEn: "Hail", active: true, displayOrder: 11 },
  { value: "Qassim", labelAr: "القصيم", labelEn: "Qassim", active: true, displayOrder: 12 },
  { value: "Jazan", labelAr: "جازان", labelEn: "Jazan", active: true, displayOrder: 13 },
  { value: "Najran", labelAr: "نجران", labelEn: "Najran", active: true, displayOrder: 14 },
  { value: "Al Ahsa", labelAr: "الأحساء", labelEn: "Al Ahsa", active: true, displayOrder: 15 },
  { value: "Yanbu", labelAr: "ينبع", labelEn: "Yanbu", active: true, displayOrder: 16 },
];

const EVENT_SETTINGS_KEY = "event_settings";

let settingsTableReady = false;

async function ensureSettingsTable() {
  if (settingsTableReady) return;

  await db.execute(sql`
    create table if not exists app_settings (
      key text primary key,
      value jsonb not null,
      updated_at timestamp default now()
    )
  `);

  settingsTableReady = true;
}

function normalizeCity(city: Partial<CityOption>, index: number): CityOption | null {
  const value = String(city.value || city.labelEn || city.labelAr || "").trim();
  const labelAr = String(city.labelAr || value).trim();
  const labelEn = String(city.labelEn || value).trim();

  if (!value || !labelAr || !labelEn) return null;

  return {
    value,
    labelAr,
    labelEn,
    active: city.active !== false,
    displayOrder: Number.isFinite(Number(city.displayOrder)) ? Number(city.displayOrder) : index + 1,
  };
}

function normalizeCities(cities: unknown): CityOption[] {
  if (!Array.isArray(cities)) return DEFAULT_AVAILABLE_CITIES;

  const seen = new Set<string>();
  const normalized: CityOption[] = [];

  cities.forEach((city, index) => {
    const normalizedCity = city && typeof city === "object"
      ? normalizeCity(city as Partial<CityOption>, index)
      : null;
    if (!normalizedCity) return;

    const key = normalizedCity.value.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    normalized.push(normalizedCity);
  });

  return normalized.length > 0
    ? normalized.sort((a, b) => a.displayOrder - b.displayOrder)
    : DEFAULT_AVAILABLE_CITIES;
}

export function normalizeEventSettings(value: unknown): EventSettings {
  const root = value && typeof value === "object" ? value as Record<string, unknown> : {};

  return {
    availableCities: normalizeCities(root.availableCities),
  };
}

export async function getEventSettings(): Promise<EventSettings> {
  await ensureSettingsTable();

  const result = await db.execute(sql`
    select value from app_settings where key = ${EVENT_SETTINGS_KEY} limit 1
  `);

  const rows = Array.isArray((result as any).rows) ? (result as any).rows : [];
  const existing = rows[0]?.value;
  if (existing) return normalizeEventSettings(existing);

  const defaults = { availableCities: DEFAULT_AVAILABLE_CITIES };
  await saveEventSettings(defaults);
  return defaults;
}

export async function saveEventSettings(input: unknown): Promise<EventSettings> {
  await ensureSettingsTable();

  const settings = normalizeEventSettings(input);

  await db.execute(sql`
    insert into app_settings (key, value, updated_at)
    values (${EVENT_SETTINGS_KEY}, ${JSON.stringify(settings)}::jsonb, now())
    on conflict (key)
    do update set value = excluded.value, updated_at = now()
  `);

  return settings;
}

export function activeCityValues(settings: EventSettings) {
  return new Set(
    settings.availableCities
      .filter((city) => city.active)
      .map((city) => city.value.toLowerCase())
  );
}
