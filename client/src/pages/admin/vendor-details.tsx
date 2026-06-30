import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link, useRoute } from "wouter";
import { ArrowLeft, Download, ExternalLink, FileText, Loader2, Star, Upload } from "lucide-react";
import { AdminLayout } from "@/components/admin-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, authHeaders, queryClient } from "@/lib/queryClient";
import { SERVICE_CATEGORIES, Vendor } from "@shared/schema";

type SupplierService = {
  id: number;
  name: string;
  description?: string | null;
  price?: number | null;
  duration?: number | null;
  isPackage?: boolean | null;
};

type SupplierAttachment = {
  url: string;
  fileName?: string | null;
  description?: string | null;
  contentType?: string | null;
};

type SupplierPreviousWork = {
  title: string;
  description?: string | null;
  url?: string | null;
  imageUrl?: string | null;
};

type SupplierDetails = Vendor & {
  email?: string | null;
  phone?: string | null;
  photos?: string[];
  services?: SupplierService[];
  previousWork?: SupplierPreviousWork[];
  attachments?: SupplierAttachment[];
};

function lines(value: string | null | undefined) {
  return String(value || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function parsePreviousWork(value: string | null | undefined): SupplierPreviousWork[] {
  return lines(value)
    .map((line) => {
      const [title, url, imageUrl, description] = line.split("|").map((part) => part?.trim() || "");
      return { title, url: url || null, imageUrl: imageUrl || null, description: description || null };
    })
    .filter((item) => item.title);
}

function previousWorkToText(value: SupplierPreviousWork[] | null | undefined) {
  return (value || [])
    .map((item) => [item.title || "", item.url || "", item.imageUrl || "", item.description || ""].join(" | "))
    .join("\n");
}

function isImageFile(value?: string | null, contentType?: string | null) {
  if (contentType?.toLowerCase().startsWith("image/")) return true;
  return /\.(apng|avif|gif|jpe?g|png|webp|bmp|svg)(\?.*)?$/i.test(value || "");
}

function isVideoFile(value?: string | null, contentType?: string | null) {
  if (contentType?.toLowerCase().startsWith("video/")) return true;
  return /\.(mp4|mov|m4v|webm|ogg)(\?.*)?$/i.test(value || "");
}

function isPdfFile(value?: string | null, contentType?: string | null) {
  if (contentType?.toLowerCase().includes("pdf")) return true;
  return /\.pdf(\?.*)?$/i.test(value || "");
}

function attachmentLabel(attachment: SupplierAttachment) {
  return attachment.fileName || attachment.description || attachment.url.split("/").pop() || attachment.url;
}

function AttachmentPreview({
  attachment,
  onRemove,
}: {
  attachment: SupplierAttachment;
  onRemove?: () => void;
}) {
  const { t } = useTranslation();
  const isImage = isImageFile(attachment.url, attachment.contentType);
  const isVideo = isVideoFile(attachment.url, attachment.contentType);
  const isPdf = isPdfFile(attachment.url, attachment.contentType);
  const label = attachmentLabel(attachment);

  return (
    <div className="overflow-hidden rounded-md border bg-background shadow-sm">
      <div className="bg-muted/20">
        {isImage ? (
          <img src={attachment.url} alt={label} className="h-52 w-full object-cover" loading="lazy" />
        ) : isVideo ? (
          <video
            src={attachment.url}
            className="h-52 w-full bg-black object-contain"
            controls
            preload="metadata"
          >
            {label}
          </video>
        ) : isPdf ? (
          <iframe
            src={attachment.url}
            title={label}
            className="h-72 w-full bg-white"
            loading="lazy"
          />
        ) : (
          <div className="flex h-52 flex-col items-center justify-center gap-2 bg-muted/50 px-3 text-center text-muted-foreground">
            <FileText className="h-8 w-8" />
            <span className="line-clamp-2 text-xs">{label}</span>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 border-t px-3 py-2">
        <span className="min-w-0 truncate text-xs font-medium text-foreground" title={label}>
          {label}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" asChild>
            <a href={attachment.url} target="_blank" rel="noreferrer" aria-label={label}>
              <Download className="h-3.5 w-3.5" />
            </a>
          </Button>
          {onRemove ? (
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={onRemove}>
              {t("common.remove")}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
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

export default function AdminVendorDetails() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [, params] = useRoute("/admin/vendors/:id");
  const vendorId = Number(params?.id);
  const [form, setForm] = useState<SupplierDetails | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: vendor, isLoading } = useQuery<SupplierDetails>({
    queryKey: ["/api/vendors", vendorId],
    enabled: Number.isFinite(vendorId),
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/vendors/${vendorId}`);
      return await res.json();
    },
  });

  useEffect(() => {
    if (vendor) {
      setForm({
        ...vendor,
        photos: Array.isArray(vendor.photos) ? vendor.photos : [],
        previousWork: Array.isArray(vendor.previousWork) ? vendor.previousWork : [],
        attachments: Array.isArray(vendor.attachments) ? vendor.attachments : [],
      });
    }
  }, [vendor]);

  const updateVendorMutation = useMutation({
    mutationFn: async (vendorData: SupplierDetails) => {
      const res = await apiRequest("PATCH", `/api/vendors/${vendorData.id}`, vendorData);
      return await res.json();
    },
    onSuccess: (updated) => {
      toast({
        title: t("adminVendors.vendorUpdated"),
        description: t("adminVendors.vendorUpdatedDescription"),
      });
      setForm((current) => current ? { ...current, ...updated } : current);
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendors", vendorId] });
    },
    onError: (error) => {
      toast({
        title: t("adminVendors.vendorUpdateError"),
        description: error instanceof Error ? error.message : t("common.error"),
        variant: "destructive",
      });
    },
  });

  async function handleAttachmentUpload(files: FileList | null) {
    if (!files?.length || !form) return;
    setUploading(true);
    try {
      const uploaded: SupplierAttachment[] = [];
      for (const file of Array.from(files)) {
        uploaded.push(await uploadSupplierAttachment(file, `saneea/suppliers/supplier-${form.id}/attachments`));
      }

      setForm({
        ...form,
        attachments: [...(form.attachments || []), ...uploaded],
      });

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
      setUploading(false);
    }
  }

  function updateField<K extends keyof SupplierDetails>(key: K, value: SupplierDetails[K]) {
    setForm((current) => current ? { ...current, [key]: value } : current);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (form) updateVendorMutation.mutate(form);
  }

  if (!Number.isFinite(vendorId)) {
    return (
      <AdminLayout title={t("adminVendors.vendorDetails")}>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">{t("adminVendors.vendorNotFound")}</CardContent>
        </Card>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={form?.businessName || t("adminVendors.vendorDetails")}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="outline" asChild>
            <Link href="/admin/vendors">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("common.back")}
            </Link>
          </Button>
          {form ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Star className="h-4 w-4 text-yellow-400" />
              {form.rating ? form.rating.toFixed(1) : t("adminVendors.noRatings")}
            </div>
          ) : null}
        </div>

        {isLoading || !form ? (
          <div className="space-y-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t("adminVendors.vendorDetails")}</CardTitle>
                  <CardDescription>{t("adminVendors.vendorDetailsDescription")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="businessName">{t("vendorProfile.businessName")}</Label>
                      <Input id="businessName" value={form.businessName || ""} onChange={(event) => updateField("businessName", event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("vendors.category")}</Label>
                      <Select value={form.category || ""} onValueChange={(value) => updateField("category", value)}>
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
                    <Label htmlFor="description">{t("common.description")}</Label>
                    <Textarea id="description" value={form.description || ""} onChange={(event) => updateField("description", event.target.value)} />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="phone">{t("common.phone")}</Label>
                      <Input id="phone" type="tel" value={form.phone || ""} onChange={(event) => updateField("phone", event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">{t("adminVendors.contactEmail")} ({t("common.optional")})</Label>
                      <Input id="email" type="email" value={form.email || ""} onChange={(event) => updateField("email", event.target.value)} />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="address">{t("common.address")}</Label>
                      <Input id="address" value={form.address || ""} onChange={(event) => updateField("address", event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="city">{t("vendorProfile.city")}</Label>
                      <Input id="city" value={form.city || ""} onChange={(event) => updateField("city", event.target.value)} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("vendorProfile.priceRange")}</Label>
                    <Select value={form.priceRange || ""} onValueChange={(value) => updateField("priceRange", value)}>
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
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t("adminVendors.mediaAndWork")}</CardTitle>
                  <CardDescription>{t("adminVendors.mediaAndWorkDescription")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="photos">{t("adminVendors.supplierPhotos")}</Label>
                    <Textarea
                      id="photos"
                      value={(form.photos || []).join("\n")}
                      placeholder={t("adminVendors.photosPlaceholder")}
                      onChange={(event) => updateField("photos", lines(event.target.value))}
                    />
                    {form.photos?.length ? (
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {form.photos.map((photo, index) => (
                          <a key={`${photo}-${index}`} href={photo} target="_blank" rel="noreferrer" className="overflow-hidden rounded-md border bg-muted/30">
                            <img
                              src={photo}
                              alt={`${t("adminVendors.supplierPhotos")} ${index + 1}`}
                              className="h-32 w-full object-cover"
                              loading="lazy"
                            />
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="previousWork">{t("adminVendors.previousWork")}</Label>
                    <Textarea
                      id="previousWork"
                      value={previousWorkToText(form.previousWork)}
                      placeholder={t("adminVendors.previousWorkPlaceholder")}
                      onChange={(event) => updateField("previousWork", parsePreviousWork(event.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("adminVendors.supplierAttachments")}</Label>
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        id="supplierAttachments"
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(event) => handleAttachmentUpload(event.target.files)}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        disabled={uploading}
                        onClick={() => document.getElementById("supplierAttachments")?.click()}
                      >
                        {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                        {t("adminVendors.uploadAttachments")}
                      </Button>
                      <span className="text-xs text-muted-foreground">{t("adminVendors.uploadThenSave")}</span>
                    </div>
                    {form.attachments?.length ? (
                      <div className="rounded-md border p-3">
                        <p className="text-sm font-medium">{t("adminVendors.uploadedFiles")}</p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {form.attachments.map((attachment, index) => (
                            <AttachmentPreview
                              key={`${attachment.url}-${index}`}
                              attachment={attachment}
                              onRemove={() => updateField("attachments", (form.attachments || []).filter((_, itemIndex) => itemIndex !== index))}
                            />
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button type="submit" disabled={updateVendorMutation.isPending || uploading}>
                  {updateVendorMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {updateVendorMutation.isPending ? t("vendorProfile.saving") : t("common.save")}
                </Button>
              </div>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t("adminVendors.supplierPagePreview")}</CardTitle>
                  <CardDescription>{t("adminVendors.supplierPagePreviewDescription")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium">{t("adminVendors.info")}</h4>
                    <p className="mt-1 text-sm text-muted-foreground">{form.description || t("adminVendors.noDescriptionAdded")}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {[form.category, form.city, form.priceRange].filter(Boolean).join(" · ") || t("adminVendors.noCategoryLocationAdded")}
                    </p>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium">{t("adminVendors.attachments")}</h4>
                    {form.attachments?.length ? (
                      <div className="mt-2 grid gap-3">
                        {form.attachments.map((attachment, index) => (
                          <AttachmentPreview key={`${attachment.url}-${index}`} attachment={attachment} />
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1 text-sm text-muted-foreground">{t("adminVendors.noAttachmentsAdded")}</p>
                    )}
                  </div>

                  <div>
                    <h4 className="mb-2 text-sm font-medium">{t("adminVendors.previousWork")}</h4>
                    {form.previousWork?.length ? (
                      <div className="space-y-2">
                        {form.previousWork.map((work, index) => (
                          <div key={`${work.title}-${index}`} className="rounded-md bg-muted/40 p-3">
                            {work.imageUrl ? (
                              <a href={work.imageUrl} target="_blank" rel="noreferrer" className="mb-3 block overflow-hidden rounded-md border bg-background">
                                <img src={work.imageUrl} alt={work.title} className="h-36 w-full object-cover" loading="lazy" />
                              </a>
                            ) : null}
                            <h5 className="text-sm font-medium">{work.title}</h5>
                            {work.description ? <p className="mt-1 text-xs text-muted-foreground">{work.description}</p> : null}
                            {work.url ? (
                              <a href={work.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-primary">
                                {t("adminVendors.openWorkLink")}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">{t("adminVendors.noPreviousWorkAdded")}</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t("navigation.services")}</CardTitle>
                </CardHeader>
                <CardContent>
                  {form.services?.length ? (
                    <div className="space-y-3">
                      {form.services.map((service) => (
                        <div key={service.id} className="rounded-md border p-3">
                          <div className="flex items-start justify-between gap-3">
                            <h4 className="text-sm font-medium">{service.name}</h4>
                            {service.isPackage ? <Badge variant="secondary">{t("adminVendors.package")}</Badge> : null}
                          </div>
                          {service.description ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{service.description}</p> : null}
                          {service.price !== null && service.price !== undefined ? (
                            <p className="mt-2 text-sm font-medium">{service.price.toLocaleString()} {t("common.sar")}</p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t("adminVendors.noSupplierServices")}</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </form>
        )}
      </div>
    </AdminLayout>
  );
}
