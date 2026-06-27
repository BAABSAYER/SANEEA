import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { AdminLayout } from "@/components/admin-layout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiRequest, authHeaders, queryClient } from "@/lib/queryClient";
import { Booking, Vendor, BOOKING_STATUS, EVENT_TYPES } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { DollarSign, Calendar, FileText, CreditCard, MessageSquare } from "lucide-react";

// Extend Booking type to include vendor info
type BookingWithDetails = Booking & {
  vendor?: Vendor;
  clientName?: string;
  clientAttachments?: Array<{ url: string; fileName?: string | null; contentType?: string | null }>;
};

type Payment = {
  id: number;
  bookingId: number;
  type: "deposit" | "final";
  amount: number;
  status: string;
  provider?: string | null;
  providerPaymentId?: string | null;
  paymentUrl?: string | null;
  receiptUrl?: string | null;
  receiptFileName?: string | null;
  receiptContentType?: string | null;
  receiptSubmittedAt?: string | null;
  confirmedBy?: number | null;
  dueDate?: string | null;
  paidAt?: string | null;
};

function QuestionnaireResponses({ responses }: { responses: unknown }) {
  const { t } = useTranslation();

  if (!responses) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('adminBookings.eventDetails')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">{t('adminBookings.noResponses')}</p>
        </CardContent>
      </Card>
    );
  }

  let responseObj: Record<string, any> = {};

  if (typeof responses === 'string') {
    try {
      responseObj = JSON.parse(responses);
    } catch (e) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('adminBookings.eventDetails')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500">{t('adminBookings.invalidData')}</p>
          </CardContent>
        </Card>
      );
    }
  } else if (typeof responses === 'object') {
    responseObj = responses as Record<string, any>;
  } else {
    return null;
  }

  const entries = Object.entries(responseObj);

  if (entries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('adminBookings.eventDetails')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">{t('adminBookings.noResponses')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('adminBookings.eventDetails')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {entries.map(([question, answer]) => (
            <div key={question} className="border-b border-gray-100 pb-3 last:border-b-0">
              <p className="text-sm font-medium text-gray-700 mb-1">
                {question.includes('_')
                  ? question.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
                  : question.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
              </p>
              <p className="text-sm text-foreground bg-muted p-2 rounded">
                {Array.isArray(answer)
                  ? answer.length > 0 ? answer.join(', ') : '-'
                  : answer ? String(answer) : '-'}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminBookings() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [selectedBooking, setSelectedBooking] = useState<BookingWithDetails | null>(null);
  const [isViewingDetails, setIsViewingDetails] = useState(false);
  const [isCreatingQuotation, setIsCreatingQuotation] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  
  // Quotation form state
  const [quotationForm, setQuotationForm] = useState({
    totalPrice: "",
    quotationNotes: "",
    quotationValidUntil: "",
    quotationDetails: {
      items: [{ service: "", price: "", description: "" }],
      breakdown: ""
    }
  });
  const [paymentForm, setPaymentForm] = useState({
    type: "deposit" as "deposit" | "final",
    amount: "",
    dueDate: "",
  });

  // Fetch all bookings with auto-refresh
  const { data: bookings = [], isLoading: isLoadingBookings } = useQuery<BookingWithDetails[]>({
    queryKey: ["/api/admin/bookings"],
    enabled: true,
    refetchInterval: 5000, // Auto-refresh every 5 seconds for new bookings
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const { data: payments = [], isLoading: isLoadingPayments } = useQuery<Payment[]>({
    queryKey: ["/api/bookings", selectedBooking?.id, "payments"],
    queryFn: async () => {
      if (!selectedBooking) return [];
      const res = await fetch(`/api/bookings/${selectedBooking.id}/payments`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to fetch payments");
      return res.json();
    },
    enabled: !!selectedBooking && isViewingDetails,
  });

  // Update booking status mutation
  const updateBookingStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("PATCH", `/api/bookings/${id}`, { status });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: t("adminBookingsExtra.bookingUpdatedTitle"),
        description: t("adminBookingsExtra.bookingUpdatedDescription"),
      });
      setIsViewingDetails(false);
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

  // Create quotation mutation
  const createQuotationMutation = useMutation({
    mutationFn: async ({ id, quotationData }: { id: number; quotationData: any }) => {
      const res = await apiRequest("PATCH", `/api/bookings/${id}`, {
        ...quotationData,
        status: BOOKING_STATUS.QUOTATION_SENT
      });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: t("adminBookingsExtra.quotationCreatedTitle"),
        description: t("adminBookingsExtra.quotationCreatedDescription"),
      });
      setIsCreatingQuotation(false);
      setSelectedBooking(null);
      resetQuotationForm();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bookings"] });
    },
    onError: (error) => {
      toast({
        title: t("adminBookingsExtra.quotationErrorTitle"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteBookingMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/bookings/${id}`);
    },
    onSuccess: () => {
      toast({
        title: t("adminBookingsExtra.bookingDeletedTitle"),
        description: t("adminBookingsExtra.bookingDeletedDescription"),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bookings"] });
    },
    onError: (error) => {
      toast({
        title: t("adminBookingsExtra.bookingDeleteErrorTitle"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBooking) throw new Error("Select a booking first");
      const res = await apiRequest("POST", `/api/bookings/${selectedBooking.id}/payments`, {
        type: paymentForm.type,
        amount: Number(paymentForm.amount),
        dueDate: paymentForm.dueDate ? new Date(paymentForm.dueDate) : null,
        currency: "SAR",
      });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: t("adminPayments.createdTitle"),
        description: t("adminPayments.createdDescription"),
      });
      setPaymentForm({ type: "deposit", amount: "", dueDate: "" });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings", selectedBooking?.id, "payments"] });
    },
    onError: (error) => {
      toast({
        title: t("adminPayments.createErrorTitle"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const markPaymentPaidMutation = useMutation({
    mutationFn: async (paymentId: number) => {
      const res = await apiRequest("POST", `/api/payments/${paymentId}/mark-paid`);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: t("adminPayments.markedPaidTitle"),
        description: t("adminPayments.markedPaidDescription"),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings", selectedBooking?.id, "payments"] });
    },
    onError: (error) => {
      toast({
        title: t("adminPayments.markPaidErrorTitle"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const sendTemplateMutation = useMutation({
    mutationFn: async ({ bookingId, template, paymentId }: { bookingId: number; template: string; paymentId?: number }) => {
      const res = await apiRequest("POST", `/api/bookings/${bookingId}/messages/template`, {
        template,
        paymentId,
      });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: t("adminMessageTemplates.sentTitle"),
        description: t("adminMessageTemplates.sentDescription"),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      if (selectedBooking) {
        queryClient.invalidateQueries({ queryKey: [`/api/messages/${selectedBooking.clientId}`] });
      }
    },
    onError: (error) => {
      toast({
        title: t("adminMessageTemplates.errorTitle"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getPendingCount = () => {
    return bookings.filter(b => b.status === BOOKING_STATUS.PENDING).length;
  };

  const getConfirmedCount = () => {
    return bookings.filter(b => b.status === BOOKING_STATUS.CONFIRMED).length;
  };

  const getCanceledCount = () => {
    return bookings.filter(b => b.status === BOOKING_STATUS.CANCELLED).length;
  };

  const resetQuotationForm = () => {
    setQuotationForm({
      totalPrice: "",
      quotationNotes: "",
      quotationValidUntil: "",
      quotationDetails: {
        items: [{ service: "", price: "", description: "" }],
        breakdown: ""
      }
    });
  };

  const handleStatusChange = (status: string) => {
    if (selectedBooking) {
      updateBookingStatusMutation.mutate({
        id: selectedBooking.id,
        status,
      });
    }
  };

  const handleCreateQuotation = (booking: BookingWithDetails) => {
    setSelectedBooking(booking);
    setIsCreatingQuotation(true);
    resetQuotationForm();
  };

  const handleSubmitQuotation = () => {
    if (!selectedBooking) return;

    const quotationData = {
      totalPrice: parseFloat(quotationForm.totalPrice),
      quotationNotes: quotationForm.quotationNotes,
      quotationValidUntil: quotationForm.quotationValidUntil ? new Date(quotationForm.quotationValidUntil) : null,
      quotationDetails: quotationForm.quotationDetails
    };

    createQuotationMutation.mutate({
      id: selectedBooking.id,
      quotationData
    });
  };

  const addQuotationItem = () => {
    setQuotationForm(prev => ({
      ...prev,
      quotationDetails: {
        ...prev.quotationDetails,
        items: [...prev.quotationDetails.items, { service: "", price: "", description: "" }]
      }
    }));
  };

  const removeQuotationItem = (index: number) => {
    setQuotationForm(prev => ({
      ...prev,
      quotationDetails: {
        ...prev.quotationDetails,
        items: prev.quotationDetails.items.filter((_, i) => i !== index)
      }
    }));
  };

  const updateQuotationItem = (index: number, field: string, value: string) => {
    setQuotationForm(prev => ({
      ...prev,
      quotationDetails: {
        ...prev.quotationDetails,
        items: prev.quotationDetails.items.map((item, i) => 
          i === index ? { ...item, [field]: value } : item
        )
      }
    }));
  };

  const getStatusBadge = (status: string) => {
    const label = t(`bookingStatus.${status}`, { defaultValue: status });
    switch (status) {
      case BOOKING_STATUS.PENDING:
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">{label}</Badge>;
      case BOOKING_STATUS.CONFIRMED:
        return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">{label}</Badge>;
      case BOOKING_STATUS.CANCELLED:
        return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">{label}</Badge>;
      case BOOKING_STATUS.COMPLETED:
        return <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">{label}</Badge>;
      default:
        return <Badge variant="outline">{label}</Badge>;
    }
  };

  const filteredBookings = statusFilter 
    ? bookings.filter(booking => booking.status === statusFilter) 
    : bookings;

  return (
    <AdminLayout title={t('adminBookings.title')}>
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card onClick={() => setStatusFilter(BOOKING_STATUS.PENDING)}
                className={`cursor-pointer ${statusFilter === BOOKING_STATUS.PENDING ? 'border-primary' : ''}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{t('bookingStatus.pending')}</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingBookings ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <div className="text-2xl font-bold">{getPendingCount()}</div>
              )}
            </CardContent>
          </Card>
          
          <Card onClick={() => setStatusFilter(BOOKING_STATUS.CONFIRMED)}
                className={`cursor-pointer ${statusFilter === BOOKING_STATUS.CONFIRMED ? 'border-primary' : ''}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{t('bookingStatus.confirmed')}</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingBookings ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <div className="text-2xl font-bold">{getConfirmedCount()}</div>
              )}
            </CardContent>
          </Card>
          
          <Card onClick={() => setStatusFilter(BOOKING_STATUS.CANCELLED)}
                className={`cursor-pointer ${statusFilter === BOOKING_STATUS.CANCELLED ? 'border-primary' : ''}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{t('bookingStatus.cancelled')}</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingBookings ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <div className="text-2xl font-bold">{getCanceledCount()}</div>
              )}
            </CardContent>
          </Card>
        </div>

        {statusFilter && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button variant="outline" size="sm" onClick={() => setStatusFilter(null)}>
              Clear Filter
            </Button>
            <span className="text-sm text-muted-foreground sm:ml-2">
              {t("adminBookingsExtra.showingStatus", { status: t(`bookingStatus.${statusFilter}`, { defaultValue: statusFilter }) })}
            </span>
          </div>
        )}

        {/* Bookings Table */}
        <div className="rounded-md border">
          {isLoadingBookings ? (
            <div className="p-4 space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : filteredBookings.length > 0 ? (
            <>
              <div className="space-y-3 p-3 md:hidden">
                {filteredBookings.map((booking) => (
                  <div key={booking.id} id={`booking-${booking.id}`} className="rounded-lg border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-medium">#{booking.id} {booking.clientName || `${t("adminBookingsExtra.client")} #${booking.clientId}`}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {booking.vendor?.businessName || `${t("adminBookingsExtra.vendor")} #${booking.vendorId}`}
                        </p>
                      </div>
                      {getStatusBadge(booking.status)}
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                      <div>{t("adminBookingsExtra.eventType")} #{booking.eventTypeId}</div>
                      <div>{new Date(booking.eventDate).toLocaleDateString()}</div>
                    </div>
                    <div className="mt-4 grid gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedBooking(booking);
                          setIsViewingDetails(true);
                        }}
                      >
                        {t('common.viewDetails')}
                      </Button>
                      {booking.status === BOOKING_STATUS.PENDING && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleCreateQuotation(booking)}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <DollarSign className="h-3 w-3 mr-1" />
                          {t('adminBookings.createQuotation')}
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          if (confirm(t('adminBookings.confirmDelete'))) {
                            deleteBookingMutation.mutate(booking.id);
                          }
                        }}
                        disabled={deleteBookingMutation.isPending}
                      >
                        {t('common.delete')}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>{t('adminUsers.username')}</TableHead>
                      <TableHead>{t('navigation.vendors')}</TableHead>
                      <TableHead>{t('adminEvents.title')}</TableHead>
                      <TableHead>{t('vendorBookings.eventDate')}</TableHead>
                      <TableHead>{t('common.status')}</TableHead>
                      <TableHead>{t('common.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBookings.map((booking) => (
                      <TableRow key={booking.id} id={`booking-${booking.id}`}>
                        <TableCell>#{booking.id}</TableCell>
                        <TableCell>{booking.clientName || `${t("adminBookingsExtra.client")} #${booking.clientId}`}</TableCell>
                        <TableCell>{booking.vendor?.businessName || `${t("adminBookingsExtra.vendor")} #${booking.vendorId}`}</TableCell>
                        <TableCell>{t("adminBookingsExtra.eventType")} #{booking.eventTypeId}</TableCell>
                        <TableCell>{new Date(booking.eventDate).toLocaleDateString()}</TableCell>
                        <TableCell>{getStatusBadge(booking.status)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedBooking(booking);
                                setIsViewingDetails(true);
                              }}
                            >
                              {t('common.viewDetails')}
                            </Button>
                            {booking.status === BOOKING_STATUS.PENDING && (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleCreateQuotation(booking)}
                                className="bg-blue-600 hover:bg-blue-700"
                              >
                                <DollarSign className="h-3 w-3 mr-1" />
                                {t('adminBookings.createQuotation')}
                              </Button>
                            )}
                            {booking.status === BOOKING_STATUS.QUOTATION_SENT && booking.totalPrice && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                  setSelectedBooking(booking);
                                  setIsViewingDetails(true);
                                }}
                              >
                                <FileText className="h-3 w-3 mr-1" />
                                {t('common.viewDetails')}
                              </Button>
                            )}
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                if (confirm(t('adminBookings.confirmDelete'))) {
                                  deleteBookingMutation.mutate(booking.id);
                                }
                              }}
                              disabled={deleteBookingMutation.isPending}
                            >
                              {t('common.delete')}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <div className="p-8 text-center">
              <h3 className="text-lg font-medium">{t('adminBookings.noBookings')}</h3>
            </div>
          )}
        </div>
      </div>

      {/* Booking Details Dialog */}
      <Dialog open={isViewingDetails} onOpenChange={setIsViewingDetails}>
        <DialogContent className="sm:max-w-[760px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('adminBookings.bookingDetails')}</DialogTitle>
          </DialogHeader>
          
          {selectedBooking && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <h4 className="text-sm font-medium mb-1">{t("adminBookingsExtra.client")}</h4>
                  <p>{selectedBooking.clientName || `${t("adminBookingsExtra.client")} #${selectedBooking.clientId}`}</p>
                  <Link href={`/admin/messages?userId=${selectedBooking.clientId}`}>
                    <a className="text-primary text-sm hover:underline">
                      {t("adminBookingsExtra.chatWithClient")}
                    </a>
                  </Link>
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-1">{t("adminBookingsExtra.vendor")}</h4>
                  <p>{selectedBooking.vendor?.businessName || `${t("adminBookingsExtra.vendor")} #${selectedBooking.vendorId}`}</p>
                </div>
              </div>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <h4 className="text-sm font-medium mb-1">{t('adminBookings.eventDate')}</h4>
                  <p>{new Date(selectedBooking.eventDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-1">{t('adminBookings.guestCount')}</h4>
                  <p>{selectedBooking.guestCount}</p>
                </div>
              </div>
              
              {selectedBooking.specialRequests && (
                <div>
                  <h4 className="text-sm font-medium mb-1">{t('adminBookings.specialRequests')}</h4>
                  <p className="text-sm">{selectedBooking.specialRequests}</p>
                </div>
              )}

              {selectedBooking.budget ? (
                <div>
                  <h4 className="text-sm font-medium mb-1">{t("adminBookings.budget")}</h4>
                  <p className="text-sm">{selectedBooking.budget.toLocaleString()} {t("common.sar")}</p>
                </div>
              ) : null}

              {selectedBooking.clientAttachments?.length ? (
                <div>
                  <h4 className="text-sm font-medium mb-1">{t("adminBookings.clientAttachments")}</h4>
                  <div className="space-y-1">
                    {selectedBooking.clientAttachments.map((attachment, index) => (
                      <a
                        key={`${attachment.url}-${index}`}
                        className="block text-sm text-primary hover:underline"
                        href={attachment.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {attachment.fileName || t("adminBookings.attachmentNumber", { number: index + 1 })}
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Questionnaire Responses */}
              <QuestionnaireResponses responses={selectedBooking.questionnaireResponses} />

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    {t("adminMessageTemplates.title")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={sendTemplateMutation.isPending}
                    onClick={() => sendTemplateMutation.mutate({ bookingId: selectedBooking.id, template: "booking_received" })}
                  >
                    {t("adminMessageTemplates.bookingReceived")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={sendTemplateMutation.isPending}
                    onClick={() => sendTemplateMutation.mutate({ bookingId: selectedBooking.id, template: "booking_confirmed" })}
                  >
                    {t("adminMessageTemplates.bookingConfirmed")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={sendTemplateMutation.isPending}
                    onClick={() => sendTemplateMutation.mutate({ bookingId: selectedBooking.id, template: "booking_cancelled" })}
                  >
                    {t("adminMessageTemplates.bookingCancelled")}
                  </Button>
                  <Link href={`/admin/messages?userId=${selectedBooking.clientId}`}>
                    <Button variant="secondary" size="sm">
                      {t("adminMessageTemplates.openChat")}
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    {t("adminPayments.title")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <Select
                      value={paymentForm.type}
                      onValueChange={(value) => setPaymentForm(prev => ({ ...prev, type: value as "deposit" | "final" }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="deposit">{t("adminPayments.deposit")}</SelectItem>
                        <SelectItem value="final">{t("adminPayments.final")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min="0"
                      placeholder={t("adminPayments.amountPlaceholder")}
                      value={paymentForm.amount}
                      onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                    />
                    <Input
                      type="date"
                      value={paymentForm.dueDate}
                      onChange={(e) => setPaymentForm(prev => ({ ...prev, dueDate: e.target.value }))}
                    />
                    <Button
                      onClick={() => createPaymentMutation.mutate()}
                      disabled={!paymentForm.amount || createPaymentMutation.isPending}
                    >
                      {createPaymentMutation.isPending ? t("adminPayments.creating") : t("adminPayments.create")}
                    </Button>
                  </div>

                  {isLoadingPayments ? (
                    <p className="text-sm text-muted-foreground">{t("adminPayments.loading")}</p>
                  ) : payments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("adminPayments.none")}</p>
                  ) : (
                    <div className="space-y-2">
                      {payments.map((payment) => (
                        <div key={payment.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                          <div>
                            <div className="font-medium capitalize">
                              {payment.type} - SAR {payment.amount.toLocaleString()}
                            </div>
                            <div className="text-muted-foreground">
                              {payment.provider || "manual"} / {payment.status}
                              {payment.dueDate ? ` / ${t("adminPayments.due")} ${new Date(payment.dueDate).toLocaleDateString()}` : ""}
                            </div>
                            {payment.paymentUrl && (
                              <a className="text-primary hover:underline" href={payment.paymentUrl} target="_blank" rel="noreferrer">
                                Open payment link
                              </a>
                            )}
                            {payment.receiptUrl && (
                              <div>
                                <a className="text-primary hover:underline" href={payment.receiptUrl} target="_blank" rel="noreferrer">
                                  {t("adminPayments.openReceipt")}{payment.receiptFileName ? ` (${payment.receiptFileName})` : ""}
                                </a>
                                {payment.receiptSubmittedAt ? (
                                  <span className="ml-2 text-xs text-muted-foreground">
                                    {t("adminPayments.submitted")} {new Date(payment.receiptSubmittedAt).toLocaleString()}
                                  </span>
                                ) : null}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={payment.status === "paid" ? "default" : "secondary"}>
                              {payment.status}
                            </Badge>
                            {payment.status !== "paid" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => markPaymentPaidMutation.mutate(payment.id)}
                                disabled={markPaymentPaidMutation.isPending}
                              >
                                {t("adminPayments.markPaid")}
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => sendTemplateMutation.mutate({
                                bookingId: selectedBooking.id,
                                paymentId: payment.id,
                                template: payment.type === "deposit" ? "deposit_request" : "payment_request",
                              })}
                              disabled={sendTemplateMutation.isPending}
                            >
                              {payment.type === "deposit" ? t("adminMessageTemplates.depositRequest") : t("adminMessageTemplates.paymentRequest")}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              
              <div>
                <h4 className="text-sm font-medium mb-1">{t("adminBookingsExtra.status")}</h4>
                <Select
                  value={selectedBooking.status}
                  onValueChange={handleStatusChange}
                  disabled={updateBookingStatusMutation.isPending}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={BOOKING_STATUS.PENDING}>{t("bookingStatus.pending")}</SelectItem>
                    <SelectItem value={BOOKING_STATUS.CONFIRMED}>{t("adminBookingsExtra.confirm")}</SelectItem>
                    <SelectItem value={BOOKING_STATUS.CANCELLED}>{t("common.cancel")}</SelectItem>
                    <SelectItem value={BOOKING_STATUS.COMPLETED}>{t("adminBookingsExtra.complete")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewingDetails(false)}>
              {t('common.cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quotation Creation Dialog */}
      <Dialog open={isCreatingQuotation} onOpenChange={setIsCreatingQuotation}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('adminBookings.createQuotation')}</DialogTitle>
          </DialogHeader>
          
          {selectedBooking && (
            <div className="space-y-6">
              {/* Booking Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t("adminBookingsExtra.bookingSummary")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2 text-sm">
                    <div>
                      <strong>{t("adminBookingsExtra.client")}:</strong> {selectedBooking.clientName || `${t("adminBookingsExtra.client")} #${selectedBooking.clientId}`}
                    </div>
                    <div>
                      <strong>Event Date:</strong> {new Date(selectedBooking.eventDate).toLocaleDateString()}
                    </div>
                    <div>
                      <strong>{t("adminBookings.guestCount")}:</strong> {selectedBooking.guestCount}
                    </div>
                    <div>
                      <strong>{t("adminBookingsExtra.eventType")}:</strong> {t("adminBookingsExtra.eventType")} #{selectedBooking.eventTypeId}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Quotation Items */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <Label className="text-base font-medium">Quotation Items</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addQuotationItem}
                  >
                    Add Item
                  </Button>
                </div>
                
                <div className="space-y-3">
                  {quotationForm.quotationDetails.items.map((item, index) => (
                    <Card key={index}>
                      <CardContent className="p-4">
                        <div className="grid gap-3 md:grid-cols-12 md:items-end">
                          <div className="md:col-span-4">
                            <Label htmlFor={`service-${index}`}>Service</Label>
                            <Input
                              id={`service-${index}`}
                              placeholder="Service name"
                              value={item.service}
                              onChange={(e) => updateQuotationItem(index, 'service', e.target.value)}
                            />
                          </div>
                          <div className="md:col-span-2">
                            <Label htmlFor={`price-${index}`}>Price ($)</Label>
                            <Input
                              id={`price-${index}`}
                              type="number"
                              placeholder="0.00"
                              value={item.price}
                              onChange={(e) => updateQuotationItem(index, 'price', e.target.value)}
                            />
                          </div>
                          <div className="md:col-span-5">
                            <Label htmlFor={`description-${index}`}>Description</Label>
                            <Input
                              id={`description-${index}`}
                              placeholder="Service description"
                              value={item.description}
                              onChange={(e) => updateQuotationItem(index, 'description', e.target.value)}
                            />
                          </div>
                          <div className="md:col-span-1">
                            {quotationForm.quotationDetails.items.length > 1 && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => removeQuotationItem(index)}
                              >
                                ×
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Total Price */}
              <div>
                <Label htmlFor="totalPrice">Total Price ($)</Label>
                <Input
                  id="totalPrice"
                  type="number"
                  placeholder="0.00"
                  value={quotationForm.totalPrice}
                  onChange={(e) => setQuotationForm(prev => ({ ...prev, totalPrice: e.target.value }))}
                  className="text-lg font-semibold"
                />
              </div>

              {/* Quotation Notes */}
              <div>
                <Label htmlFor="quotationNotes">Additional Notes</Label>
                <Textarea
                  id="quotationNotes"
                  placeholder="Any additional terms, conditions, or notes for the client..."
                  value={quotationForm.quotationNotes}
                  onChange={(e) => setQuotationForm(prev => ({ ...prev, quotationNotes: e.target.value }))}
                  rows={4}
                />
              </div>

              {/* Valid Until */}
              <div>
                <Label htmlFor="quotationValidUntil">Quote Valid Until</Label>
                <Input
                  id="quotationValidUntil"
                  type="date"
                  value={quotationForm.quotationValidUntil}
                  onChange={(e) => setQuotationForm(prev => ({ ...prev, quotationValidUntil: e.target.value }))}
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreatingQuotation(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleSubmitQuotation}
              disabled={createQuotationMutation.isPending || !quotationForm.totalPrice}
            >
              {createQuotationMutation.isPending ? t('common.loading') : t('adminBookings.sendQuotation')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
