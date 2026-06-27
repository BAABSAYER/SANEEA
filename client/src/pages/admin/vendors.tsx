import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { Filter, Loader2, Plus, Search, Star, Trash2, Upload } from "lucide-react";
import { AdminLayout } from "@/components/admin-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, authHeaders, queryClient } from "@/lib/queryClient";
import { SERVICE_CATEGORIES, Vendor } from "@shared/schema";

type SupplierService = {
  id: number;
  name: string;
  description?: string | null;
  price?: number | null;
  isPackage?: boolean | null;
};

type SupplierAttachment = {
  url: string;
  fileName?: string | null;
  description?: string | null;
  contentType?: string | null;
};

type SupplierDetails = Vendor & {
  email?: string | null;
  phone?: string | null;
  services?: SupplierService[];
  previousWork?: Array<{ title: string; description?: string | null; url?: string | null; imageUrl?: string | null }>;
  attachments?: SupplierAttachment[];
};

async function readOptionalJson(res: Response) {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function lines(value: FormDataEntryValue | null) {
  return String(value || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function parsePreviousWork(value: FormDataEntryValue | null) {
  return lines(value)
    .map((line) => {
      const [title, url, imageUrl, description] = line.split("|").map((part) => part?.trim() || "");
      return { title, url: url || null, imageUrl: imageUrl || null, description: description || null };
    })
    .filter((item) => item.title);
}

async function uploadSupplierAttachment(file: File, folder: string): Promise<SupplierAttachment> {
  const intentRes = await fetch("/api/admin/media/upload-intent", {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      folder,
    }),
  });

  if (!intentRes.ok) {
    const error = await intentRes.json().catch(() => null);
    throw new Error(error?.message || "Failed to prepare S3 upload");
  }

  const intent = await intentRes.json();
  if (!intent.uploadUrl) {
    throw new Error("S3 upload is not configured. Set S3_BUCKET and AWS_REGION on the backend.");
  }

  const uploadRes = await fetch(intent.uploadUrl, {
    method: "PUT",
    headers: intent.headers || { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });

  if (!uploadRes.ok) {
    const errorText = await uploadRes.text().catch(() => "");
    throw new Error(errorText || `Failed to upload attachment to S3 (${uploadRes.status})`);
  }

  return {
    url: intent.publicUrl as string,
    fileName: file.name,
    contentType: file.type || null,
    description: null,
  };
}

export default function AdminVendors() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [isAddingVendor, setIsAddingVendor] = useState(false);
  const [activeView, setActiveView] = useState<"vendors" | "services">("vendors");
  const [newVendorAttachments, setNewVendorAttachments] = useState<SupplierAttachment[]>([]);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);

  const { data: vendors = [], isLoading: isLoadingVendors } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
  });

  const { data: serviceSuppliers = [], isLoading: isLoadingServiceSuppliers } = useQuery<SupplierDetails[]>({
    queryKey: ["/api/vendors/with-services", vendors.map((vendor: any) => vendor.id).join(",")],
    enabled: activeView === "services" && vendors.length > 0,
    queryFn: async () => {
      const details = await Promise.all(
        vendors.map(async (vendor: any) => {
          const res = await apiRequest("GET", `/api/vendors/${vendor.id}`);
          return await res.json();
        })
      );
      return details;
    },
  });

  const createVendorMutation = useMutation({
    mutationFn: async (vendorData: any) => {
      const res = await apiRequest("POST", "/api/vendors", vendorData);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: t("adminVendors.vendorCreated"),
        description: t("adminVendors.vendorCreatedDescription"),
      });
      setIsAddingVendor(false);
      setNewVendorAttachments([]);
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
    },
    onError: (error) => {
      toast({
        title: t("adminVendors.vendorCreateError"),
        description: error instanceof Error ? error.message : t("common.error"),
        variant: "destructive",
      });
    },
  });

  const deleteVendorMutation = useMutation({
    mutationFn: async (vendorId: number) => {
      const res = await apiRequest("DELETE", `/api/vendors/${vendorId}`);
      return await readOptionalJson(res);
    },
    onSuccess: () => {
      toast({
        title: t("adminVendors.vendorDeleted"),
        description: t("adminVendors.vendorDeletedDescription"),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
    },
    onError: (error) => {
      toast({
        title: t("adminVendors.vendorDeleteError"),
        description: error instanceof Error ? error.message : t("common.error"),
        variant: "destructive",
      });
    },
  });

  const filteredVendors = vendors.filter((vendor: any) => {
    const matchesSearch = !searchTerm || vendor.businessName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !categoryFilter || categoryFilter === "all" || vendor.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  function handleAddVendor(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const vendorData = {
      businessName: formData.get("businessName") as string,
      category: formData.get("category") as string,
      description: formData.get("description") as string,
      phone: formData.get("phone") as string,
      email: String(formData.get("email") || "").trim() || undefined,
      address: formData.get("address") as string,
      city: formData.get("city") as string,
      priceRange: formData.get("priceRange") as string,
      photos: lines(formData.get("photos")),
      previousWork: parsePreviousWork(formData.get("previousWork")),
      attachments: newVendorAttachments,
    };

    createVendorMutation.mutate(vendorData);
  }

  function openVendor(vendorId: number) {
    navigate(`/admin/vendors/${vendorId}`);
  }

  function handleDeleteVendor(vendorId: number) {
    if (window.confirm(t("adminVendors.confirmDelete"))) {
      deleteVendorMutation.mutate(vendorId);
    }
  }

  async function handleSupplierAttachmentUpload(files: FileList | null) {
    if (!files?.length) return;
    setUploadingAttachments(true);
    try {
      const uploaded: SupplierAttachment[] = [];
      for (const file of Array.from(files)) {
        uploaded.push(await uploadSupplierAttachment(file, "saneea/suppliers/new-supplier/attachments"));
      }

      setNewVendorAttachments((current) => [...current, ...uploaded]);
      toast({
        title: t("adminVendors.attachmentsUploaded"),
        description: t("adminVendors.attachmentsUploadedDescription", { count: uploaded.length }),
      });
    } catch (error) {
      toast({
        title: t("adminVendors.uploadFailed"),
        description: error instanceof Error ? error.message : t("adminVendors.uploadFailedDescription"),
        variant: "destructive",
      });
    } finally {
      setUploadingAttachments(false);
    }
  }

  return (
    <AdminLayout title={t("adminVendors.title")}>
      <div className="space-y-6">
        <Tabs value={activeView} onValueChange={(value) => setActiveView(value as "vendors" | "services")} className="space-y-4">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="vendors">{t("navigation.vendors")}</TabsTrigger>
              <TabsTrigger value="services">{t("navigation.services")}</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="vendors" className="space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("adminVendors.searchPlaceholder")}
                  className="pl-8"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>

              <div className="flex gap-2 items-center">
                <Select value={categoryFilter || ""} onValueChange={(value) => setCategoryFilter(value || null)}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder={t("adminVendors.filterByCategory")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("adminVendors.allCategories")}</SelectItem>
                    {Object.entries(SERVICE_CATEGORIES).map(([key, value]) => (
                      <SelectItem key={key} value={key}>{value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Dialog open={isAddingVendor} onOpenChange={setIsAddingVendor}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      {t("adminVendors.addVendor")}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[560px]">
                    <DialogHeader>
                      <DialogTitle>{t("adminVendors.addNewVendor")}</DialogTitle>
                      <DialogDescription>{t("adminVendors.createVendorDescription")}</DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleAddVendor} className="space-y-4 pt-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="businessName">{t("vendorProfile.businessName")}</Label>
                          <Input id="businessName" name="businessName" required />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="category">{t("vendors.category")}</Label>
                          <Select name="category" required>
                            <SelectTrigger id="category">
                              <SelectValue placeholder={t("adminVendors.selectCategory")} />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(SERVICE_CATEGORIES).map(([key, value]) => (
                                <SelectItem key={key} value={key}>{value}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="phone">{t("common.phone")}</Label>
                          <Input id="phone" name="phone" type="tel" placeholder="05xxxxxxxx" required />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">{t("common.email")} ({t("common.optional")})</Label>
                          <Input id="email" name="email" type="email" />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="description">{t("common.description")}</Label>
                        <Textarea id="description" name="description" />
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="address">{t("common.address")}</Label>
                          <Input id="address" name="address" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="city">{t("vendorProfile.city")}</Label>
                          <Input id="city" name="city" />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="priceRange">{t("vendorProfile.priceRange")}</Label>
                        <Select name="priceRange">
                          <SelectTrigger id="priceRange">
                            <SelectValue placeholder={t("adminVendors.selectPriceRange")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="budget">{t("adminVendors.priceBudget")}</SelectItem>
                            <SelectItem value="moderate">{t("adminVendors.priceModerate")}</SelectItem>
                            <SelectItem value="premium">{t("adminVendors.pricePremium")}</SelectItem>
                            <SelectItem value="luxury">{t("adminVendors.priceLuxury")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="photos">{t("adminVendors.supplierPhotos")}</Label>
                        <Textarea id="photos" name="photos" placeholder={t("adminVendors.photosPlaceholder")} />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="previousWork">{t("adminVendors.previousWork")}</Label>
                        <Textarea id="previousWork" name="previousWork" placeholder={t("adminVendors.previousWorkPlaceholder")} />
                      </div>

                      <div className="space-y-2">
                        <Label>{t("adminVendors.supplierAttachments")}</Label>
                        <div className="flex flex-wrap items-center gap-2">
                          <Input
                            id="newSupplierAttachments"
                            type="file"
                            multiple
                            className="hidden"
                            onChange={(event) => handleSupplierAttachmentUpload(event.target.files)}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            disabled={uploadingAttachments}
                            onClick={() => document.getElementById("newSupplierAttachments")?.click()}
                          >
                            {uploadingAttachments ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                            {t("adminVendors.uploadAttachments")}
                          </Button>
                          <span className="text-xs text-muted-foreground">{t("adminVendors.filesUploadedBeforeSaving")}</span>
                        </div>
                        {newVendorAttachments.length > 0 ? (
                          <div className="rounded-md border p-3">
                            <p className="text-sm font-medium">{t("adminVendors.uploadedFiles")}</p>
                            <div className="mt-2 space-y-1">
                              {newVendorAttachments.map((attachment, index) => (
                                <div key={`${attachment.url}-${index}`} className="flex items-center justify-between gap-3 text-sm">
                                  <a href={attachment.url} target="_blank" rel="noreferrer" className="truncate text-primary">
                                    {attachment.fileName || attachment.description || attachment.url}
                                  </a>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setNewVendorAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                                  >
                                    {t("common.remove")}
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <DialogFooter>
                        <Button type="submit" disabled={createVendorMutation.isPending || uploadingAttachments}>
                          {createVendorMutation.isPending ? t("adminVendors.creating") : t("adminVendors.createVendor")}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>{t("navigation.vendors")}</CardTitle>
                <CardDescription>{t("adminVendors.manageProviders")}</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingVendors ? (
                  <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : filteredVendors.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("vendorProfile.businessName")}</TableHead>
                        <TableHead>{t("vendors.category")}</TableHead>
                        <TableHead>{t("common.phone")}</TableHead>
                        <TableHead>{t("vendors.rating")}</TableHead>
                        <TableHead>{t("common.actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredVendors.map((vendor: any) => (
                        <TableRow key={vendor.id}>
                          <TableCell className="font-medium">{vendor.businessName}</TableCell>
                          <TableCell>{SERVICE_CATEGORIES[vendor.category as keyof typeof SERVICE_CATEGORIES] || vendor.category}</TableCell>
                          <TableCell>{vendor.phone || t("adminVendors.notAvailable")}</TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <Star className="h-4 w-4 text-yellow-400 mr-1" />
                              <span>{vendor.rating ? vendor.rating.toFixed(1) : t("adminVendors.noRatings")}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button variant="ghost" size="sm" onClick={() => openVendor(vendor.id)}>
                                {t("common.viewDetails")}
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDeleteVendor(vendor.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="rounded-full bg-primary/10 p-3 mb-4">
                      <Filter className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">{t("adminVendors.noVendors")}</h3>
                    {searchTerm || categoryFilter ? (
                      <Button variant="link" onClick={() => { setSearchTerm(""); setCategoryFilter(null); }}>
                        {t("adminVendors.clearFilters")}
                      </Button>
                    ) : (
                      <Button variant="outline" className="mt-2" onClick={() => setIsAddingVendor(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        {t("adminVendors.addVendor")}
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="services" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t("navigation.services")}</CardTitle>
                <CardDescription>{t("adminVendors.servicesManagedInSupplierProfile")}</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingServiceSuppliers ? (
                  <div className="space-y-4">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : serviceSuppliers.length > 0 ? (
                  <div className="space-y-4">
                    {serviceSuppliers.map((supplier) => (
                      <div key={supplier.id} className="rounded-md border p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <h3 className="font-medium">{supplier.businessName}</h3>
                            <p className="text-sm text-muted-foreground">
                              {t("adminVendors.supplierStats", {
                                services: supplier.services?.length || 0,
                                previousWork: supplier.previousWork?.length || 0,
                              })}
                            </p>
                          </div>
                          <Button variant="outline" size="sm" onClick={() => openVendor(supplier.id)}>
                            {t("adminVendors.openSupplier")}
                          </Button>
                        </div>
                        {supplier.services?.length ? (
                          <div className="mt-4 grid gap-3 md:grid-cols-2">
                            {supplier.services.map((service) => (
                              <div key={service.id} className="rounded-md bg-muted/40 p-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <h4 className="text-sm font-medium">{service.name}</h4>
                                    {service.description ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{service.description}</p> : null}
                                  </div>
                                  {service.isPackage ? <Badge variant="secondary">{t("adminVendors.package")}</Badge> : null}
                                </div>
                                {service.price !== null && service.price !== undefined ? (
                                  <p className="mt-2 text-sm font-medium">{service.price.toLocaleString()} {t("common.sar")}</p>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-4 text-sm text-muted-foreground">{t("adminVendors.noSupplierServices")}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="rounded-full bg-primary/10 p-3 mb-4">
                      <Filter className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">{t("adminVendors.noSupplierServicesYet")}</h3>
                    <p className="text-muted-foreground text-sm max-w-md">{t("adminVendors.noSupplierServicesDescription")}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
