import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  MessageCircle, 
  Search, 
  Calendar,
  Mail,
  Phone,
  User,
  Filter,
  Users as UsersIcon
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { format } from "date-fns";

interface User {
  id: number;
  username?: string;
  email: string;
  fullName?: string;
  phone?: string;
  userType: string;
  createdAt: string;
  avatarUrl?: string;
}

export default function UsersListPage() {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "client" | "vendor" | "admin">("all");

  // Fetch all users
  const { data: users = [], isLoading, error } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  // Filter users based on search term and type
  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchTerm || 
      (user.fullName?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (user.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (user.username?.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesType = filterType === "all" || user.userType === filterType;
    
    return matchesSearch && matchesType;
  });

  // Get user type badge color
  const getUserTypeBadgeVariant = (userType: string) => {
    switch (userType) {
      case "admin":
        return "destructive";
      case "vendor":
        return "secondary";
      case "client":
        return "default";
      default:
        return "outline";
    }
  };

  // Get user initials for avatar
  const getUserInitials = (user: User) => {
    if (user.fullName) {
      return user.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    if (user.username) {
      return user.username.slice(0, 2).toUpperCase();
    }
    return user.email.slice(0, 2).toUpperCase();
  };

  // Count users by type
  const getUserCounts = () => {
    const counts = {
      total: users.length,
      client: users.filter(u => u.userType === "client").length,
      vendor: users.filter(u => u.userType === "vendor").length,
      admin: users.filter(u => u.userType === "admin").length,
    };
    return counts;
  };

  const userCounts = getUserCounts();

  if (error) {
    return (
      <AdminLayout title={t('users.title')}>
        <div className="flex items-center justify-center h-64">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6">
              <div className="text-center text-muted-foreground">
                {t('messages.errorOccurred')}
              </div>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={t('users.title')}>
      <div className="space-y-6">
        {/* Header Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('users.title')}</CardTitle>
              <UsersIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{userCounts.total}</div>
              <p className="text-xs text-muted-foreground">
                {t('dashboard.stats.totalUsers')}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('users.client')}</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{userCounts.client}</div>
              <p className="text-xs text-muted-foreground">
                {t("adminUsers.mobileAppUsers")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('users.vendor')}</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{userCounts.vendor}</div>
              <p className="text-xs text-muted-foreground">
                {t("adminUsers.serviceProviders")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('users.admin')}</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{userCounts.admin}</div>
              <p className="text-xs text-muted-foreground">
                {t("adminUsers.platformAdmins")}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filter */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              {t('common.search')} & {t('common.filter')}
            </CardTitle>
            <CardDescription>
              {t("adminUsers.findAndManage")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Input
                  placeholder={t("adminUsers.searchPlaceholder")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant={filterType === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterType("all")}
                >
                  {t("adminUsers.all")} ({userCounts.total})
                </Button>
                <Button
                  variant={filterType === "client" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterType("client")}
                >
                  {t('users.client')} ({userCounts.client})
                </Button>
                <Button
                  variant={filterType === "vendor" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterType("vendor")}
                >
                  {t('users.vendor')} ({userCounts.vendor})
                </Button>
                <Button
                  variant={filterType === "admin" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterType("admin")}
                >
                  {t('users.admin')} ({userCounts.admin})
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Users List */}
        <Card>
          <CardHeader>
            <CardTitle>
              {filteredUsers.length > 0 
                ? `${filteredUsers.length} ${t('users.title').toLowerCase()}` 
                : t('messages.noResults')
              }
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-[200px]" />
                      <Skeleton className="h-3 w-[150px]" />
                    </div>
                    <Skeleton className="h-8 w-20" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                ))}
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm || filterType !== "all" 
                  ? t('messages.noResults')
                  : t('messages.noData')
                }
              </div>
            ) : (
              <div className="space-y-4">
                {filteredUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center space-x-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={user.avatarUrl} alt={user.fullName || user.username} />
                        <AvatarFallback>{getUserInitials(user)}</AvatarFallback>
                      </Avatar>
                      
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">
                            {user.fullName || user.username || t("adminUsers.unknownUser")}
                          </h3>
                          <Badge variant={getUserTypeBadgeVariant(user.userType)}>
                            {t(`users.${user.userType}`)}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {user.email}
                          </div>
                          
                          {user.phone && (
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {user.phone}
                            </div>
                          )}
                          
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(user.createdAt), 'MMM dd, yyyy')}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Link href={`/admin/messages?userId=${user.id}`}>
                        <Button size="sm" className="gap-2">
                          <MessageCircle className="h-4 w-4" />
                          {t('messages.title')}
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
