import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Star, Plus, Edit, Trash2, Search, Filter } from "lucide-react";
import { SERVICE_CATEGORIES, Vendor } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

type SupplierService = {
  id: number;
  name: string;
  description?: string | null;
  price?: number | null;
  duration?: number | null;
  isPackage?: boolean | null;
};

type SupplierDetails = Vendor & {
  email?: string | null;
  phone?: string | null;
  services?: SupplierService[];
  previousWork?: Array<{ title: string; description?: string | null; url?: string | null; imageUrl?: string | null }>;
  attachments?: Array<{ url: string; fileName?: string | null; description?: string | null; contentType?: string | null }>;
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
  return lines(value).map((line) => {
    const [title, url, imageUrl, description] = line.split("|").map((part) => part?.trim() || "");
    return { title, url: url || null, imageUrl: imageUrl || null, description: description || null };
  }).filter((item) => item.title);
}

function parseAttachments(value: FormDataEntryValue | null) {
  return lines(value).map((line) => {
    const [url, fileName, description] = line.split("|").map((part) => part?.trim() || "");
    return { url, fileName: fileName || null, description: description || null, contentType: null };
  }).filter((item) => item.url);
}

function previousWorkToText(value: any[] | null | undefined) {
  return (value || [])
    .map((item) => [item.title || "", item.url || "", item.imageUrl || "", item.description || ""].join(" | "))
    .join("\n");
}

function attachmentsToText(value: any[] | null | undefined) {
  return (value || [])
    .map((item) => [item.url || "", item.fileName || "", item.description || ""].join(" | "))
    .join("\n");
}

export default function AdminVendors() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [isAddingVendor, setIsAddingVendor] = useState(false);
  const [isViewingVendor, setIsViewingVendor] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [activeView, setActiveView] = useState<'vendors' | 'services'>('vendors');
  
  // Fetch vendors
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

  const { data: selectedVendorDetails, isLoading: isLoadingSelectedVendorDetails } = useQuery<SupplierDetails>({
    queryKey: ["/api/vendors", selectedVendor?.id],
    enabled: isViewingVendor && Boolean(selectedVendor?.id),
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/vendors/${selectedVendor.id}`);
      return await res.json();
    },
  });

  useEffect(() => {
    if (selectedVendorDetails) {
      setSelectedVendor((current: any) => current?.id === selectedVendorDetails.id
        ? { ...current, ...selectedVendorDetails }
        : current);
    }
  }, [selectedVendorDetails]);
  
  // Create vendor mutation
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
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
    },
    onError: (error) => {
      toast({
        title: t("adminVendors.vendorCreateError"),
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Delete vendor mutation
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
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateVendorMutation = useMutation({
    mutationFn: async (vendorData: any) => {
      const res = await apiRequest("PATCH", `/api/vendors/${vendorData.id}`, vendorData);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: t("adminVendors.vendorUpdated"),
        description: t("adminVendors.vendorUpdatedDescription"),
      });
      setIsViewingVendor(false);
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
    },
    onError: (error) => {
      toast({
        title: t("adminVendors.vendorUpdateError"),
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const handleAddVendor = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const vendorData = {
      businessName: formData.get("businessName") as string,
      category: formData.get("category") as string,
      description: formData.get("description") as string,
      email: String(formData.get("email") || "").trim() || undefined,
      phone: formData.get("phone") as string,
      address: formData.get("address") as string,
      city: formData.get("city") as string,
      priceRange: formData.get("priceRange") as string,
      photos: lines(formData.get("photos")),
      previousWork: parsePreviousWork(formData.get("previousWork")),
      attachments: parseAttachments(formData.get("attachments")),
    };
    
    createVendorMutation.mutate(vendorData);
  };
  
  const handleViewVendor = (vendor: any) => {
    setSelectedVendor({ ...vendor });
    setIsViewingVendor(true);
  };
  
  const handleDeleteVendor = (vendorId: number) => {
    if (window.confirm(t("adminVendors.confirmDelete"))) {
      deleteVendorMutation.mutate(vendorId);
    }
  };

  const handleUpdateVendor = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedVendor) return;
    updateVendorMutation.mutate(selectedVendor);
  };
  
  const filteredVendors = vendors.filter((vendor: any) => {
    const matchesSearch = !searchTerm || 
      vendor.businessName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = !categoryFilter || categoryFilter === "all" || vendor.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  return (
    <AdminLayout title={t("adminVendors.title")}>
      <div className="space-y-6">
        <Tabs value={activeView} onValueChange={(value) => setActiveView(value as 'vendors' | 'services')} className="space-y-4">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="vendors">{t("navigation.vendors")}</TabsTrigger>
              <TabsTrigger value="services">{t("navigation.services")}</TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="vendors" className="space-y-4">
            {/* Search & Filter */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("adminVendors.searchPlaceholder")}
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <div className="flex gap-2 items-center">
                <Select 
                  value={categoryFilter || ""} 
                  onValueChange={(value) => setCategoryFilter(value || null)}
                >
                  <SelectTrigger className="w-[180px]">
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
                  <DialogContent className="sm:max-w-[550px]">
                    <DialogHeader>
                      <DialogTitle>{t("adminVendors.addNewVendor")}</DialogTitle>
                      <DialogDescription>
                        {t("adminVendors.createVendorDescription")}
                      </DialogDescription>
                    </DialogHeader>
                    
                    <form onSubmit={handleAddVendor} className="space-y-4 pt-4">
                      <div className="grid grid-cols-2 gap-4">
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
                      
                      <div className="space-y-2">
                        <Label htmlFor="description">{t("common.description")}</Label>
                        <Textarea id="description" name="description" />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="email">{t("common.email")}</Label>
                          <Input id="email" name="email" type="email" />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="phone">{t("common.phone")}</Label>
                          <Input id="phone" name="phone" />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
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
                        <Label htmlFor="photos">Supplier photos</Label>
                        <Textarea id="photos" name="photos" placeholder="One image URL per line" />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="previousWork">Previous work</Label>
                        <Textarea id="previousWork" name="previousWork" placeholder="Title | link URL | image URL | description" />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="attachments">Attachments</Label>
                        <Textarea id="attachments" name="attachments" placeholder="File URL | file name | description" />
                      </div>
                      
                      <DialogFooter>
                        <Button 
                          variant="outline" 
                          type="button" 
                          onClick={() => setIsAddingVendor(false)}
                        >
                          {t("common.cancel")}
                        </Button>
                        <Button 
                          type="submit" 
                          disabled={createVendorMutation.isPending}
                        >
                          {createVendorMutation.isPending ? t("adminVendors.creating") : t("adminVendors.createVendor")}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
            
            {/* Vendors Table */}
            <Card>
              <CardHeader>
                <CardTitle>{t("navigation.vendors")}</CardTitle>
                <CardDescription>
                  {t("adminVendors.manageProviders")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingVendors ? (
                  <div className="space-y-4">
                    <Skeleton className="h-4 w-full" />
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
                        <TableHead>{t("common.location")}</TableHead>
                        <TableHead>{t("vendors.rating")}</TableHead>
                        <TableHead>{t("vendorProfile.priceRange")}</TableHead>
                        <TableHead className="text-right">{t("common.actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredVendors.map((vendor: any) => (
                        <TableRow key={vendor.id}>
                          <TableCell className="font-medium">{vendor.businessName}</TableCell>
                          <TableCell>
                            {SERVICE_CATEGORIES[vendor.category as keyof typeof SERVICE_CATEGORIES] || vendor.category}
                          </TableCell>
                          <TableCell>{vendor.city || t("adminVendors.notAvailable")}</TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <Star className="h-4 w-4 text-yellow-400 mr-1" />
                              <span>{vendor.rating ? vendor.rating.toFixed(1) : t("adminVendors.notAvailable")}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {vendor.priceRange && (
                              <Badge variant="outline" className="capitalize">
                                {vendor.priceRange}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleViewVendor(vendor)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="text-destructive hover:text-destructive" 
                                onClick={() => handleDeleteVendor(vendor.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-muted-foreground">{t("adminVendors.noVendors")}</p>
                    {searchTerm || categoryFilter ? (
                      <Button 
                        variant="link" 
                        onClick={() => {
                          setSearchTerm("");
                          setCategoryFilter(null);
                        }}
                      >
                        {t("adminVendors.clearFilters")}
                      </Button>
                    ) : (
                      <Button 
                        variant="outline" 
                        className="mt-2" 
                        onClick={() => setIsAddingVendor(true)}
                      >
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
                <CardDescription>
                  Services are managed inside each supplier profile.
                </CardDescription>
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
                              {supplier.services?.length || 0} services · {supplier.previousWork?.length || 0} previous work items
                            </p>
                          </div>
                          <Button variant="outline" size="sm" onClick={() => handleViewVendor(supplier)}>
                            Open supplier
                          </Button>
                        </div>
                        {supplier.services?.length ? (
                          <div className="mt-4 grid gap-3 md:grid-cols-2">
                            {supplier.services.map((service) => (
                              <div key={service.id} className="rounded-md bg-muted/40 p-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <h4 className="text-sm font-medium">{service.name}</h4>
                                    {service.description ? (
                                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{service.description}</p>
                                    ) : null}
                                  </div>
                                  {service.isPackage ? <Badge variant="secondary">Package</Badge> : null}
                                </div>
                                {service.price !== null && service.price !== undefined ? (
                                  <p className="mt-2 text-sm font-medium">{service.price.toLocaleString()} SAR</p>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-4 text-sm text-muted-foreground">No services added for this supplier yet.</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="rounded-full bg-primary/10 p-3 mb-4">
                      <Filter className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">No supplier services yet</h3>
                    <p className="text-muted-foreground text-sm max-w-md">
                      Add suppliers first, then open each supplier profile to review services and previous work.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        
        {/* Vendor Details Dialog */}
        <Dialog open={isViewingVendor} onOpenChange={setIsViewingVendor}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>{t("adminVendors.vendorDetails")}</DialogTitle>
              <DialogDescription>
                {selectedVendor ? selectedVendor.businessName : t("adminVendors.vendorDetailsDescription")}
              </DialogDescription>
            </DialogHeader>
            
            {selectedVendor && (
              <form onSubmit={handleUpdateVendor} className="space-y-4">
                {isLoadingSelectedVendorDetails ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : null}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="editBusinessName">{t("vendorProfile.businessName")}</Label>
                    <Input id="editBusinessName" value={selectedVendor.businessName || ""} onChange={(e) => setSelectedVendor({ ...selectedVendor, businessName: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("vendors.category")}</Label>
                    <Select value={selectedVendor.category || ""} onValueChange={(value) => setSelectedVendor({ ...selectedVendor, category: value })}>
                      <SelectTrigger>
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
                
                <div className="space-y-2">
                  <Label htmlFor="editDescription">{t("common.description")}</Label>
                  <Textarea id="editDescription" value={selectedVendor.description || ""} onChange={(e) => setSelectedVendor({ ...selectedVendor, description: e.target.value })} />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="editEmail">{t("adminVendors.contactEmail")}</Label>
                    <Input id="editEmail" type="email" value={selectedVendor.email || ""} onChange={(e) => setSelectedVendor({ ...selectedVendor, email: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editPhone">{t("common.phone")}</Label>
                    <Input id="editPhone" value={selectedVendor.phone || ""} onChange={(e) => setSelectedVendor({ ...selectedVendor, phone: e.target.value })} />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="editAddress">{t("common.address")}</Label>
                    <Input id="editAddress" value={selectedVendor.address || ""} onChange={(e) => setSelectedVendor({ ...selectedVendor, address: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editCity">{t("vendorProfile.city")}</Label>
                    <Input id="editCity" value={selectedVendor.city || ""} onChange={(e) => setSelectedVendor({ ...selectedVendor, city: e.target.value })} />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("vendorProfile.priceRange")}</Label>
                    <Select value={selectedVendor.priceRange || ""} onValueChange={(value) => setSelectedVendor({ ...selectedVendor, priceRange: value })}>
                      <SelectTrigger>
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
                  <div>
                    <h4 className="text-sm font-medium mb-1">{t("vendors.rating")}</h4>
                    <div className="flex items-center">
                      <Star className="h-4 w-4 text-yellow-400 mr-1" />
                      <span>{selectedVendor.rating ? selectedVendor.rating.toFixed(1) : t("adminVendors.noRatings")}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editPhotos">Supplier photos</Label>
                  <Textarea
                    id="editPhotos"
                    value={(selectedVendor.photos || []).join("\n")}
                    placeholder="One image URL per line"
                    onChange={(e) => setSelectedVendor({ ...selectedVendor, photos: lines(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editPreviousWork">Previous work</Label>
                  <Textarea
                    id="editPreviousWork"
                    value={previousWorkToText(selectedVendor.previousWork)}
                    placeholder="Title | link URL | image URL | description"
                    onChange={(e) => setSelectedVendor({ ...selectedVendor, previousWork: parsePreviousWork(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editAttachments">Attachments</Label>
                  <Textarea
                    id="editAttachments"
                    value={attachmentsToText(selectedVendor.attachments)}
                    placeholder="File URL | file name | description"
                    onChange={(e) => setSelectedVendor({ ...selectedVendor, attachments: parseAttachments(e.target.value) })}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-md border p-3">
                    <h4 className="text-sm font-medium">Previous work</h4>
                    <p className="text-sm text-muted-foreground">{selectedVendor.previousWork?.length || 0} items</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <h4 className="text-sm font-medium">Attachments</h4>
                    <p className="text-sm text-muted-foreground">{selectedVendor.attachments?.length || 0} files</p>
                  </div>
                </div>

                <div className="space-y-3 rounded-md border p-4">
                  <div>
                    <h4 className="font-medium">Supplier page preview</h4>
                    <p className="text-sm text-muted-foreground">
                      This is the supplier-facing profile content: info, previous work, attachments, and services.
                    </p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-md bg-muted/40 p-3">
                      <h5 className="text-sm font-medium">Info</h5>
                      <p className="mt-1 text-sm text-muted-foreground">{selectedVendor.description || "No description added."}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {[selectedVendor.category, selectedVendor.city, selectedVendor.priceRange].filter(Boolean).join(" · ") || "No category/location added"}
                      </p>
                    </div>

                    <div className="rounded-md bg-muted/40 p-3">
                      <h5 className="text-sm font-medium">Attachments</h5>
                      {selectedVendor.attachments?.length ? (
                        <div className="mt-2 space-y-1">
                          {selectedVendor.attachments.slice(0, 4).map((attachment: any, index: number) => (
                            <a
                              key={`${attachment.url}-${index}`}
                              href={attachment.url}
                              target="_blank"
                              rel="noreferrer"
                              className="block truncate text-xs text-primary"
                            >
                              {attachment.fileName || attachment.description || attachment.url}
                            </a>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1 text-sm text-muted-foreground">No attachments added.</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <h5 className="mb-2 text-sm font-medium">Previous work</h5>
                    {selectedVendor.previousWork?.length ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        {selectedVendor.previousWork.map((work: any, index: number) => (
                          <div key={`${work.title}-${index}`} className="rounded-md bg-muted/40 p-3">
                            <h6 className="text-sm font-medium">{work.title}</h6>
                            {work.description ? <p className="mt-1 text-xs text-muted-foreground">{work.description}</p> : null}
                            {work.url ? (
                              <a href={work.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-primary">
                                Open work link
                              </a>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No previous work added.</p>
                    )}
                  </div>

                  <div>
                    <h5 className="mb-2 text-sm font-medium">Services</h5>
                    {selectedVendor.services?.length ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        {selectedVendor.services.map((service: SupplierService) => (
                          <div key={service.id} className="rounded-md bg-muted/40 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <h6 className="text-sm font-medium">{service.name}</h6>
                              {service.isPackage ? <Badge variant="secondary">Package</Badge> : null}
                            </div>
                            {service.description ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{service.description}</p> : null}
                            {service.price !== null && service.price !== undefined ? (
                              <p className="mt-2 text-sm font-medium">{service.price.toLocaleString()} SAR</p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No services added for this supplier yet.</p>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" type="button" onClick={() => setIsViewingVendor(false)}>
                    {t("common.close")}
                  </Button>
                  <Button type="submit" disabled={updateVendorMutation.isPending}>
                    {updateVendorMutation.isPending ? t("vendorProfile.saving") : t("common.save")}
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
