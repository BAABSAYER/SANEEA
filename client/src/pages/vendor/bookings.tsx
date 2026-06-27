import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { 
  Calendar, Filter, MessageSquare, Users, 
  ChevronRight, CheckCircle, Clock, MoreVertical, 
  ChevronLeft, Package
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Header } from "@/components/layout/header";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Booking } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

type FilterTab = "upcoming" | "pending" | "past" | "all";
type VendorBooking = Booking & {
  clientName?: string;
  eventType?: string;
  serviceName?: string;
  packageType?: string;
};

export default function VendorBookings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<FilterTab>("upcoming");
  const [selectedBooking, setSelectedBooking] = useState<VendorBooking | null>(null);
  
  // Redirect if not a vendor
  useEffect(() => {
    if (user && user.userType !== 'vendor') {
      navigate("/");
    }
  }, [user, navigate]);
  
  // Fetch bookings for this vendor
  const { data: bookings, isLoading } = useQuery<VendorBooking[]>({
    queryKey: ['/api/vendor/bookings', activeTab],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/vendor/bookings?filter=${activeTab}`);
      return res.json();
    },
    enabled: !!user && user.userType === 'vendor',
  });

  const approvalMutation = useMutation({
    mutationFn: async ({ bookingId, status }: { bookingId: number; status: "approved" | "rejected" }) => {
      const res = await apiRequest("POST", `/api/bookings/${bookingId}/vendor-approval`, { status });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("vendorBookings.bookingUpdated"), description: t("vendorBookings.bookingUpdatedDescription") });
      setSelectedBooking(null);
      queryClient.invalidateQueries({ queryKey: ['/api/vendor/bookings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/bookings/recent'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vendors/dashboard'] });
    },
    onError: (error) => {
      toast({ title: t("vendorBookings.bookingUpdateError"), description: error.message, variant: "destructive" });
    },
  });
  
  // Filter bookings based on active tab
  const filteredBookings = bookings || [];
  
  return (
    <div className="pb-20">
      <Header title={t("vendorBookings.title")} showBack={true} showSearch={false} />
      
      <div className="px-5 pt-4">
        <Tabs defaultValue="upcoming" className="w-full" onValueChange={(value) => setActiveTab(value as FilterTab)}>
          <TabsList className="mb-4 flex w-full justify-start overflow-x-auto">
            <TabsTrigger value="upcoming">{t("vendorBookings.upcoming")}</TabsTrigger>
            <TabsTrigger value="pending">{t("vendorBookings.pending")}</TabsTrigger>
            <TabsTrigger value="past">{t("vendorBookings.past")}</TabsTrigger>
            <TabsTrigger value="all">{t("vendorBookings.all")}</TabsTrigger>
          </TabsList>
          
          <TabsContent value="upcoming" className="mt-0">
            <BookingsList 
              bookings={filteredBookings} 
              isLoading={isLoading} 
              emptyMessage={t("vendorBookings.noUpcomingBookings")} 
              onSelect={setSelectedBooking}
            />
          </TabsContent>
          
          <TabsContent value="pending" className="mt-0">
            <BookingsList 
              bookings={filteredBookings} 
              isLoading={isLoading} 
              emptyMessage={t("vendorBookings.noPendingBookings")} 
              onSelect={setSelectedBooking}
            />
          </TabsContent>
          
          <TabsContent value="past" className="mt-0">
            <BookingsList 
              bookings={filteredBookings} 
              isLoading={isLoading} 
              emptyMessage={t("vendorBookings.noPastBookings")} 
              onSelect={setSelectedBooking}
            />
          </TabsContent>
          
          <TabsContent value="all" className="mt-0">
            <BookingsList 
              bookings={filteredBookings} 
              isLoading={isLoading} 
              emptyMessage={t("vendorBookings.noBookingsYet")} 
              onSelect={setSelectedBooking}
            />
          </TabsContent>
        </Tabs>
        
        <div className="mt-8 flex">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => navigate("/vendor/dashboard")}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            {t("vendorDashboard.dashboard")}
          </Button>
        </div>
      </div>
      
      {/* Booking Details Dialog */}
      {selectedBooking && (
        <Dialog open={!!selectedBooking} onOpenChange={() => setSelectedBooking(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t("vendorBookings.bookingDetails")}</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 my-4">
              <div className="bg-neutral-50 p-4 rounded-lg">
                <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
                  <div className="text-neutral-600 text-sm">{t("vendorBookings.eventDate")}</div>
                  <div className="font-medium">
                    {new Date(selectedBooking.eventDate).toLocaleDateString()}
                  </div>
                </div>
                <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:justify-between">
                  <div className="text-neutral-600 text-sm">{t("vendorBookings.eventType")}</div>
                  <div className="font-medium">{selectedBooking.eventType}</div>
                </div>
                <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:justify-between">
                  <div className="text-neutral-600 text-sm">{t("vendorBookings.guestCount")}</div>
                  <div className="font-medium">{selectedBooking.guestCount}</div>
                </div>
                <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:justify-between">
                  <div className="text-neutral-600 text-sm">{t("common.status")}</div>
                  <div className="font-medium capitalize">{selectedBooking.status}</div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">{t("vendorBookings.clientInfo")}</h4>
                <div className="bg-neutral-50 p-4 rounded-lg">
                  <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
                    <div className="text-neutral-600 text-sm">{t("common.name")}</div>
                    <div className="font-medium">{selectedBooking.clientName || t("vendorBookings.clientName")}</div>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">{t("vendorBookings.packageDetails")}</h4>
                <div className="bg-neutral-50 p-4 rounded-lg">
                  <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
                    <div className="text-neutral-600 text-sm">{t("bookings.service")}</div>
                    <div className="font-medium">{selectedBooking.serviceName}</div>
                  </div>
                  <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:justify-between">
                    <div className="text-neutral-600 text-sm">{t("vendorBookings.packageType")}</div>
                    <div className="font-medium">{selectedBooking.packageType}</div>
                  </div>
                  <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:justify-between">
                    <div className="text-neutral-600 text-sm">{t("vendorBookings.totalPrice")}</div>
                    <div className="font-medium text-secondary">${selectedBooking.totalPrice}</div>
                  </div>
                </div>
              </div>
              
              {selectedBooking.specialRequests && (
                <div>
                  <h4 className="font-medium mb-2">{t("vendorBookings.specialRequests")}</h4>
                  <div className="bg-neutral-50 p-4 rounded-lg">
                    <p className="text-neutral-700">{selectedBooking.specialRequests}</p>
                  </div>
                </div>
              )}
            </div>
            
            <DialogFooter className="flex flex-col sm:flex-row gap-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => navigate(`/vendor/chat/${selectedBooking.clientId}`)}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                {t("vendorBookings.messageClient")}
              </Button>
              
              {['pending', 'vendor_review'].includes(selectedBooking.status) && (
                <Button 
                  className="flex-1 bg-primary text-primary-foreground"
                  disabled={approvalMutation.isPending}
                  onClick={() => approvalMutation.mutate({ bookingId: selectedBooking.id, status: "approved" })}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {approvalMutation.isPending ? t("common.update") : t("vendorBookings.confirmBooking")}
                </Button>
              )}
              {['pending', 'vendor_review'].includes(selectedBooking.status) && (
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={approvalMutation.isPending}
                  onClick={() => approvalMutation.mutate({ bookingId: selectedBooking.id, status: "rejected" })}
                >
                  {t("eventRequests.reject")}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

interface BookingsListProps {
  bookings?: any[];
  isLoading: boolean;
  emptyMessage: string;
  onSelect: (booking: any) => void;
}

function BookingsList({ bookings, isLoading, emptyMessage, onSelect }: BookingsListProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center bg-white p-4 rounded-lg shadow-sm">
            <Skeleton className="h-12 w-12 rounded-full mr-3" />
            <div className="flex-1">
              <Skeleton className="h-4 w-28 mb-2" />
              <Skeleton className="h-3 w-36" />
            </div>
            <Skeleton className="h-8 w-20 rounded" />
          </div>
        ))}
      </div>
    );
  }
  
  if (!bookings || bookings.length === 0) {
    return (
      <div className="bg-white rounded-xl p-6 text-center shadow-sm">
        <Calendar className="h-12 w-12 text-neutral-300 mx-auto mb-3" />
        <h3 className="font-medium text-lg text-neutral-800 mb-2">{emptyMessage}</h3>
        <p className="text-neutral-600 mb-4">
          {t("vendorBookings.bookingsWillAppear")}
        </p>
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      {bookings.map((booking: any) => (
        <div 
          key={booking.id} 
          className="flex cursor-pointer flex-col gap-3 rounded-lg bg-white p-4 shadow-sm transition-colors hover:bg-neutral-50 sm:flex-row sm:items-center"
          onClick={() => onSelect(booking)}
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-neutral-100 sm:mr-3">
            <Users className="h-6 w-6 text-neutral-500" />
          </div>
          
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
              <h3 className="font-medium text-neutral-800">
                {booking.clientName || t("vendorBookings.clientName")}
              </h3>
              <BookingStatusBadge status={booking.status} />
            </div>
            
            <div className="mt-2 flex flex-wrap gap-3 text-sm text-neutral-600">
              <div className="flex items-center">
                <Calendar className="h-3 w-3 mr-1" />
                {new Date(booking.eventDate).toLocaleDateString()}
              </div>
              <div className="flex items-center">
                <Package className="h-3 w-3 mr-1" />
                {booking.packageType}
              </div>
            </div>
          </div>
          
          <ChevronRight className="hidden h-5 w-5 text-neutral-400 sm:block" />
        </div>
      ))}
    </div>
  );
}

function BookingStatusBadge({ status }: { status: string }) {
  let color, textColor, bgColor;
  
  switch (status.toLowerCase()) {
    case 'confirmed':
      color = 'text-green-600';
      textColor = 'text-green-600';
      bgColor = 'bg-green-100';
      break;
    case 'pending':
      color = 'text-yellow-600';
      textColor = 'text-yellow-600';
      bgColor = 'bg-yellow-100';
      break;
    case 'cancelled':
      color = 'text-red-600';
      textColor = 'text-red-600';
      bgColor = 'bg-red-100';
      break;
    case 'completed':
      color = 'text-blue-600';
      textColor = 'text-blue-600';
      bgColor = 'bg-blue-100';
      break;
    default:
      color = 'text-neutral-600';
      textColor = 'text-neutral-600';
      bgColor = 'bg-neutral-100';
  }
  
  return (
    <span className={`${bgColor} ${textColor} text-xs px-2 py-1 rounded-full font-medium capitalize`}>
      {status}
    </span>
  );
}
