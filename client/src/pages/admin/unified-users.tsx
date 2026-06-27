import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, PlusCircle, UserCog, Trash2, MessageCircle, Edit, Users as UsersIcon, User, Shield, Crown } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ADMIN_PERMISSIONS } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";

type User = {
  id: number;
  username: string;
  email: string;
  fullName?: string;
  phone?: string;
  userType: string;
  createdAt: string;
  permissions?: string[];
};

type AdminUserWithPermissions = User & {
  permissions: string[];
};

type UserCounts = {
  total: number;
  client: number;
  vendor: number;
  admin: number;
};

const permissionsList = [
  { id: ADMIN_PERMISSIONS.MANAGE_USERS, labelKey: "adminUsers.manageUsers" },
  { id: ADMIN_PERMISSIONS.MANAGE_VENDORS, labelKey: "adminUsers.manageVendors" },
  { id: ADMIN_PERMISSIONS.MANAGE_BOOKINGS, labelKey: "adminUsers.manageBookings" },
  { id: ADMIN_PERMISSIONS.VIEW_ANALYTICS, labelKey: "adminUsers.viewAnalytics" },
  { id: ADMIN_PERMISSIONS.MANAGE_SETTINGS, labelKey: "adminUsers.manageSettings" },
];

export default function UnifiedUsersPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isPermissionsDialogOpen, setIsPermissionsDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUserWithPermissions | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  
  const [newUserData, setNewUserData] = useState({
    username: "",
    email: "",
    password: "",
    fullName: "",
    phone: ""
  });

  // Fetch all users
  const { data: allUsers, isLoading: usersLoading, error: usersError, refetch: refetchUsers } = useQuery({
    queryKey: ['/api/users'],
    select: (data: User[]) => data || []
  });

  // Fetch admin users with permissions
  const { data: adminUsers, isLoading: adminLoading, error: adminError, refetch: refetchAdmins } = useQuery({
    queryKey: ['/api/admin/users'],
    select: (data: AdminUserWithPermissions[]) => data || []
  });

  // Calculate user counts
  const userCounts: UserCounts = {
    total: allUsers?.length || 0,
    client: allUsers?.filter(u => u.userType === 'client').length || 0,
    vendor: allUsers?.filter(u => u.userType === 'vendor').length || 0,
    admin: allUsers?.filter(u => u.userType === 'admin').length || 0
  };

  // Create admin user mutation
  const createAdminMutation = useMutation({
    mutationFn: async (userData: typeof newUserData) => {
      const res = await apiRequest("POST", "/api/admin/users", userData);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: t("common.success"),
        description: t("adminUsers.userCreated"),
      });
      setIsCreateDialogOpen(false);
      setNewUserData({ username: "", email: "", password: "", fullName: "", phone: "" });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
    onError: (error: any) => {
      toast({
        title: t("common.error"),
        description: error.message || t("adminUsers.createError"),
        variant: "destructive",
      });
    }
  });

  // Update permissions mutation
  const updatePermissionsMutation = useMutation({
    mutationFn: async ({ userId, permissions }: { userId: number; permissions: string[] }) => {
      const res = await apiRequest("PUT", `/api/admin/users/${userId}/permissions`, { permissions });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: t("common.success"),
        description: t("adminUsers.permissionsUpdated"),
      });
      setIsPermissionsDialogOpen(false);
      setSelectedUser(null);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
    },
    onError: (error: any) => {
      toast({
        title: t("common.error"),
        description: error.message || t("adminUsers.permissionsUpdateError"),
        variant: "destructive",
      });
    }
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      return apiRequest("DELETE", `/api/admin/users/${userId}`);
    },
    onSuccess: () => {
      toast({
        title: t("common.success"),
        description: t("adminUsers.userDeletedGeneric"),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
    onError: (error: any) => {
      toast({
        title: t("common.error"),
        description: error.message || t("adminUsers.deleteUserError"),
        variant: "destructive",
      });
    }
  });

  // Promote user to admin mutation
  const promoteToAdminMutation = useMutation({
    mutationFn: async (userId: number) => {
      return apiRequest("PATCH", `/api/admin/users/${userId}/promote`, { userType: "admin" });
    },
    onSuccess: () => {
      toast({
        title: t("common.success"),
        description: t("adminUsers.promoted"),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
    onError: (error: any) => {
      toast({
        title: t("common.error"),
        description: error.message || t("adminUsers.promoteError"),
        variant: "destructive",
      });
    }
  });

  const handleCreateAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserData.phone || !newUserData.password) {
      toast({
        title: t("adminUsers.validationError"),
        description: t("adminUsers.requiredFields"),
        variant: "destructive",
      });
      return;
    }
    createAdminMutation.mutate(newUserData);
  };

  const handleDeleteUser = (userId: number) => {
    if (confirm(t("adminUsers.confirmDeleteUserLong"))) {
      deleteUserMutation.mutate(userId);
    }
  };

  const handlePromoteUser = (userId: number) => {
    if (confirm(t("adminUsers.confirmPromote"))) {
      promoteToAdminMutation.mutate(userId);
    }
  };

  const handleManagePermissions = (adminUser: AdminUserWithPermissions) => {
    setSelectedUser({
      ...adminUser,
      permissions: adminUser.permissions || []
    });
    setIsPermissionsDialogOpen(true);
  };

  const togglePermission = (permission: string) => {
    if (!selectedUser) return;
    
    const updatedPermissions = selectedUser.permissions.includes(permission)
      ? selectedUser.permissions.filter(p => p !== permission)
      : [...selectedUser.permissions, permission];
    
    setSelectedUser({
      ...selectedUser,
      permissions: updatedPermissions
    });
  };

  const handleUpdatePermissions = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    
    updatePermissionsMutation.mutate({
      userId: selectedUser.id,
      permissions: selectedUser.permissions
    });
  };

  const getUserTypeIcon = (userType: string) => {
    switch (userType) {
      case 'admin':
        return <Crown className="h-4 w-4 text-yellow-600" />;
      case 'vendor':
        return <Shield className="h-4 w-4 text-blue-600" />;
      default:
        return <User className="h-4 w-4 text-gray-600" />;
    }
  };

  const getUserTypeBadge = (userType: string) => {
    const variants = {
      admin: "bg-yellow-100 text-yellow-800 border-yellow-200",
      vendor: "bg-blue-100 text-blue-800 border-blue-200", 
      client: "bg-green-100 text-green-800 border-green-200"
    } as const;

    return (
      <Badge className={variants[userType as keyof typeof variants] || variants.client}>
        {userType.charAt(0).toUpperCase() + userType.slice(1)}
      </Badge>
    );
  };

  const renderMobileUserCard = (rowUser: User) => (
    <div key={rowUser.id} className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {getUserTypeIcon(rowUser.userType)}
          <div className="min-w-0">
            <p className="truncate font-medium">{rowUser.fullName || rowUser.username}</p>
            <p className="truncate text-sm text-muted-foreground">@{rowUser.username}</p>
          </div>
        </div>
        {getUserTypeBadge(rowUser.userType)}
      </div>
      <div className="mt-3 space-y-1 text-sm text-muted-foreground">
        {rowUser.phone ? <p className="truncate">{rowUser.phone}</p> : null}
        {rowUser.email ? <p className="truncate font-mono">{rowUser.email}</p> : null}
        <p>{new Date(rowUser.createdAt).toLocaleDateString()}</p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={`/admin/messages?userId=${rowUser.id}`}>
          <Button variant="outline" size="sm">
            <MessageCircle className="h-4 w-4 mr-1" />
            {t("navigation.chat")}
          </Button>
        </Link>
        {rowUser.userType === 'client' && (
          <Button variant="outline" size="sm" onClick={() => handlePromoteUser(rowUser.id)}>
            <Crown className="h-4 w-4 mr-1" />
            {t("adminUsers.promoteToAdmin")}
          </Button>
        )}
        {rowUser.id !== user?.id && rowUser.userType !== 'admin' && (
          <Button variant="destructive" size="sm" onClick={() => handleDeleteUser(rowUser.id)}>
            <Trash2 className="h-4 w-4 mr-1" />
            {t("common.delete")}
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <AdminLayout title={t('adminUsers.title')}>
      <div className="space-y-6">
        {/* Header Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('adminUsers.title')}</CardTitle>
              <UsersIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{userCounts.total}</div>
              <p className="text-xs text-muted-foreground">
                {t("adminUsers.allRegisteredUsers")}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("adminUsers.clients")}</CardTitle>
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
              <CardTitle className="text-sm font-medium">{t("adminUsers.vendors")}</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
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
              <CardTitle className="text-sm font-medium">{t("adminUsers.admins")}</CardTitle>
              <Crown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{userCounts.admin}</div>
              <p className="text-xs text-muted-foreground">
                {t("adminUsers.platformAdmins")}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for different views */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex w-full justify-start overflow-x-auto">
            <TabsTrigger value="overview">{t('adminUsers.title')}</TabsTrigger>
            <TabsTrigger value="admins">{t('adminUsers.manageAdmins')}</TabsTrigger>
            <TabsTrigger value="clients">{t('adminUsers.manageVendors')}</TabsTrigger>
          </TabsList>

          {/* All Users Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold">{t('adminUsers.title')}</h2>
              </div>
            </div>

            {usersLoading ? (
              <div className="flex justify-center my-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : usersError ? (
              <div className="bg-destructive/10 text-destructive p-4 rounded-md mb-4">
                <p>{t("adminUsers.errorLoadingUsers")}: {(usersError as Error).message}</p>
                <Button variant="outline" onClick={() => refetchUsers()} className="mt-2">
                  {t("common.retry")}
                </Button>
              </div>
            ) : (
              <Card>
                <CardContent className="p-4 md:p-0">
                  <div className="space-y-3 md:hidden">
                    {allUsers?.map((user) => renderMobileUserCard(user))}
                  </div>
                  <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('common.name')}</TableHead>
                        <TableHead>{t('adminUsers.role')}</TableHead>
                        <TableHead>{t('adminUsers.email')}</TableHead>
                        <TableHead>{t('adminUsers.lastActive')}</TableHead>
                        <TableHead>{t('common.actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allUsers?.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getUserTypeIcon(user.userType)}
                              <div>
                                <p className="font-medium">{user.fullName || user.username}</p>
                                <p className="text-sm text-muted-foreground">@{user.username}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {getUserTypeBadge(user.userType)}
                          </TableCell>
                          <TableCell className="font-mono text-sm">{user.email}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(user.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Link href={`/admin/messages?userId=${user.id}`}>
                                <Button variant="ghost" size="sm">
                                  <MessageCircle className="h-4 w-4" />
                                </Button>
                              </Link>
                              {user.userType === 'client' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handlePromoteUser(user.id)}
                                  title={t("adminUsers.promoteToAdmin")}
                                >
                                  <Crown className="h-4 w-4" />
                                </Button>
                              )}
                              {user.id !== user?.id && user.userType !== 'admin' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteUser(user.id)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Admin Team Management Tab */}
          <TabsContent value="admins" className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold">{t('adminUsers.manageAdmins')}</h2>
              </div>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <PlusCircle className="h-4 w-4 mr-2" />
                    {t('adminUsers.createAdmin')}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[525px]">
                  <DialogHeader>
                    <DialogTitle>{t('adminUsers.createAdmin')}</DialogTitle>
                    <DialogDescription>{t("adminUsers.createAdminDescription")}</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateAdmin}>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                        <Label htmlFor="phone" className="text-left sm:text-right">{t("common.phone")}</Label>
                        <Input
                          id="phone"
                          type="tel"
                          value={newUserData.phone}
                          onChange={(e) => setNewUserData({ ...newUserData, phone: e.target.value })}
                          className="sm:col-span-3"
                          required
                        />
                      </div>
                      <div className="grid gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                        <Label htmlFor="password" className="text-left sm:text-right">{t("adminUsers.password")}</Label>
                        <Input
                          id="password"
                          type="password"
                          value={newUserData.password}
                          onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                          className="sm:col-span-3"
                          required
                        />
                      </div>
                      <div className="grid gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                        <Label htmlFor="username" className="text-left sm:text-right">{t("adminUsers.username")} ({t("common.optional")})</Label>
                        <Input
                          id="username"
                          value={newUserData.username}
                          onChange={(e) => setNewUserData({ ...newUserData, username: e.target.value })}
                          className="sm:col-span-3"
                        />
                      </div>
                      <div className="grid gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                        <Label htmlFor="email" className="text-left sm:text-right">{t("adminUsers.email")} ({t("common.optional")})</Label>
                        <Input
                          id="email"
                          type="email"
                          value={newUserData.email}
                          onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                          className="sm:col-span-3"
                        />
                      </div>
                      <div className="grid gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                        <Label htmlFor="fullName" className="text-left sm:text-right">{t("adminUsers.fullName")}</Label>
                        <Input
                          id="fullName"
                          value={newUserData.fullName}
                          onChange={(e) => setNewUserData({ ...newUserData, fullName: e.target.value })}
                          className="sm:col-span-3"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={createAdminMutation.isPending}>
                        {createAdminMutation.isPending && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        {t('adminUsers.createAdmin')}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {adminLoading ? (
              <div className="flex justify-center my-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : adminError ? (
              <div className="bg-destructive/10 text-destructive p-4 rounded-md mb-4">
                <p>{t("adminUsers.errorLoadingAdmins")}: {(adminError as Error).message}</p>
                <Button variant="outline" onClick={() => refetchAdmins()} className="mt-2">
                  {t("common.retry")}
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {adminUsers?.map((adminUser) => (
                  <Card key={adminUser.id}>
                    <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between gap-3">
                        <span>{adminUser.fullName || adminUser.username}</span>
                        {adminUser.id !== user?.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteUser(adminUser.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </CardTitle>
                      <CardDescription>@{adminUser.username}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="text-sm space-y-1">
                        <p className="text-muted-foreground">{adminUser.email}</p>
                        {adminUser.phone && <p className="text-muted-foreground">{adminUser.phone}</p>}
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">{t("adminUsers.permissions")}</Label>
                        <div className="flex flex-wrap gap-1">
                          {adminUser.permissions && adminUser.permissions.length > 0 ? (
                            adminUser.permissions.map((permission) => (
                              <div
                                key={permission}
                                className="bg-primary/10 text-primary px-2 py-1 rounded-full text-xs"
                              >
                                {t(permissionsList.find(p => p.id === permission)?.labelKey || permission)}
                              </div>
                            ))
                          ) : (
                            <div className="text-xs text-muted-foreground">{t("adminUsers.noPermissions")}</div>
                          )}
                        </div>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleManagePermissions(adminUser)}
                          className="w-full mt-2"
                        >
                          <UserCog className="h-4 w-4 mr-2" />
                          {t('adminUsers.editPermissions')}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Clients & Vendors Tab */}
          <TabsContent value="clients" className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold">{t('adminUsers.manageVendors')}</h2>
              </div>
            </div>

            <Card>
              <CardContent className="p-4 md:p-0">
                <div className="space-y-3 md:hidden">
                  {allUsers?.filter(u => u.userType !== 'admin').map((user) => renderMobileUserCard(user))}
                </div>
                <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('common.name')}</TableHead>
                      <TableHead>{t('adminUsers.role')}</TableHead>
                      <TableHead>{t('adminUsers.email')}</TableHead>
                      <TableHead>{t('adminUsers.lastActive')}</TableHead>
                      <TableHead>{t('common.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allUsers?.filter(u => u.userType !== 'admin').map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getUserTypeIcon(user.userType)}
                            <div>
                              <p className="font-medium">{user.fullName || user.username}</p>
                              <p className="text-sm text-muted-foreground">@{user.username}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getUserTypeBadge(user.userType)}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{user.email}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Link href={`/admin/messages?userId=${user.id}`}>
                              <Button variant="ghost" size="sm">
                                <MessageCircle className="h-4 w-4" />
                              </Button>
                            </Link>
                            {user.userType === 'client' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handlePromoteUser(user.id)}
                                  title={t("adminUsers.promoteToAdmin")}
                              >
                                <Crown className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteUser(user.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Permissions Management Dialog */}
        <Dialog open={isPermissionsDialogOpen} onOpenChange={setIsPermissionsDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t('adminUsers.editPermissions')}</DialogTitle>
            <DialogDescription>{t("adminUsers.editPermissionsDescription")}</DialogDescription>
          </DialogHeader>
            {selectedUser && (
              <form onSubmit={handleUpdatePermissions}>
                <div className="grid gap-4 py-4">
                  {permissionsList.map((permission) => (
                    <div key={permission.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`permission-${permission.id}`}
                        checked={selectedUser.permissions.includes(permission.id)}
                        onCheckedChange={() => togglePermission(permission.id)}
                      />
                      <Label htmlFor={`permission-${permission.id}`}>
                        {t(permission.labelKey)}
                      </Label>
                    </div>
                  ))}
                </div>
                <DialogFooter>
                  <Button 
                    type="submit" 
                    disabled={updatePermissionsMutation.isPending}
                  >
                    {updatePermissionsMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {t('common.save')}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
