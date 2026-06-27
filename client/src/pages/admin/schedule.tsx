import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
} from "date-fns";
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock, MessageCircle, PlayCircle, RotateCcw, Users, XCircle } from "lucide-react";
import { AdminLayout } from "@/components/admin-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, authHeaders, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { BOOKING_STATUS } from "@shared/schema";

type CalendarView = "month" | "week" | "day";

type ScheduleItem = {
  id: number;
  status: string;
  eventDate: string;
  eventTime?: string | null;
  location?: string | null;
  guestCount: number;
  budget?: number | null;
  totalPrice?: number | null;
  clientId: number;
  clientName?: string | null;
  clientPhone?: string | null;
  eventTypeName?: string | null;
  bundleName?: string | null;
  vendorName?: string | null;
  vendorCity?: string | null;
};

const weekStartsOn = 6 as const;

function toApiDate(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function getDateKey(date: Date | string) {
  return format(new Date(date), "yyyy-MM-dd");
}

function getStatusClass(status: string) {
  switch (status) {
    case BOOKING_STATUS.PENDING:
      return "border-yellow-300 bg-yellow-50 text-yellow-900";
    case BOOKING_STATUS.CONFIRMED:
      return "border-green-300 bg-green-50 text-green-900";
    case BOOKING_STATUS.IN_PROGRESS:
      return "border-blue-300 bg-blue-50 text-blue-900";
    case BOOKING_STATUS.COMPLETED:
      return "border-slate-300 bg-slate-50 text-slate-700";
    case BOOKING_STATUS.CANCELLED:
      return "border-red-300 bg-red-50 text-red-900";
    default:
      return "border-border bg-muted/40 text-foreground";
  }
}

function getRange(anchorDate: Date, view: CalendarView) {
  if (view === "day") {
    return {
      start: startOfDay(anchorDate),
      end: startOfDay(anchorDate),
    };
  }

  if (view === "week") {
    return {
      start: startOfWeek(anchorDate, { weekStartsOn }),
      end: endOfWeek(anchorDate, { weekStartsOn }),
    };
  }

  return {
    start: startOfWeek(startOfMonth(anchorDate), { weekStartsOn }),
    end: endOfWeek(endOfMonth(anchorDate), { weekStartsOn }),
  };
}

function buildDays(start: Date, end: Date) {
  const days: Date[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) {
    days.push(day);
  }
  return days;
}

export default function AdminSchedule() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [view, setView] = useState<CalendarView>("month");
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  const range = useMemo(() => getRange(anchorDate, view), [anchorDate, view]);
  const calendarDays = useMemo(() => buildDays(range.start, range.end), [range.start, range.end]);

  const { data = [], isLoading } = useQuery<ScheduleItem[]>({
    queryKey: ["/api/admin/event-schedule", toApiDate(range.start), toApiDate(range.end)],
    queryFn: async () => {
      const params = new URLSearchParams({
        from: toApiDate(range.start),
        to: `${toApiDate(range.end)}T23:59:59`,
      });
      const res = await fetch(`/api/admin/event-schedule?${params.toString()}`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(t("adminSchedule.loadError"));
      return res.json();
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("PATCH", `/api/bookings/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: t("adminBookingsExtra.bookingUpdatedTitle"),
        description: t("adminBookingsExtra.bookingUpdatedDescription"),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/event-schedule"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bookings"] });
    },
    onError: (error) => {
      toast({
        title: t("adminBookingsExtra.bookingUpdateErrorTitle"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const eventsByDay = useMemo(() => {
    return data.reduce((acc, item) => {
      const key = getDateKey(item.eventDate);
      acc[key] = acc[key] || [];
      acc[key].push(item);
      acc[key].sort((a, b) => (a.eventTime || "").localeCompare(b.eventTime || ""));
      return acc;
    }, {} as Record<string, ScheduleItem[]>);
  }, [data]);

  const selectedEvents = eventsByDay[getDateKey(selectedDate)] || [];

  const goToday = () => {
    const today = new Date();
    setAnchorDate(today);
    setSelectedDate(today);
  };

  const goPrevious = () => {
    const nextDate = view === "month" ? subMonths(anchorDate, 1) : subDays(anchorDate, view === "week" ? 7 : 1);
    setAnchorDate(nextDate);
    setSelectedDate(nextDate);
  };

  const goNext = () => {
    const nextDate = view === "month" ? addMonths(anchorDate, 1) : addDays(anchorDate, view === "week" ? 7 : 1);
    setAnchorDate(nextDate);
    setSelectedDate(nextDate);
  };

  const handleViewChange = (nextView: string) => {
    setView(nextView as CalendarView);
    setAnchorDate(selectedDate);
  };

  const getActionButtons = (item: ScheduleItem) => {
    const actions: Array<{ status: string; label: string; icon: JSX.Element; variant?: "default" | "outline" | "destructive" | "secondary" }> = [];

    if (item.status === BOOKING_STATUS.PENDING || item.status === BOOKING_STATUS.VENDOR_APPROVED || item.status === BOOKING_STATUS.QUOTATION_ACCEPTED) {
      actions.push({ status: BOOKING_STATUS.CONFIRMED, label: t("adminBookingsExtra.confirm"), icon: <CheckCircle2 className="h-4 w-4" /> });
    }
    if (item.status === BOOKING_STATUS.CONFIRMED) {
      actions.push({ status: BOOKING_STATUS.IN_PROGRESS, label: t("adminSchedule.startSetup"), icon: <PlayCircle className="h-4 w-4" />, variant: "secondary" });
      actions.push({ status: BOOKING_STATUS.COMPLETED, label: t("adminBookingsExtra.complete"), icon: <CheckCircle2 className="h-4 w-4" />, variant: "outline" });
    }
    if (item.status === BOOKING_STATUS.IN_PROGRESS) {
      actions.push({ status: BOOKING_STATUS.COMPLETED, label: t("adminBookingsExtra.complete"), icon: <CheckCircle2 className="h-4 w-4" /> });
    }
    if (![BOOKING_STATUS.CANCELLED, BOOKING_STATUS.COMPLETED].includes(item.status as any)) {
      actions.push({ status: BOOKING_STATUS.CANCELLED, label: t("common.cancel"), icon: <XCircle className="h-4 w-4" />, variant: "destructive" });
    }

    return actions;
  };

  const displayLocale = i18n.language?.startsWith("ar") ? "ar-SA" : "en-US";
  const formatDisplayDate = (date: Date, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(displayLocale, options).format(date);

  return (
    <AdminLayout title={t("navigation.schedule")}>
      <div className="space-y-5">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                {t("adminSchedule.title")}
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={goToday}>
                  {t("adminSchedule.today")}
                </Button>
                <div className="flex items-center rounded-md border">
                  <Button variant="ghost" size="icon" onClick={goPrevious} aria-label={t("adminSchedule.previous")}>
                    <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={goNext} aria-label={t("adminSchedule.next")}>
                    <ChevronRight className="h-4 w-4 rtl:rotate-180" />
                  </Button>
                </div>
                <Tabs value={view} onValueChange={handleViewChange} className="max-w-full">
                  <TabsList>
                    <TabsTrigger value="month">{t("adminSchedule.month")}</TabsTrigger>
                    <TabsTrigger value="week">{t("adminSchedule.week")}</TabsTrigger>
                    <TabsTrigger value="day">{t("adminSchedule.day")}</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-semibold">
                {view === "month"
                  ? formatDisplayDate(anchorDate, { month: "long", year: "numeric" })
                  : `${formatDisplayDate(range.start, { month: "short", day: "numeric" })} - ${formatDisplayDate(range.end, { month: "short", day: "numeric", year: "numeric" })}`}
              </h2>
              <p className="text-sm text-muted-foreground">{t("adminSchedule.subtitle")}</p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
              <div className="min-w-[720px]">
              <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-xs font-medium text-muted-foreground">
                {Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(new Date(), { weekStartsOn }), index)).map((day) => (
                  <div key={day.toISOString()} className="px-2 py-3">
                    {formatDisplayDate(day, { weekday: "short" })}
                  </div>
                ))}
              </div>

              {isLoading ? (
                <div className="grid grid-cols-7">
                  {Array.from({ length: view === "month" ? 35 : 7 }, (_, index) => (
                    <div key={index} className="min-h-28 border-b border-e p-2">
                      <Skeleton className="mb-3 h-4 w-10" />
                      <Skeleton className="h-6 w-full" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-7">
                  {calendarDays.map((day) => {
                    const dateKey = getDateKey(day);
                    const dayEvents = eventsByDay[dateKey] || [];
                    const isSelected = isSameDay(day, selectedDate);
                    const isCurrentMonth = isSameMonth(day, anchorDate) || view !== "month";

                    return (
                      <button
                        key={dateKey}
                        type="button"
                        onClick={() => {
                          setSelectedDate(day);
                          if (view === "day") setAnchorDate(day);
                        }}
                        className={cn(
                          "min-h-32 border-b border-e p-2 text-start transition-colors hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset",
                          !isCurrentMonth && "bg-muted/20 text-muted-foreground",
                          isSelected && "bg-primary/5 ring-2 ring-primary ring-inset",
                          view === "day" && "col-span-7 min-h-[520px]",
                        )}
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <span
                            className={cn(
                              "flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium",
                              isSameDay(day, new Date()) && "bg-primary text-primary-foreground",
                            )}
                          >
                            {formatDisplayDate(day, { day: "numeric" })}
                          </span>
                          {dayEvents.length > 0 && (
                            <Badge variant="secondary" className="h-6 px-2">
                              {dayEvents.length}
                            </Badge>
                          )}
                        </div>
                        <div className="space-y-1">
                          {dayEvents.slice(0, view === "day" ? 12 : 3).map((item) => (
                            <div
                              key={item.id}
                              className={cn("rounded border px-2 py-1 text-xs leading-tight shadow-sm", getStatusClass(item.status))}
                            >
                              <div className="flex items-center gap-1 font-semibold">
                                <Clock className="h-3 w-3" />
                                <span>{item.eventTime || t("adminSchedule.noTime")}</span>
                              </div>
                              <div className="truncate">
                                #{item.id} {item.eventTypeName || t("adminSchedule.eventFallback")}
                              </div>
                              {view === "day" && (
                                <div className="truncate text-muted-foreground">
                                  {item.clientName || t("adminBookingsExtra.client")} - {item.location || t("adminSchedule.noCity")}
                                </div>
                              )}
                            </div>
                          ))}
                          {dayEvents.length > 3 && view !== "day" && (
                            <div className="text-xs font-medium text-primary">
                              {t("adminSchedule.moreEvents", { count: dayEvents.length - 3 })}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              </div>
              </div>
            </CardContent>
          </Card>

          <Card className="xl:sticky xl:top-4 xl:self-start">
            <CardHeader>
              <CardTitle className="text-lg">
                {formatDisplayDate(selectedDate, { weekday: "long", month: "short", day: "numeric" })}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {selectedEvents.length
                  ? t("adminSchedule.eventsCount", { count: selectedEvents.length })
                  : t("adminSchedule.noEventsForDay")}
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? (
                <>
                  <Skeleton className="h-28 w-full" />
                  <Skeleton className="h-28 w-full" />
                </>
              ) : selectedEvents.length === 0 ? (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  {t("adminSchedule.noEventsForDay")}
                </div>
              ) : (
                selectedEvents.map((item) => (
                  <div key={item.id} className="rounded-lg border p-3 shadow-sm">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold">
                          #{item.id} {item.eventTypeName || t("adminSchedule.eventFallback")}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {item.eventTime || t("adminSchedule.noTime")}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {item.guestCount}
                          </span>
                        </div>
                      </div>
                      <Badge variant="outline" className={getStatusClass(item.status)}>
                        {t(`bookingStatus.${item.status}`, { defaultValue: item.status })}
                      </Badge>
                    </div>

                    <div className="space-y-1 text-sm">
                      <div>
                        <span className="text-muted-foreground">{t("adminBookingsExtra.client")}: </span>
                        {item.clientName || `${t("adminBookingsExtra.client")} #${item.clientId}`}
                        {item.clientPhone ? ` - ${item.clientPhone}` : ""}
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t("adminSchedule.location")}: </span>
                        {item.location || item.vendorCity || t("adminSchedule.noCity")}
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t("adminBookings.packageDetails")}: </span>
                        {item.bundleName || t("adminSchedule.noPackage")}
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t("navigation.vendors")}: </span>
                        {item.vendorName || t("adminSchedule.noVendorAssigned")}
                      </div>
                      {(item.totalPrice || item.budget) && (
                        <div className="font-semibold">
                          {(item.totalPrice || item.budget)?.toLocaleString()} {t("common.sar")}
                        </div>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => setLocation(`/admin/bookings#booking-${item.id}`)}>
                        {t("common.viewDetails")}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setLocation(`/admin/messages?userId=${item.clientId}`)}>
                        <MessageCircle className="h-4 w-4" />
                        {t("adminBookingsExtra.chatWithClient")}
                      </Button>
                      {getActionButtons(item).map((action) => (
                        <Button
                          key={`${item.id}-${action.status}`}
                          size="sm"
                          variant={action.variant || "default"}
                          disabled={updateStatusMutation.isPending}
                          onClick={() => updateStatusMutation.mutate({ id: item.id, status: action.status })}
                        >
                          {action.icon}
                          {action.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))
              )}

              <Button variant="outline" className="w-full" onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/event-schedule"] })}>
                <RotateCcw className="h-4 w-4" />
                {t("adminSchedule.refresh")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
