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
import { useToast } from "@/hooks/use-toast";
import { Loader2, PlusCircle, UserCog, Trash2, Save, MessageCircle, Edit } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ADMIN_PERMISSIONS } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";

type AdminUserWithPermissions = {
  id: number;
  username: string;
  email: string;
  fullName?: string;
  phone?: string;
  userType: string;
  permissions: string[];
};

type AdminPermission = {
  id: string;
  labelKey: string;
};

const permissionLabelKeys: Record<string, string> = {
  [ADMIN_PERMISSIONS.MANAGE_USERS]: "adminUsers.manageUsers",
  [ADMIN_PERMISSIONS.MANAGE_VENDORS]: "adminUsers.manageVendors",
  [ADMIN_PERMISSIONS.MANAGE_BOOKINGS]: "adminUsers.manageBookings",
  [ADMIN_PERMISSIONS.MANAGE_ADMINS]: "adminUsers.manageAdmins",
  [ADMIN_PERMISSIONS.VIEW_ANALYTICS]: "adminUsers.viewAnalytics",
  [ADMIN_PERMISSIONS.MANAGE_SETTINGS]: "adminUsers.manageSettings",
};

const permissionsList: AdminPermission[] = Object.values(ADMIN_PERMISSIONS).map((value) => ({
  id: value,
  labelKey: permissionLabelKeys[value] || value,
}));

export default function AdminUsersPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isPermissionsDialogOpen, setIsPermissionsDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUserWithPermissions | null>(null);
  const [newUserData, setNewUserData] = useState({
    username: "",
    password: "",
    email: "",
    fullName: "",
    phone: "",
    permissions: [] as string[]
  });

  // Fetch all users (including mobile users)
  const { data: allUsers, isLoading: isLoadingAllUsers, error: allUsersError } = useQuery({
    queryKey: ["/api/users"],
    enabled: !!user && user.userType === 'admin',
    retry: 1,
    staleTime: 30000
  });

  // Fetch admin users
  const { data: adminUsers, isLoading, error, refetch } = useQuery<AdminUserWithPermissions[]>({
    queryKey: ["/api/admin/users"],
    enabled: !!user,
    retry: 1,
    staleTime: 30000
  });

  // Check admin permission
  const { data: hasAdminPermission } = useQuery<boolean>({
    queryKey: ["/api/admin/check-permission", "manage_admins"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/check-permission?permission=manage_admins");
      return await res.json();
    },
    enabled: !!user
  });

  // Create admin mutation
  const createAdminMutation = useMutation({
    mutationFn: async (data: typeof newUserData) => {
      const res = await apiRequest("POST", "/api/admin/users", data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || t("adminUsers.createError"));
      }
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: t("common.success"),
        description: t("adminUsers.userCreated"),
      });
      setIsCreateDialogOpen(false);
      setNewUserData({
        username: "",
        password: "",
        email: "",
        fullName: "",
        phone: "",
        permissions: []
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Update permissions mutation
  const updatePermissionsMutation = useMutation({
    mutationFn: async ({ userId, permissions }: { userId: number; permissions: string[] }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${userId}/permissions`, { permissions });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || t("adminUsers.permissionsUpdateError"));
      }
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: t("common.success"),
        description: t("adminUsers.permissionsUpdated"),
      });
      setIsPermissionsDialogOpen(false);
      setSelectedUser(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Delete admin mutation
  const deleteAdminMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest("DELETE", `/api/admin/users/${userId}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || t("adminUsers.deleteError"));
      }
    },
    onSuccess: () => {
      toast({
        title: t("common.success"),
        description: t("adminUsers.userDeleted"),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleCreateAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserData.username || !newUserData.password || !newUserData.email) {
      toast({
        title: t("adminUsers.validationError"),
        description: t("adminUsers.requiredFields"),
        variant: "destructive"
      });
      return;
    }
    createAdminMutation.mutate(newUserData);
  };

  const handleUpdatePermissions = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    updatePermissionsMutation.mutate({
      userId: selectedUser.id,
      permissions: selectedUser.permissions
    });
  };

  const handleDeleteAdmin = (userId: number) => {
    if (confirm(t("adminUsers.confirmDeleteLong"))) {
      deleteAdminMutation.mutate(userId);
    }
  };

  const handleDeleteUser = (userId: number) => {
    if (confirm(t("adminUsers.confirmDeleteUserLong"))) {
      // Add delete user mutation here
      toast({
        title: t("common.comingSoon"),
        description: t("adminUsers.deleteUserComingSoon"),
        variant: "default"
      });
    }
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

  const toggleNewUserPermission = (permission: string) => {
    const updatedPermissions = newUserData.permissions.includes(permission)
      ? newUserData.permissions.filter(p => p !== permission)
      : [...newUserData.permissions, permission];

    setNewUserData({
      ...newUserData,
      permissions: updatedPermissions
    });
  };

  if (!hasAdminPermission) {
    return (
      <AdminLayout title={t('adminUsers.title')}>
        <div className="flex flex-col items-center justify-center h-[50vh]">
          <UserCog className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">{t('common.error')}</h2>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={t('adminUsers.title')}>
      <div className="space-y-8">
        {/* All Users Section */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">{t('adminUsers.title')}</h2>
            </div>
          </div>
          
          {isLoadingAllUsers ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto" />
              <p className="text-muted-foreground mt-2">{t("adminUsers.loadingUsers")}</p>
            </div>
          ) : allUsersError ? (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-red-500">{t("adminUsers.errorLoadingUsers")}: {(allUsersError as any).message}</p>
              </CardContent>
            </Card>
          ) : allUsers && Array.isArray(allUsers) && allUsers.length > 0 ? (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('common.name')}</TableHead>
                    <TableHead>{t('adminUsers.email')}</TableHead>
                    <TableHead>{t('vendorProfile.phone')}</TableHead>
                    <TableHead>{t('adminUsers.role')}</TableHead>
                    <TableHead>{t('adminUsers.lastActive')}</TableHead>
                    <TableHead>{t('common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(allUsers as any[]).map((user: any) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{user.fullName || user.username}</div>
                          <div className="text-sm text-muted-foreground">@{user.username}</div>
                        </div>
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.phone || t("adminUsers.notProvided")}</TableCell>
                      <TableCell>
                        <Badge variant={user.userType === 'admin' ? 'default' : 'secondary'}>
                          {user.userType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                          >
                            <Link href={`/admin/messages?userId=${user.id}`}>
                              <MessageCircle className="h-4 w-4 mr-1" />
                              {t("navigation.chat")}
                            </Link>
                          </Button>
                          {user.userType !== 'admin' && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteUser(user.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              {t("common.delete")}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <UserCog className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">{t('adminUsers.noUsers')}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Admin Users Management Section */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
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
                </DialogHeader>
                <form onSubmit={handleCreateAdmin}>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="username" className="text-right">
                        {t('adminUsers.username')}
                      </Label>
                      <Input
                        id="username"
                        value={newUserData.username}
                        onChange={(e) => setNewUserData({ ...newUserData, username: e.target.value })}
                        className="col-span-3"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="password" className="text-right">
                        {t("adminUsers.password")}
                      </Label>
                      <Input
                        id="password"
                        type="password"
                        value={newUserData.password}
                        onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                        className="col-span-3"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="email" className="text-right">
                        {t('adminUsers.email')}
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={newUserData.email}
                        onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                        className="col-span-3"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="fullName" className="text-right">
                        {t('adminUsers.fullName')}
                      </Label>
                      <Input
                        id="fullName"
                        value={newUserData.fullName}
                        onChange={(e) => setNewUserData({ ...newUserData, fullName: e.target.value })}
                        className="col-span-3"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="phone" className="text-right">
                        {t("common.phone")}
                      </Label>
                      <Input
                        id="phone"
                        value={newUserData.phone}
                        onChange={(e) => setNewUserData({ ...newUserData, phone: e.target.value })}
                        className="col-span-3"
                      />
                    </div>
                    <div className="mt-4">
                      <Label className="mb-2 block">{t("adminUsers.permissions")}</Label>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        {permissionsList.map((permission) => (
                          <div key={permission.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`new-permission-${permission.id}`}
                              checked={newUserData.permissions.includes(permission.id)}
                              onCheckedChange={() => toggleNewUserPermission(permission.id)}
                            />
                            <Label htmlFor={`new-permission-${permission.id}`} className="text-sm">
                              {t(permission.labelKey)}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button 
                      type="submit" 
                      disabled={createAdminMutation.isPending}
                    >
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

          {isLoading ? (
            <div className="flex justify-center my-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="bg-destructive/10 text-destructive p-4 rounded-md mb-4">
              <p>{t("adminUsers.errorLoadingAdmins")}: {(error as Error).message}</p>
              <Button variant="outline" onClick={() => refetch()} className="mt-2">
                {t("common.retry")}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {adminUsers?.map((adminUser) => (
                <Card key={adminUser.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex justify-between items-center">
                      <span>{adminUser.fullName || adminUser.username}</span>
                      {adminUser.id !== user?.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteAdmin(adminUser.id)}
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
                      
                      <Dialog open={isPermissionsDialogOpen && selectedUser?.id === adminUser.id} onOpenChange={(open) => {
                        setIsPermissionsDialogOpen(open);
                        if (!open) setSelectedUser(null);
                      }}>
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full"
                            onClick={() => {
                              setSelectedUser(adminUser);
                              setIsPermissionsDialogOpen(true);
                            }}
                          >
                            <UserCog className="h-4 w-4 mr-2" />
                            {t('adminUsers.editPermissions')}
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>{t('adminUsers.editPermissions')}</DialogTitle>
                          </DialogHeader>
                          {selectedUser && (
                            <form onSubmit={handleUpdatePermissions}>
                              <div className="grid grid-cols-2 gap-4 py-4">
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
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
