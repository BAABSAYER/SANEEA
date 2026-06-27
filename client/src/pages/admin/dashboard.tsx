import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  CalendarIcon, 
  MessageSquare, 
  PieChart, 
  UserPlus, 
  Users, 
  BarChart3,
  ArrowRight,
  Star,
  TrendingUp,
  ClipboardCheck,
  Package
} from "lucide-react";
import { BOOKING_STATUS, EVENT_TYPES, SERVICE_CATEGORIES } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { BundleManagement } from "@/components/admin/bundle-management";

export default function AdminDashboard() {
  const { t } = useTranslation();
  const [timeframe, setTimeframe] = useState<'today' | 'week' | 'month'>('week');
  
  // Fetch bookings
  const { data: bookings = [], isLoading: isLoadingBookings } = useQuery<any[]>({
    queryKey: ["/api/admin/bookings"],
  });
  
  const { data: vendors = [], isLoading: isLoadingVendors } = useQuery<any[]>({
    queryKey: ["/api/vendors"],
  });
  
  // Fetch messages (last 10)
  const { data: recentMessages = [], isLoading: isLoadingMessages, error: messagesError } = useQuery<any[]>({
    queryKey: ["/api/admin/messages/recent"],
    enabled: false, // Disable this query for now as the endpoint is not implemented yet
  });

  // Calculate statistics
  const getPendingBookingsCount = () => {
    return bookings.filter((booking: any) => booking.status === BOOKING_STATUS.PENDING).length;
  };
  
  const getTotalBookingsCount = () => {
    // Count all bookings
    return bookings.length;
  };
  
  // Fetch all users
  const { data: users = [], isLoading: isLoadingUsers } = useQuery<any[]>({
    queryKey: ["/api/admin/users"],
  });
  
  const getRecentClientsCount = () => {
    // Count non-admin users
    return users.filter((user) => user.userType !== 'admin').length;
  };
  
  const getRecentBookingsCount = () => {
    // This would typically get bookings created in the selected timeframe
    return bookings.length;
  };
  
  const getVendorsByCategory = () => {
    const categories: Record<string, number> = {};
    
    vendors.forEach((vendor: any) => {
      const category = vendor.category;
      categories[category] = (categories[category] || 0) + 1;
    });
    
    return Object.entries(categories)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, count]) => ({ category, count }));
  };
  
  const getRecentBookings = () => {
    // This would typically get bookings filtered by timeframe
    // For demo purposes just return the most recent ones
    return [...bookings]
      .sort((a: any, b: any) => new Date(b.createdAt || b.eventDate).getTime() - new Date(a.createdAt || a.eventDate).getTime())
      .slice(0, 5);
  };

  const getPopularEventTypes = () => {
    const eventTypes: Record<string, number> = {};
    
    bookings.forEach((booking: any) => {
      const eventType = booking.eventType;
      eventTypes[eventType] = (eventTypes[eventType] || 0) + 1;
    });
    
    return Object.entries(eventTypes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type, count]) => ({ 
        type, 
        count,
        displayName: EVENT_TYPES[type as keyof typeof EVENT_TYPES] || type
      }));
  };

  return (
    <AdminLayout title={t('dashboard.title')}>
      <div className="flex-1 space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="col-span-1">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {t('dashboard.stats.pendingRequests')}
              </CardTitle>
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingBookings ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">{getPendingBookingsCount()}</div>
              )}
            </CardContent>
            <CardFooter className="p-2">
              <Link href="/admin/bookings">
                <Button variant="ghost" size="sm" className="w-full justify-between">
                  <span>{t('common.viewAll')}</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardFooter>
          </Card>

          <Card className="col-span-1">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {t('adminDashboard.totalBookings')}
              </CardTitle>
              <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{getTotalBookingsCount()}</div>
            </CardContent>
            <CardFooter className="p-2">
              <Link href="/admin/bookings">
                <Button variant="ghost" size="sm" className="w-full justify-between">
                  <span>{t('common.viewAll')}</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardFooter>
          </Card>

          <Card className="col-span-1">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {t('adminDashboard.newClients')}
              </CardTitle>
              <UserPlus className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{getRecentClientsCount()}</div>
            </CardContent>
          </Card>

          <Card className="col-span-1">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {t('adminDashboard.recentBookings')}
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{getRecentBookingsCount()}</div>
              <p className="text-xs text-muted-foreground pt-1">
                {timeframe === 'today'
                  ? t('adminDashboard.today')
                  : timeframe === 'week'
                    ? t('adminDashboard.thisWeek')
                    : t('adminDashboard.thisMonth')}
              </p>
            </CardContent>
          </Card>
        </div>
        
        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="flex w-full justify-start overflow-x-auto lg:w-auto">
            <TabsTrigger value="overview">{t('adminDashboard.overview')}</TabsTrigger>
            <TabsTrigger value="analytics">{t('adminDashboard.analytics')}</TabsTrigger>
            <TabsTrigger value="reports">{t('adminDashboard.reports')}</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
              {/* Recent Bookings */}
              <Card className="col-span-4">
                <CardHeader>
                  <CardTitle>{t('adminDashboard.recentBookings')}</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoadingBookings ? (
                    <div className="space-y-4">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                  ) : getRecentBookings().length > 0 ? (
                    <div className="space-y-4">
                      {getRecentBookings().map((booking: any) => (
                        <div key={booking.id} className="flex items-center justify-between space-x-4">
                          <div className="flex items-center space-x-4">
                            <Avatar className="h-9 w-9">
                              <AvatarFallback>
                                {booking.clientId.toString().substring(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium leading-none">
                                {EVENT_TYPES[booking.eventType as keyof typeof EVENT_TYPES] || booking.eventType}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {format(new Date(booking.eventDate), 'dd MMM yyyy')}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center">
                            {booking.status === BOOKING_STATUS.PENDING && (
                              <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">{t('bookingStatus.pending')}</Badge>
                            )}
                            {booking.status === BOOKING_STATUS.CONFIRMED && (
                              <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">{t('bookingStatus.confirmed')}</Badge>
                            )}
                            {booking.status === BOOKING_STATUS.CANCELLED && (
                              <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">{t('bookingStatus.cancelled')}</Badge>
                            )}
                            {booking.status === BOOKING_STATUS.COMPLETED && (
                              <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">{t('bookingStatus.completed')}</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t('adminDashboard.noRecentBookings')}</p>
                  )}
                </CardContent>
                <CardFooter>
                  <Link href="/admin/bookings">
                    <Button variant="outline" size="sm">{t('common.viewAll')}</Button>
                  </Link>
                </CardFooter>
              </Card>

              {/* Event Requests */}
              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle>{t('adminDashboard.recentBookings')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {isLoadingBookings ? (
                      <>
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                      </>
                    ) : bookings.length > 0 ? (
                      getRecentBookings().slice(0, 3).map((booking: any, index: number) => (
                        <div key={booking.id} className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <div className="h-8 w-8 rounded-full flex items-center justify-center bg-primary/10 text-primary">
                              {index + 1}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{t('adminDashboard.bookingNumber', { id: booking.id })}</p>
                              <p className="text-xs text-muted-foreground">
                                {booking.createdAt
                                  ? t('adminDashboard.createdOn', { date: format(new Date(booking.createdAt), 'MMM d, yyyy') })
                                  : t('adminDashboard.createdRecently')}
                              </p>
                            </div>
                          </div>
                          <Badge 
                            variant="outline" 
                            className={
                              booking.status === 'pending' ? "bg-yellow-100 text-yellow-800 border-yellow-300" :
                              booking.status === 'quoted' ? "bg-blue-100 text-blue-800 border-blue-300" :
                              booking.status === 'confirmed' ? "bg-green-100 text-green-800 border-green-300" :
                              "bg-gray-100 text-gray-800 border-gray-300"
                            }
                          >
                            {t(`bookingStatus.${booking.status}`, { defaultValue: booking.status })}
                          </Badge>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-4 text-gray-500">
                        {t('common.noDataFound')}
                      </div>
                    )}
                  </div>
                </CardContent>
                <CardFooter>
                  <Link href="/admin/bookings">
                    <Button variant="outline" size="sm">{t('common.viewAll')}</Button>
                  </Link>
                </CardFooter>
              </Card>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
              {/* Quick Actions */}
              <Card className="col-span-4">
                <CardHeader>
                  <CardTitle>{t('dashboard.quickActions')}</CardTitle>
                  <CardDescription>
                    {t('adminDashboard.quickActionsDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Link href="/admin/users-list">
                      <Button variant="outline" className="w-full h-20 flex flex-col gap-2">
                        <Users className="h-6 w-6" />
                        <span className="text-sm">{t('dashboard.manageUsers')}</span>
                      </Button>
                    </Link>
                    <Link href="/admin/events">
                      <Button variant="outline" className="w-full h-20 flex flex-col gap-2">
                        <CalendarIcon className="h-6 w-6" />
                        <span className="text-sm">{t('dashboard.createEvent')}</span>
                      </Button>
                    </Link>
                    <Link href="/admin/bookings">
                      <Button variant="outline" className="w-full h-20 flex flex-col gap-2">
                        <ClipboardCheck className="h-6 w-6" />
                        <span className="text-sm">{t('dashboard.viewRequests')}</span>
                      </Button>
                    </Link>
                    <Link href="/admin/messages">
                      <Button variant="outline" className="w-full h-20 flex flex-col gap-2">
                        <MessageSquare className="h-6 w-6" />
                        <span className="text-sm">{t('navigation.messages')}</span>
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>

              {/* Popular Event Types */}
              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle>{t('adminDashboard.popularEventTypes')}</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoadingBookings ? (
                    <div className="space-y-4">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                  ) : getPopularEventTypes().length > 0 ? (
                    <div className="space-y-6">
                      {getPopularEventTypes().map((event, index) => (
                        <div key={index} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <div className={`h-6 w-6 rounded-full flex items-center justify-center ${
                                index === 0 
                                  ? 'bg-yellow-100 text-yellow-700' 
                                  : index === 1 
                                    ? 'bg-gray-100 text-gray-700' 
                                    : 'bg-amber-100 text-amber-700'
                              }`}>
                                {index + 1}
                              </div>
                              <span className="text-sm font-medium">{event.displayName}</span>
                            </div>
                            <span className="text-sm font-medium">{event.count}</span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-secondary">
                            <div 
                              className="h-full rounded-full bg-primary" 
                              style={{ 
                                width: `${Math.min(100, (event.count / 10) * 100)}%` 
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t('common.noDataFound')}</p>
                  )}
                </CardContent>
              </Card>
              
              {/* Recent Messages */}
              <Card className="col-span-4">
                <CardHeader className="flex flex-row items-center">
                  <div>
                    <CardTitle>{t('adminDashboard.recentMessages')}</CardTitle>
                  </div>
                  <MessageSquare className="h-4 w-4 text-muted-foreground ml-auto" />
                </CardHeader>
                <CardContent>
                  {isLoadingMessages ? (
                    <div className="space-y-4">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                  ) : recentMessages.length > 0 ? (
                    <div className="space-y-4">
                      {recentMessages.map((message: any, index: number) => (
                        <div key={index} className="flex items-start space-x-4">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback>
                              {message.sender.toString().substring(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium leading-none">
                                {t('adminDashboard.clientNumber', { id: message.sender })}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {message.timestamp ? format(new Date(message.timestamp), 'dd MMM, HH:mm') : t('chat.now')}
                              </p>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {message.content.length > 50 
                                ? `${message.content.substring(0, 50)}...` 
                                : message.content}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t('adminDashboard.noRecentMessages')}</p>
                  )}
                </CardContent>
                <CardFooter>
                  <Link href="/admin/chat">
                    <Button variant="outline" size="sm">{t('common.viewAll')}</Button>
                  </Link>
                </CardFooter>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="analytics" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t('adminDashboard.analyticsOverview')}</CardTitle>
                <CardDescription>
                  {t('adminDashboard.analyticsOverviewDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[400px] flex items-center justify-center">
                <div className="text-center space-y-4">
                  <TrendingUp className="h-10 w-10 text-muted-foreground mx-auto" />
                  <h3 className="text-lg font-medium">{t('adminDashboard.analyticsComingSoon')}</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    {t('adminDashboard.analyticsDescription')}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="reports" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t('adminDashboard.reports')}</CardTitle>
                <CardDescription>
                  {t('adminDashboard.reportsOverviewDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[400px] flex items-center justify-center">
                <div className="text-center space-y-4">
                  <BarChart3 className="h-10 w-10 text-muted-foreground mx-auto" />
                  <h3 className="text-lg font-medium">{t('adminDashboard.reportsComingSoon')}</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    {t('adminDashboard.reportsDescription')}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
