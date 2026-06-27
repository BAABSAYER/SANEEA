import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

type EventType = {
  id: number;
  name: string;
};

type Vendor = {
  id: number;
  businessName: string;
  category: string;
};

type VendorOption = {
  id: number;
  vendorId: number;
  vendorName?: string;
  optionName: string;
  description?: string;
  price: number;
  images?: string[];
  isDefault: boolean;
  isActive: boolean;
};

type EventItem = {
  id: number;
  eventTypeId: number;
  name: string;
  description?: string;
  category?: string;
  isRequired: boolean;
  displayOrder: number;
  isActive: boolean;
  vendorOptions?: VendorOption[];
};

export function EventItemsManager() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [selectedEventTypeId, setSelectedEventTypeId] = useState<number | null>(null);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [optionDialogOpen, setOptionDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<EventItem | null>(null);
  const [itemForm, setItemForm] = useState({
    name: "",
    description: "",
    category: "",
    isRequired: true,
    displayOrder: 0,
    isActive: true,
  });
  const [optionForm, setOptionForm] = useState({
    vendorId: "",
    optionName: "",
    description: "",
    price: 0,
    images: "",
    isDefault: false,
    isActive: true,
  });

  const { data: eventTypes = [] } = useQuery<EventType[]>({
    queryKey: ["/api/event-types"],
  });

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
  });

  const { data: eventItems = [], isLoading } = useQuery<EventItem[]>({
    queryKey: ["/api/event-types", selectedEventTypeId, "items"],
    queryFn: async () => {
      if (!selectedEventTypeId) return [];
      const res = await fetch(`/api/event-types/${selectedEventTypeId}/items`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load event items");
      return res.json();
    },
    enabled: !!selectedEventTypeId,
  });

  const createItemMutation = useMutation({
    mutationFn: async () => {
      if (!selectedEventTypeId) throw new Error("Select an event type first");
      const res = await fetch(`/api/admin/event-types/${selectedEventTypeId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(itemForm),
      });
      if (!res.ok) throw new Error("Failed to create event item");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/event-types", selectedEventTypeId, "items"] });
      setItemDialogOpen(false);
      setItemForm({ name: "", description: "", category: "", isRequired: true, displayOrder: 0, isActive: true });
      toast({ title: t("adminEventItems.itemCreated") });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/event-items/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete event item");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/event-types", selectedEventTypeId, "items"] });
      toast({ title: t("adminEventItems.itemDeleted") });
    },
  });

  const createOptionMutation = useMutation({
    mutationFn: async () => {
      if (!selectedItem) throw new Error("Select an event item first");
      const res = await fetch(`/api/admin/event-items/${selectedItem.id}/vendor-options`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...optionForm,
          vendorId: Number(optionForm.vendorId),
          images: optionForm.images.split("\n").map((image) => image.trim()).filter(Boolean),
        }),
      });
      if (!res.ok) throw new Error("Failed to create vendor option");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/event-types", selectedEventTypeId, "items"] });
      setOptionDialogOpen(false);
      setSelectedItem(null);
      setOptionForm({ vendorId: "", optionName: "", description: "", price: 0, images: "", isDefault: false, isActive: true });
      toast({ title: t("adminEventItems.vendorOptionAdded") });
    },
  });

  const deleteOptionMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/item-vendor-options/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete vendor option");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/event-types", selectedEventTypeId, "items"] });
      toast({ title: t("adminEventItems.vendorOptionDeleted") });
    },
  });

  const openOptionDialog = (item: EventItem) => {
    setSelectedItem(item);
    setOptionDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">{t("adminEventItems.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("adminEventItems.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Select onValueChange={(value) => setSelectedEventTypeId(Number(value))}>
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue placeholder={t("adminBundles.selectEventType")} />
            </SelectTrigger>
            <SelectContent>
              {eventTypes.map((eventType) => (
                <SelectItem key={eventType.id} value={eventType.id.toString()}>
                  {eventType.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setItemDialogOpen(true)} disabled={!selectedEventTypeId}>
            <Plus className="h-4 w-4 mr-2" />
            {t("adminEventItems.addItem")}
          </Button>
        </div>
      </div>

      {!selectedEventTypeId ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">{t("adminEventItems.selectEventFirst")}</CardContent>
        </Card>
      ) : isLoading ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">{t("adminEventItems.loadingItems")}</CardContent>
        </Card>
      ) : eventItems.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">{t("adminEventItems.noItems")}</CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {eventItems.map((item) => (
            <Card key={item.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">{item.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{item.description || t("adminEventItems.noDescription")}</p>
                    <div className="mt-2 flex gap-2">
                      {item.category && <Badge variant="secondary">{item.category}</Badge>}
                      <Badge variant={item.isRequired ? "default" : "outline"}>{item.isRequired ? t("common.required") : t("common.optional")}</Badge>
                      {!item.isActive && <Badge variant="secondary">{t("common.inactive")}</Badge>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openOptionDialog(item)}>
                      <Plus className="h-4 w-4 mr-1" />
                      {t("adminEventItems.vendorOption")}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => deleteItemMutation.mutate(item.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {item.vendorOptions && item.vendorOptions.length > 0 ? (
                  <div className="grid gap-2">
                    {item.vendorOptions.map((option) => (
                      <div key={option.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                        <div>
                          <div className="font-medium">{option.optionName}</div>
                          <div className="text-muted-foreground">
                            {option.vendorName || t("adminEventItems.vendorNumber", { id: option.vendorId })} - {t("common.sar")} {option.price.toLocaleString()}
                          </div>
                          {option.images && option.images.length > 0 && (
                            <div className="text-xs text-muted-foreground">{t("adminEventItems.imageUrlCount", { count: option.images.length })}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {option.isDefault && <Badge>{t("adminEventItems.default")}</Badge>}
                          <Button variant="ghost" size="sm" onClick={() => deleteOptionMutation.mutate(option.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    {t("adminEventItems.noVendorOptions")}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("adminEventItems.addEventItem")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder={t("adminEventItems.itemNamePlaceholder")} value={itemForm.name} onChange={(event) => setItemForm({ ...itemForm, name: event.target.value })} />
            <Textarea placeholder={t("common.description")} value={itemForm.description} onChange={(event) => setItemForm({ ...itemForm, description: event.target.value })} />
            <Input placeholder={t("adminEventItems.categoryPlaceholder")} value={itemForm.category} onChange={(event) => setItemForm({ ...itemForm, category: event.target.value })} />
            <Input type="number" placeholder={t("adminEventItems.displayOrder")} value={itemForm.displayOrder} onChange={(event) => setItemForm({ ...itemForm, displayOrder: Number(event.target.value) || 0 })} />
            <div className="flex items-center justify-between rounded-md border p-3">
              <span className="text-sm font-medium">{t("adminEventItems.requiredItem")}</span>
              <Switch checked={itemForm.isRequired} onCheckedChange={(checked) => setItemForm({ ...itemForm, isRequired: checked })} />
            </div>
            <Button className="w-full" onClick={() => createItemMutation.mutate()} disabled={!itemForm.name.trim() || createItemMutation.isPending}>
              {createItemMutation.isPending ? t("adminPayments.creating") : t("adminEventItems.createItem")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={optionDialogOpen} onOpenChange={setOptionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("adminEventItems.addVendorOption")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={optionForm.vendorId} onValueChange={(value) => setOptionForm({ ...optionForm, vendorId: value })}>
              <SelectTrigger>
                <SelectValue placeholder={t("adminEventItems.selectVendor")} />
              </SelectTrigger>
              <SelectContent>
                {vendors.map((vendor) => (
                  <SelectItem key={vendor.id} value={vendor.id.toString()}>
                    {vendor.businessName} ({vendor.category})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input placeholder={t("adminBundles.optionName")} value={optionForm.optionName} onChange={(event) => setOptionForm({ ...optionForm, optionName: event.target.value })} />
            <Textarea placeholder={t("common.description")} value={optionForm.description} onChange={(event) => setOptionForm({ ...optionForm, description: event.target.value })} />
            <Input type="number" min="0" placeholder={t("common.price")} value={optionForm.price} onChange={(event) => setOptionForm({ ...optionForm, price: Number(event.target.value) || 0 })} />
            <Textarea placeholder={t("adminEventItems.s3ImagesPlaceholder")} value={optionForm.images} onChange={(event) => setOptionForm({ ...optionForm, images: event.target.value })} />
            <div className="flex items-center justify-between rounded-md border p-3">
              <span className="text-sm font-medium">{t("adminEventItems.defaultOption")}</span>
              <Switch checked={optionForm.isDefault} onCheckedChange={(checked) => setOptionForm({ ...optionForm, isDefault: checked })} />
            </div>
            <Button className="w-full" onClick={() => createOptionMutation.mutate()} disabled={!optionForm.vendorId || !optionForm.optionName.trim() || createOptionMutation.isPending}>
              {createOptionMutation.isPending ? t("adminEventItems.adding") : t("adminEventItems.addVendorOption")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
