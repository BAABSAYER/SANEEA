import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

type CityOption = {
  value: string;
  labelAr: string;
  labelEn: string;
  active: boolean;
  displayOrder: number;
};

type EventSettings = {
  availableCities: CityOption[];
};

function citiesToText(cities: CityOption[]) {
  return [...cities]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((city) => [
      city.value,
      city.labelAr,
      city.labelEn,
      city.active ? "active" : "inactive",
    ].join(" | "))
    .join("\n");
}

function parseCities(value: string): CityOption[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [value, labelAr, labelEn, status] = line.split("|").map((part) => part?.trim() || "");
      const resolvedValue = value || labelEn || labelAr;
      return {
        value: resolvedValue,
        labelAr: labelAr || resolvedValue,
        labelEn: labelEn || resolvedValue,
        active: !["inactive", "off", "false", "0", "disabled"].includes(status.toLowerCase()),
        displayOrder: index + 1,
      };
    })
    .filter((city) => city.value && city.labelAr && city.labelEn);
}

export default function AdminSettings() {
  const { toast } = useToast();
  const [citiesText, setCitiesText] = useState("");

  const { data: settings, isLoading } = useQuery<EventSettings>({
    queryKey: ["/api/admin/event-settings"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/event-settings");
      return await res.json();
    },
  });

  useEffect(() => {
    if (settings?.availableCities) {
      setCitiesText(citiesToText(settings.availableCities));
    }
  }, [settings]);

  const parsedCities = useMemo(() => parseCities(citiesText), [citiesText]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (input: EventSettings) => {
      const res = await apiRequest("PATCH", "/api/admin/event-settings", input);
      return await res.json();
    },
    onSuccess: (updated: EventSettings) => {
      queryClient.setQueryData(["/api/admin/event-settings"], updated);
      setCitiesText(citiesToText(updated.availableCities));
      toast({
        title: "تم حفظ الإعدادات",
        description: "تم تحديث المدن المتاحة في تطبيق الجوال.",
      });
    },
    onError: (error) => {
      toast({
        title: "تعذر حفظ الإعدادات",
        description: error instanceof Error ? error.message : "حدث خطأ أثناء حفظ المدن.",
        variant: "destructive",
      });
    },
  });

  function save() {
    updateSettingsMutation.mutate({ availableCities: parsedCities });
  }

  return (
    <AdminLayout title="الإعدادات">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>مدن تطبيق الجوال</CardTitle>
            <CardDescription>
              حدد المدن التي يستطيع العميل اختيارها عند إنشاء طلب مناسبة من التطبيق.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <>
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-10 w-40" />
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="availableCities">المدن المتاحة</Label>
                  <Textarea
                    id="availableCities"
                    dir="ltr"
                    className="min-h-[260px] font-mono text-sm"
                    value={citiesText}
                    onChange={(event) => setCitiesText(event.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    الصيغة لكل سطر: English value | الاسم العربي | English label | active أو inactive
                  </p>
                </div>

                <div className="rounded-md border bg-muted/30 p-4">
                  <h3 className="mb-3 text-sm font-medium">معاينة المدن النشطة</h3>
                  <div className="flex flex-wrap gap-2">
                    {parsedCities.filter((city) => city.active).map((city) => (
                      <span key={city.value} className="rounded-full bg-background px-3 py-1 text-sm shadow-sm">
                        {city.labelAr} / {city.labelEn}
                      </span>
                    ))}
                    {parsedCities.filter((city) => city.active).length === 0 ? (
                      <span className="text-sm text-muted-foreground">لا توجد مدن نشطة.</span>
                    ) : null}
                  </div>
                </div>

                <Button
                  type="button"
                  disabled={updateSettingsMutation.isPending || parsedCities.length === 0}
                  onClick={save}
                >
                  {updateSettingsMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  حفظ المدن
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
