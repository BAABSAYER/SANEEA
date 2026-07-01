import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Calculator, Plus, Send, Trash2 } from "lucide-react";
import { AdminLayout } from "@/components/admin-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, authHeaders, queryClient } from "@/lib/queryClient";

type ProposalLine = {
  title: string;
  description: string;
  quantity: string;
  unitPrice: string;
  vendorId?: number | null;
  eventItemId?: number | null;
};

type Workspace = {
  booking: {
    id: number;
    clientId: number;
    clientName?: string | null;
    clientUsername?: string | null;
    clientPhone?: string | null;
    clientEmail?: string | null;
    status: string;
    eventDate: string;
    eventTime?: string | null;
    location?: string | null;
    guestCount: number;
    budget?: number | null;
    specialRequests?: string | null;
    eventTypeName?: string | null;
    bundleName?: string | null;
    totalPrice?: number | null;
  };
  packageItems: Array<{
    eventItemId: number;
    itemName?: string | null;
    itemDescription?: string | null;
    optionName?: string | null;
    optionDescription?: string | null;
    optionPrice?: number | null;
    quantity?: number | null;
    priceOverride?: number | null;
    vendorId?: number | null;
    vendorName?: string | null;
  }>;
  latestProposal?: {
    id: number;
    status: string;
    totalPrice: number;
    depositAmount?: number | null;
    finalAmount?: number | null;
    notes?: string | null;
    validUntil?: string | null;
    items: Array<{
      title: string;
      description?: string | null;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      vendorId?: number | null;
      eventItemId?: number | null;
    }>;
  } | null;
};

function formatSar(value: number | null | undefined) {
  return `${Number(value || 0).toLocaleString()} SAR`;
}

function lineTotal(line: ProposalLine) {
  return Number(line.quantity || 0) * Number(line.unitPrice || 0);
}

function emptyLine(): ProposalLine {
  return {
    title: "",
    description: "",
    quantity: "1",
    unitPrice: "",
    vendorId: null,
    eventItemId: null,
  };
}

export default function AdminProposalBuilder() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [, params] = useRoute("/admin/bookings/:id/proposal");
  const bookingId = Number(params?.id);
  const [lines, setLines] = useState<ProposalLine[]>([emptyLine()]);
  const [depositAmount, setDepositAmount] = useState("");
  const [finalAmount, setFinalAmount] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");

  const { data, isLoading } = useQuery<Workspace>({
    queryKey: [`/api/admin/bookings/${bookingId}/proposal-workspace`],
    enabled: Number.isFinite(bookingId),
    queryFn: async () => {
      const res = await fetch(`/api/admin/bookings/${bookingId}/proposal-workspace`, { headers: authHeaders() });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  useEffect(() => {
    if (!data) return;

    if (data.latestProposal?.items?.length) {
      setLines(data.latestProposal.items.map((item) => ({
        title: item.title,
        description: item.description || "",
        quantity: String(item.quantity || 1),
        unitPrice: String(item.unitPrice || 0),
        vendorId: item.vendorId || null,
        eventItemId: item.eventItemId || null,
      })));
      setDepositAmount(data.latestProposal.depositAmount ? String(data.latestProposal.depositAmount) : "");
      setFinalAmount(data.latestProposal.finalAmount ? String(data.latestProposal.finalAmount) : "");
      setValidUntil(data.latestProposal.validUntil ? data.latestProposal.validUntil.slice(0, 10) : "");
      setNotes(data.latestProposal.notes || "");
      return;
    }

    if (data.packageItems.length) {
      const suggested = data.packageItems.map((item) => {
        const unitPrice = item.priceOverride ?? item.optionPrice ?? 0;
        return {
          title: item.optionName ? `${item.itemName || "Service"} - ${item.optionName}` : item.itemName || "Service",
          description: item.optionDescription || item.itemDescription || item.vendorName || "",
          quantity: String(item.quantity || 1),
          unitPrice: String(unitPrice),
          vendorId: item.vendorId || null,
          eventItemId: item.eventItemId || null,
        };
      });
      setLines(suggested.length ? suggested : [emptyLine()]);
      return;
    }

    setLines([{
      ...emptyLine(),
      title: data.booking.eventTypeName || data.booking.bundleName || "Event service",
      unitPrice: data.booking.budget ? String(data.booking.budget) : "",
    }]);
  }, [data]);

  const total = useMemo(() => lines.reduce((sum, line) => sum + lineTotal(line), 0), [lines]);
  const calculatedFinal = useMemo(() => {
    const deposit = Number(depositAmount || 0);
    return Math.max(total - deposit, 0);
  }, [total, depositAmount]);

  useEffect(() => {
    if (depositAmount && !finalAmount) {
      setFinalAmount(String(calculatedFinal));
    }
  }, [calculatedFinal, depositAmount, finalAmount]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        totalPrice: total,
        depositAmount: depositAmount ? Number(depositAmount) : null,
        finalAmount: finalAmount ? Number(finalAmount) : null,
        validUntil: validUntil || null,
        notes,
        sendNow: true,
        items: lines
          .filter((line) => line.title.trim())
          .map((line) => ({
            title: line.title.trim(),
            description: line.description.trim() || null,
            quantity: Number(line.quantity || 1),
            unitPrice: Number(line.unitPrice || 0),
            vendorId: line.vendorId || null,
            eventItemId: line.eventItemId || null,
          })),
      };
      const res = await apiRequest("POST", `/api/admin/bookings/${bookingId}/proposals`, payload);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: t("adminBookings.quotationCreatedTitle", { defaultValue: "Proposal sent" }),
        description: t("adminBookings.quotationCreatedDescription", { defaultValue: "The client can now review it in the mobile app." }),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bookings"] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/bookings/${bookingId}/proposal-workspace`] });
    },
    onError: (error: Error) => {
      toast({
        title: t("adminBookings.quotationErrorTitle", { defaultValue: "Could not send proposal" }),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  function updateLine(index: number, patch: Partial<ProposalLine>) {
    setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line));
  }

  return (
    <AdminLayout title={t("adminBookings.createQuotation", { defaultValue: "Create proposal" })}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/admin/bookings">
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("common.back", { defaultValue: "Back" })}
              </Button>
            </Link>
          </div>
          {data?.latestProposal ? (
            <Badge variant="secondary">
              {t("adminBookings.latestProposal", { defaultValue: "Latest proposal" })}: {data.latestProposal.status}
            </Badge>
          ) : null}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : data ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t("adminBookingsExtra.bookingSummary", { defaultValue: "Booking summary" })}</CardTitle>
                  <CardDescription>
                    #{data.booking.id} - {data.booking.clientName || data.booking.clientUsername || `${t("adminBookingsExtra.client", { defaultValue: "Client" })} #${data.booking.clientId}`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <span className="text-muted-foreground">{t("adminBookingsExtra.eventType", { defaultValue: "Event" })}: </span>
                    {data.booking.eventTypeName || data.booking.bundleName || "-"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("adminBookings.eventDate", { defaultValue: "Event date" })}: </span>
                    {new Date(data.booking.eventDate).toLocaleDateString()}
                    {data.booking.eventTime ? ` ${data.booking.eventTime}` : ""}
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("adminBookings.location", { defaultValue: "City" })}: </span>
                    {data.booking.location || "-"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("adminBookings.guestCount", { defaultValue: "Guests" })}: </span>
                    {data.booking.guestCount}
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("phone", { defaultValue: "Phone" })}: </span>
                    {data.booking.clientPhone || "-"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("adminBookings.budget", { defaultValue: "Budget" })}: </span>
                    {data.booking.budget ? formatSar(data.booking.budget) : "-"}
                  </div>
                  {data.booking.specialRequests ? (
                    <div className="sm:col-span-2">
                      <span className="text-muted-foreground">{t("adminBookings.specialRequests", { defaultValue: "Special requests" })}: </span>
                      {data.booking.specialRequests}
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t("adminBookings.proposalItems", { defaultValue: "Proposal items" })}</CardTitle>
                  <CardDescription>
                    {t("adminBookings.proposalBuilderHelp", { defaultValue: "Review the suggested items, adjust the prices, then send the proposal to the client." })}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {lines.map((line, index) => (
                    <div key={index} className="rounded-lg border p-4">
                      <div className="grid gap-3 lg:grid-cols-12">
                        <div className="lg:col-span-4">
                          <Label>{t("adminBookings.service", { defaultValue: "Service" })}</Label>
                          <Input value={line.title} onChange={(event) => updateLine(index, { title: event.target.value })} />
                        </div>
                        <div className="lg:col-span-4">
                          <Label>{t("adminBookings.description", { defaultValue: "Description" })}</Label>
                          <Input value={line.description} onChange={(event) => updateLine(index, { description: event.target.value })} />
                        </div>
                        <div className="lg:col-span-1">
                          <Label>{t("adminBookings.quantity", { defaultValue: "Qty" })}</Label>
                          <Input type="number" min="0" value={line.quantity} onChange={(event) => updateLine(index, { quantity: event.target.value })} />
                        </div>
                        <div className="lg:col-span-2">
                          <Label>{t("adminBookings.priceSar", { defaultValue: "Price (SAR)" })}</Label>
                          <Input type="number" min="0" value={line.unitPrice} onChange={(event) => updateLine(index, { unitPrice: event.target.value })} />
                        </div>
                        <div className="flex items-end justify-between gap-2 lg:col-span-1">
                          <div className="pb-2 text-sm font-semibold">{formatSar(lineTotal(line))}</div>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))}
                            disabled={lines.length === 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}

                  <Button type="button" variant="outline" onClick={() => setLines((current) => [...current, emptyLine()])}>
                    <Plus className="mr-2 h-4 w-4" />
                    {t("adminBookings.addProposalItem", { defaultValue: "Add item" })}
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5" />
                    {t("adminBookings.finalProposalPrice", { defaultValue: "Final proposal price" })}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg bg-muted p-4 text-2xl font-bold">{formatSar(total)}</div>
                  <div>
                    <Label>{t("adminPayments.deposit", { defaultValue: "Deposit" })}</Label>
                    <Input type="number" min="0" value={depositAmount} onChange={(event) => setDepositAmount(event.target.value)} />
                  </div>
                  <div>
                    <Label>{t("adminPayments.final", { defaultValue: "Final" })}</Label>
                    <Input type="number" min="0" value={finalAmount} onChange={(event) => setFinalAmount(event.target.value)} />
                  </div>
                  <div>
                    <Label>{t("adminBookings.proposalValidUntil", { defaultValue: "Proposal valid until" })}</Label>
                    <Input type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} />
                  </div>
                  <div>
                    <Label>{t("adminBookings.proposalNotes", { defaultValue: "Proposal notes" })}</Label>
                    <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={5} />
                  </div>
                  <Button
                    className="w-full"
                    disabled={saveMutation.isPending || total <= 0 || lines.every((line) => !line.title.trim())}
                    onClick={() => saveMutation.mutate()}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    {saveMutation.isPending ? t("common.loading", { defaultValue: "Loading..." }) : t("adminBookings.sendQuotation", { defaultValue: "Send proposal" })}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              {t("adminBookings.notFound", { defaultValue: "Booking not found" })}
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
