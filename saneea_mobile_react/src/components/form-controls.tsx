import { ReactNode, useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Button, Field, styles as uiStyles } from "./ui";
import { colors, radius } from "../theme/colors";
import { CityOption, getEventSettings } from "../api/mobile";

type PickerOption = {
  label: string;
  value: string;
};

function toDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeStartOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function resolveDate(value: string) {
  if (!value) return new Date();
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
}

function Sheet({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal animationType="slide" transparent visible={open} onRequestClose={onClose}>
      <Pressable style={localStyles.overlay} onPress={onClose}>
        <Pressable style={localStyles.sheet}>
          <View style={localStyles.sheetHeader}>
            <Text style={localStyles.sheetTitle}>{title}</Text>
            <Pressable onPress={onClose} style={localStyles.closeButton}>
              <Text style={localStyles.closeText}>X</Text>
            </Pressable>
          </View>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function SelectField({
  label,
  value,
  placeholder,
  options,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: PickerOption[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <View style={uiStyles.fieldWrap}>
      <Text style={uiStyles.label}>{label}</Text>
      <Pressable style={localStyles.selectButton} onPress={() => setOpen(true)}>
        <Text style={[localStyles.selectText, !selected && localStyles.placeholder]}>
          {selected?.label || placeholder}
        </Text>
      </Pressable>
      <Sheet title={label} open={open} onClose={() => setOpen(false)}>
        <ScrollView style={localStyles.optionScroll} contentContainerStyle={localStyles.optionList} showsVerticalScrollIndicator={false}>
          {options.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => {
                onChange(option.value);
                setOpen(false);
              }}
              style={[localStyles.optionRow, option.value === value && localStyles.optionRowActive]}
            >
              <Text style={[localStyles.optionText, option.value === value && localStyles.optionTextActive]}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </Sheet>
    </View>
  );
}

export function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { i18n, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const locale = i18n.language === "ar" ? "ar-SA" : "en-US";
  const monthFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }), [locale]);
  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric" }), [locale]);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const date = resolveDate(value);
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });

  const today = normalizeStartOfDay(new Date());
  const selectedDate = value ? normalizeStartOfDay(resolveDate(value)) : null;
  const displayValue = selectedDate ? dateFormatter.format(selectedDate) : "";
  const days = useMemo(() => {
    const firstDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
    const startOffset = firstDay.getDay();
    const daysInMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate();
    const result: Array<Date | null> = Array.from({ length: startOffset }, () => null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      result.push(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day));
    }
    return result;
  }, [visibleMonth]);

  return (
    <View style={uiStyles.fieldWrap}>
      <Text style={uiStyles.label}>{label}</Text>
      <Pressable style={localStyles.selectButton} onPress={() => setOpen(true)}>
        <Text style={[localStyles.selectText, !displayValue && localStyles.placeholder]}>
          {displayValue || t("selectDate")}
        </Text>
      </Pressable>
      <Sheet title={label} open={open} onClose={() => setOpen(false)}>
        <View style={localStyles.monthHeader}>
          <Pressable
            style={localStyles.iconButton}
            onPress={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))}
          >
            <Text style={localStyles.iconButtonText}>{"<"}</Text>
          </Pressable>
          <Text style={localStyles.monthTitle}>{monthFormatter.format(visibleMonth)}</Text>
          <Pressable
            style={localStyles.iconButton}
            onPress={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))}
          >
            <Text style={localStyles.iconButtonText}>{">"}</Text>
          </Pressable>
        </View>
        <View style={localStyles.yearHeader}>
          <Pressable
            style={localStyles.yearButton}
            onPress={() => setVisibleMonth(new Date(visibleMonth.getFullYear() - 1, visibleMonth.getMonth(), 1))}
          >
            <Text style={localStyles.yearButtonText}>- {visibleMonth.getFullYear() - 1}</Text>
          </Pressable>
          <Pressable
            style={localStyles.yearButton}
            onPress={() => setVisibleMonth(new Date(visibleMonth.getFullYear() + 1, visibleMonth.getMonth(), 1))}
          >
            <Text style={localStyles.yearButtonText}>+ {visibleMonth.getFullYear() + 1}</Text>
          </Pressable>
        </View>
        <View style={localStyles.weekGrid}>
          {(i18n.language === "ar" ? ["أ", "إ", "ث", "أ", "خ", "ج", "س"] : ["S", "M", "T", "W", "T", "F", "S"]).map((day, index) => (
            <Text key={`${day}-${index}`} style={localStyles.weekLabel}>{day}</Text>
          ))}
          {days.map((date, index) => {
            const disabled = !date || normalizeStartOfDay(date) < today;
            const active = !!date && selectedDate?.getTime() === normalizeStartOfDay(date).getTime();
            return (
              <Pressable
                key={date ? toDateValue(date) : `blank-${index}`}
                disabled={disabled}
                onPress={() => {
                  if (!date) return;
                  onChange(toDateValue(date));
                  setOpen(false);
                }}
                style={[localStyles.dayCell, active && localStyles.dayCellActive, disabled && localStyles.dayCellDisabled]}
              >
                <Text style={[localStyles.dayText, active && localStyles.dayTextActive, disabled && localStyles.dayTextDisabled]}>
                  {date ? date.getDate() : ""}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Sheet>
    </View>
  );
}

export function TimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const options = useMemo(
    () =>
      Array.from({ length: 24 }, (_, hour) => ({
        label: `${String(hour).padStart(2, "0")}:00`,
        value: `${String(hour).padStart(2, "0")}:00`,
      })),
    []
  );

  return <SelectField label={label} value={value} placeholder={t("selectTime")} options={options} onChange={onChange} />;
}

export function CityField({
  label,
  value,
  availableCities,
  onChange,
}: {
  label: string;
  value: string;
  availableCities?: CityOption[];
  onChange: (value: string) => void;
}) {
  const { i18n, t } = useTranslation();
  const language = i18n.language === "ar" ? "ar" : "en";
  const fallbackCityOptions = useMemo(
    () =>
      [
        ["Riyadh", "cityRiyadh"],
        ["Jeddah", "cityJeddah"],
        ["Makkah", "cityMakkah"],
        ["Madinah", "cityMadinah"],
        ["Dammam", "cityDammam"],
        ["Khobar", "cityKhobar"],
        ["Dhahran", "cityDhahran"],
        ["Taif", "cityTaif"],
        ["Tabuk", "cityTabuk"],
        ["Abha", "cityAbha"],
        ["Hail", "cityHail"],
        ["Qassim", "cityQassim"],
        ["Jazan", "cityJazan"],
        ["Najran", "cityNajran"],
        ["Al Ahsa", "cityAlAhsa"],
        ["Yanbu", "cityYanbu"],
      ].map(([value, key]) => ({ label: t(key), value })),
    [t]
  );
  const providedCityOptions = useMemo(() => {
    if (!Array.isArray(availableCities)) return null;
    return availableCities
      .filter((city) => city.active !== false)
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((city) => ({
        value: city.value,
        label: language === "ar" ? city.labelAr : city.labelEn,
      }))
      .filter((city) => city.value && city.label);
  }, [availableCities, language]);
  const [cityOptions, setCityOptions] = useState<PickerOption[]>(fallbackCityOptions);

  useEffect(() => {
    if (providedCityOptions) {
      setCityOptions(providedCityOptions);
      return;
    }

    let mounted = true;

    getEventSettings()
      .then((settings) => {
        if (!mounted) return;
        const options = (settings.availableCities || [])
          .filter((city) => city.active)
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map((city) => ({
            value: city.value,
            label: language === "ar" ? city.labelAr : city.labelEn,
          }))
          .filter((city) => city.value && city.label);

        if (options.length > 0) setCityOptions(options);
      })
      .catch(() => {
        if (mounted) setCityOptions(fallbackCityOptions);
      });

    return () => {
      mounted = false;
    };
  }, [fallbackCityOptions, language, providedCityOptions]);

  useEffect(() => {
    if (value && cityOptions.length > 0 && !cityOptions.some((city) => city.value === value)) {
      onChange("");
    }
  }, [cityOptions, onChange, value]);

  return <SelectField label={label} value={value} placeholder={t("selectCity")} options={cityOptions} onChange={onChange} />;
}

export function GuestCountField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const options = ["25", "50", "75", "100", "150", "200", "300", "500", "750", "1000"].map((count) => ({
    label: count,
    value: count,
  }));

  return (
    <View style={{ gap: 10 }}>
      <SelectField label={label} value={value} placeholder={t("selectGuests")} options={options} onChange={onChange} />
      <Field label="" value={value} onChangeText={onChange} keyboardType="number-pad" placeholder={t("exactGuests")} />
    </View>
  );
}

const localStyles = StyleSheet.create({
  overlay: {
    backgroundColor: "rgba(10, 10, 10, 0.44)",
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: "82%",
    padding: 18,
  },
  sheetHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sheetTitle: {
    color: colors.black,
    fontFamily: "Almarai-Bold",
    fontSize: 19,
  },
  closeButton: {
    alignItems: "center",
    backgroundColor: colors.greenSoft,
    borderRadius: radius.md,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  closeText: {
    color: colors.green,
    fontFamily: "Almarai-Bold",
    fontSize: 22,
  },
  selectButton: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: 14,
  },
  selectText: {
    color: colors.ink,
    fontFamily: "Almarai-Regular",
    fontSize: 15,
  },
  placeholder: {
    color: colors.muted,
  },
  optionList: {
    gap: 8,
    paddingBottom: 20,
  },
  optionScroll: {
    maxHeight: 420,
  },
  optionRow: {
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 14,
  },
  optionRowActive: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
  },
  optionText: {
    color: colors.black,
    fontFamily: "Almarai-Bold",
    fontSize: 15,
  },
  optionTextActive: {
    color: colors.green,
  },
  monthHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: colors.greenSoft,
    borderRadius: radius.md,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  iconButtonText: {
    color: colors.black,
    fontFamily: "Almarai-Bold",
    fontSize: 20,
  },
  monthTitle: {
    color: colors.black,
    fontFamily: "Almarai-Bold",
    fontSize: 16,
  },
  yearHeader: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  yearButton: {
    alignItems: "center",
    backgroundColor: colors.softSurface,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 40,
  },
  yearButtonText: {
    color: colors.green,
    fontFamily: "Almarai-Bold",
    fontSize: 13,
  },
  weekGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 16,
  },
  weekLabel: {
    color: colors.muted,
    fontFamily: "Almarai-Bold",
    fontSize: 12,
    textAlign: "center",
    width: `${100 / 7 - 1}%`,
  },
  dayCell: {
    alignItems: "center",
    borderRadius: radius.sm,
    height: 42,
    justifyContent: "center",
    width: `${100 / 7 - 1}%`,
  },
  dayCellActive: {
    backgroundColor: colors.green,
  },
  dayCellDisabled: {
    opacity: 0.3,
  },
  dayText: {
    color: colors.black,
    fontFamily: "Almarai-Bold",
    fontSize: 14,
  },
  dayTextActive: {
    color: colors.surface,
  },
  dayTextDisabled: {
    color: colors.muted,
  },
});
