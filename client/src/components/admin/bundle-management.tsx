import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Edit, Trash2, Package, Settings, Upload, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { authHeaders } from '@/lib/queryClient';

interface EventBundle {
  id: number;
  eventTypeId: number;
  name: string;
  tier: 'cheap' | 'mid' | 'high';
  description: string;
  basePrice: number;
  availableQuantity: number;
  totalQuantity: number;
  features: string[];
  images?: string[];
  videos?: string[];
  isActive: boolean;
  eventType?: { name: string };
  options?: BundleOption[];
}

interface BundleItem {
  id: number;
  eventItemId: number;
  defaultOptionId?: number | null;
  itemName?: string;
  itemCategory?: string;
  optionName?: string;
  optionPrice?: number;
  vendorName?: string;
  isIncluded: boolean;
  quantity: number;
  priceOverride?: number | null;
}

interface EventItem {
  id: number;
  name: string;
  category?: string;
  vendorOptions?: Array<{
    id: number;
    optionName: string;
    vendorName?: string;
    price: number;
  }>;
}

interface BundleOption {
  id: number;
  bundleId: number;
  name: string;
  description: string;
  price: number;
  isRequired: boolean;
  maxQuantity: number;
  isActive: boolean;
}

interface EventType {
  id: number;
  name: string;
  description: string;
}

const bundleSchema = z.object({
  eventTypeId: z.number(),
  name: z.string().min(1, 'Name is required'),
  tier: z.enum(['cheap', 'mid', 'high']),
  description: z.string().min(1, 'Description is required'),
  basePrice: z.number().min(0, 'Price must be positive'),
  totalQuantity: z.number().min(1, 'Quantity must be at least 1'),
  features: z.string().min(1, 'Features are required'),
  images: z.string().optional().default(''),
  videos: z.string().optional().default(''),
  isActive: z.boolean(),
});

const optionSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().min(1, 'Description is required'),
  price: z.number().min(0, 'Price must be positive'),
  isRequired: z.boolean(),
  maxQuantity: z.number().min(1, 'Max quantity must be at least 1'),
  isActive: z.boolean(),
});

type BundleFormData = z.infer<typeof bundleSchema>;
type OptionFormData = z.infer<typeof optionSchema>;

function parseUrlLines(value?: string) {
  return (value || '').split('\n').map((item) => item.trim()).filter(Boolean);
}

async function uploadAdminMedia(file: File, folder: string) {
  const intentRes = await fetch('/api/admin/media/upload-intent', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ filename: file.name, contentType: file.type, folder }),
  });
  if (!intentRes.ok) {
    const error = await intentRes.json().catch(() => null);
    throw new Error(error?.message || 'Failed to prepare S3 upload');
  }

  const intent = await intentRes.json();
  if (!intent.uploadUrl) {
    throw new Error('S3 upload is not configured. Set S3_BUCKET and AWS_REGION on the backend.');
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 20 * 60 * 1000);
  let uploadRes: Response;
  try {
    uploadRes = await fetch(intent.uploadUrl, {
      method: 'PUT',
      headers: intent.headers || { 'Content-Type': file.type },
      body: file,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Upload timed out. Try a smaller video or check your network connection.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
  if (!uploadRes.ok) {
    const errorText = await uploadRes.text().catch(() => '');
    throw new Error(errorText || `Failed to upload media to S3 (${uploadRes.status})`);
  }
  return intent.publicUrl as string;
}

export function BundleManagement() {
  const { t } = useTranslation();
  const [selectedBundle, setSelectedBundle] = useState<EventBundle | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isOptionOpen, setIsOptionOpen] = useState(false);
  const [isBundleItemsOpen, setIsBundleItemsOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<BundleOption | null>(null);
  const [uploadingField, setUploadingField] = useState<'images' | 'videos' | null>(null);
  const [bundleItemForm, setBundleItemForm] = useState({
    eventItemId: '',
    defaultOptionId: '',
    quantity: 1,
    priceOverride: '',
    displayOrder: 0,
    isIncluded: true,
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get all bundles
  const { data: bundles = [], isLoading: loadingBundles } = useQuery<EventBundle[]>({
    queryKey: ['/api/admin/bundles'],
  });

  // Get event types for dropdown
  const { data: eventTypes = [] } = useQuery<EventType[]>({
    queryKey: ['/api/event-types'],
  });

  const { data: selectedEventItems = [] } = useQuery<EventItem[]>({
    queryKey: ['/api/event-types', selectedBundle?.eventTypeId, 'items'],
    queryFn: async () => {
      if (!selectedBundle) return [];
      const res = await fetch(`/api/event-types/${selectedBundle.eventTypeId}/items`, { headers: authHeaders() });
      if (!res.ok) throw new Error('Failed to load event items');
      return res.json();
    },
    enabled: !!selectedBundle && isBundleItemsOpen,
  });

  const { data: selectedBundleItems = [] } = useQuery<BundleItem[]>({
    queryKey: ['/api/admin/bundles', selectedBundle?.id, 'items'],
    queryFn: async () => {
      if (!selectedBundle) return [];
      const res = await fetch(`/api/admin/bundles/${selectedBundle.id}/items`, { headers: authHeaders() });
      if (!res.ok) throw new Error('Failed to load bundle items');
      return res.json();
    },
    enabled: !!selectedBundle && isBundleItemsOpen,
  });

  // Bundle form
  const bundleForm = useForm<BundleFormData>({
    resolver: zodResolver(bundleSchema),
    defaultValues: {
      eventTypeId: 0,
      name: '',
      tier: 'cheap',
      description: '',
      basePrice: 0,
      totalQuantity: 1,
      features: '',
      images: '',
      videos: '',
      isActive: true,
    },
  });

  // Option form
  const optionForm = useForm<OptionFormData>({
    resolver: zodResolver(optionSchema),
    defaultValues: {
      name: '',
      description: '',
      price: 0,
      isRequired: false,
      maxQuantity: 1,
      isActive: true,
    },
  });

  // Mutations
  const createBundleMutation = useMutation({
    mutationFn: async (data: BundleFormData) => {
      const response = await fetch('/api/admin/bundles', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          ...data,
          features: data.features.split('\n').filter(f => f.trim()),
          images: parseUrlLines(data.images),
          videos: parseUrlLines(data.videos),
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create bundle');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Bundle created successfully!' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/bundles'] });
      setIsCreateOpen(false);
      bundleForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create bundle',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateBundleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: BundleFormData }) => {
      const response = await fetch(`/api/admin/bundles/${id}`, {
        method: 'PUT',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          ...data,
          features: data.features.split('\n').filter(f => f.trim()),
          images: parseUrlLines(data.images),
          videos: parseUrlLines(data.videos),
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update bundle');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Bundle updated successfully!' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/bundles'] });
      setIsEditOpen(false);
      setSelectedBundle(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update bundle',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteBundleMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/admin/bundles/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete bundle');
      }
    },
    onSuccess: () => {
      toast({ title: 'Bundle deleted successfully!' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/bundles'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to delete bundle',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const createOptionMutation = useMutation({
    mutationFn: async (data: OptionFormData & { bundleId: number }) => {
      const response = await fetch('/api/admin/bundle-options', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create option');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Bundle option created successfully!' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/bundles'] });
      setIsOptionOpen(false);
      optionForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create option',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const createBundleItemMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBundle) throw new Error('Select a bundle first');
      const response = await fetch(`/api/admin/bundles/${selectedBundle.id}/items`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          eventItemId: Number(bundleItemForm.eventItemId),
          defaultOptionId: bundleItemForm.defaultOptionId ? Number(bundleItemForm.defaultOptionId) : null,
          quantity: bundleItemForm.quantity,
          priceOverride: bundleItemForm.priceOverride ? Number(bundleItemForm.priceOverride) : null,
          displayOrder: bundleItemForm.displayOrder,
          isIncluded: bundleItemForm.isIncluded,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to add bundle item');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/bundles', selectedBundle?.id, 'items'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/bundles'] });
      setBundleItemForm({ eventItemId: '', defaultOptionId: '', quantity: 1, priceOverride: '', displayOrder: 0, isIncluded: true });
      toast({ title: 'Bundle item added successfully!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to add bundle item', description: error.message, variant: 'destructive' });
    },
  });

  const deleteBundleItemMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/admin/bundle-items/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!response.ok) throw new Error('Failed to delete bundle item');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/bundles', selectedBundle?.id, 'items'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/bundles'] });
      toast({ title: 'Bundle item removed successfully!' });
    },
  });

  const handleEditBundle = (bundle: EventBundle) => {
    setSelectedBundle(bundle);
    bundleForm.reset({
      eventTypeId: bundle.eventTypeId,
      name: bundle.name,
      tier: bundle.tier,
      description: bundle.description,
      basePrice: bundle.basePrice,
      totalQuantity: bundle.totalQuantity,
      features: bundle.features.join('\n'),
      images: (bundle.images || []).join('\n'),
      videos: (bundle.videos || []).join('\n'),
      isActive: bundle.isActive,
    });
    setIsEditOpen(true);
  };

  const handleAddOption = (bundle: EventBundle) => {
    setSelectedBundle(bundle);
    setEditingOption(null);
    optionForm.reset();
    setIsOptionOpen(true);
  };

  const handleManageBundleItems = (bundle: EventBundle) => {
    setSelectedBundle(bundle);
    setBundleItemForm({ eventItemId: '', defaultOptionId: '', quantity: 1, priceOverride: '', displayOrder: 0, isIncluded: true });
    setIsBundleItemsOpen(true);
  };

  const selectedItemOptions = selectedEventItems.find(
    (item) => item.id === Number(bundleItemForm.eventItemId)
  )?.vendorOptions || [];

  const onCreateBundle = (data: BundleFormData) => {
    createBundleMutation.mutate(data);
  };

  const onUpdateBundle = (data: BundleFormData) => {
    if (selectedBundle) {
      updateBundleMutation.mutate({ id: selectedBundle.id, data });
    }
  };

  const onCreateOption = (data: OptionFormData) => {
    if (selectedBundle) {
      createOptionMutation.mutate({ ...data, bundleId: selectedBundle.id });
    }
  };

  const handleBundleMediaUpload = async (file: File | undefined, field: 'images' | 'videos') => {
    if (!file) return;
    setUploadingField(field);
    try {
      const url = await uploadAdminMedia(file, `saneea/packages/${field}`);
      const currentValue = bundleForm.getValues(field) || '';
      bundleForm.setValue(field, [...parseUrlLines(currentValue), url].join('\n'), { shouldDirty: true });
      toast({ title: field === 'images' ? t('adminBundles.packageImageUploaded') : t('adminBundles.packageVideoUploaded') });
    } catch (error) {
      toast({
        title: t('adminBundles.uploadFailed'),
        description: error instanceof Error ? error.message : t('adminBundles.uploadMediaError'),
        variant: 'destructive',
      });
    } finally {
      setUploadingField(null);
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'cheap': return 'bg-green-100 text-green-800 border-green-200';
      case 'mid': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'high': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loadingBundles) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded animate-pulse" />
        <div className="grid gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">{t('adminBundles.title')}</h2>
          <p className="text-gray-600">{t('adminBundles.subtitle')}</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              {t('adminBundles.createBundle')}
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('adminBundles.createBundle')}</DialogTitle>
            </DialogHeader>
            <Form {...bundleForm}>
              <form onSubmit={bundleForm.handleSubmit(onCreateBundle)} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={bundleForm.control}
                    name="eventTypeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('adminBundles.eventType')}</FormLabel>
                        <Select onValueChange={(value) => field.onChange(parseInt(value))}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('adminBundles.selectEventType')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {eventTypes.map(type => (
                              <SelectItem key={type.id} value={type.id.toString()}>
                                {type.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={bundleForm.control}
                    name="tier"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('adminBundles.tier')}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="cheap">{t('adminBundles.cheap')}</SelectItem>
                            <SelectItem value="mid">{t('adminBundles.mid')}</SelectItem>
                            <SelectItem value="high">{t('adminBundles.high')}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={bundleForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('adminBundles.bundleName')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('adminBundles.bundleNamePlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={bundleForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('adminBundles.description')}</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder={t('adminBundles.descriptionPlaceholder')}
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={bundleForm.control}
                    name="basePrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('adminBundles.basePrice')}</FormLabel>
                        <FormControl>
                          <Input 
                            type="number"
                            min="0"
                            step="0.01"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={bundleForm.control}
                    name="totalQuantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('adminBundles.totalQuantity')}</FormLabel>
                        <FormControl>
                          <Input 
                            type="number"
                            min="1"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={bundleForm.control}
                  name="features"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('adminBundles.features')}</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={6}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={bundleForm.control}
                  name="images"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('adminBundles.packageImageUrls')}</FormLabel>
                      <div className="flex items-center gap-2">
                        <Input
                          type="file"
                          accept="image/*"
                          disabled={uploadingField !== null}
                          onChange={(event) => handleBundleMediaUpload(event.target.files?.[0], 'images')}
                        />
                        {uploadingField === 'images' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 text-muted-foreground" />}
                      </div>
                      <FormControl>
                        <Textarea rows={3} placeholder={t('adminBundles.imageUrlsPlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={bundleForm.control}
                  name="videos"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('adminBundles.packageVideoUrls')}</FormLabel>
                      <div className="flex items-center gap-2">
                        <Input
                          type="file"
                          accept="video/*"
                          disabled={uploadingField !== null}
                          onChange={(event) => handleBundleMediaUpload(event.target.files?.[0], 'videos')}
                        />
                        {uploadingField === 'videos' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 text-muted-foreground" />}
                      </div>
                      <FormControl>
                        <Textarea rows={3} placeholder={t('adminBundles.videoUrlsPlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={bundleForm.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>{t('adminBundles.isActive')}</FormLabel>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateOpen(false)}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button
                    type="submit"
                    disabled={createBundleMutation.isPending}
                  >
                    {createBundleMutation.isPending ? t('common.loading') : t('adminBundles.createBundle')}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Bundles Grid */}
      <div className="grid gap-6">
        {bundles.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Package className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium mb-2">{t('adminBundles.noBundles')}</h3>
              <p className="text-gray-600 mb-4">{t('adminBundles.createFirst')}</p>
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                {t('adminBundles.createBundle')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          bundles.map(bundle => (
            <Card key={bundle.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{bundle.name}</CardTitle>
                      <Badge className={getTierColor(bundle.tier)}>
                        {bundle.tier.toUpperCase()}
                      </Badge>
                      {!bundle.isActive && (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">
                      {bundle.eventType?.name} • ${bundle.basePrice.toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEditBundle(bundle)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deleteBundleMutation.mutate(bundle.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <p className="text-sm text-gray-700">{bundle.description}</p>

                <div className="grid gap-4 sm:grid-cols-2 text-sm">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">{t('adminBundles.basePrice')}:</span>
                      <span className="font-medium">{t('common.sar')} {bundle.basePrice.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{t('adminBundles.available')}:</span>
                      <span className="font-medium">{bundle.availableQuantity}/{bundle.totalQuantity}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">{t('adminBundles.features')}:</span>
                      <span className="font-medium">{bundle.features.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{t('adminBundles.bundleOptions')}:</span>
                      <span className="font-medium">{bundle.options?.length || 0}</span>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-600">
                    {t('adminBundles.features')}: {bundle.features.slice(0, 2).join(', ')}
                    {bundle.features.length > 2 && ` +${bundle.features.length - 2} ${t('common.more')}`}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleManageBundleItems(bundle)}
                    className="gap-2"
                  >
                    <Package className="h-4 w-4" />
                    {t('adminBundles.manageItems')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAddOption(bundle)}
                    className="gap-2"
                  >
                    <Settings className="h-4 w-4" />
                    {t('adminBundles.addOption')}
                  </Button>
                </div>

                {/* Bundle Options */}
                {bundle.options && bundle.options.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium mb-2">{t('adminBundles.bundleOptions')}:</h4>
                    <div className="space-y-2">
                      {bundle.options.map(option => (
                        <div key={option.id} className="flex justify-between items-center p-2 bg-muted rounded">
                          <div>
                            <span className="text-sm font-medium">{option.name}</span>
                            <span className="text-xs text-gray-500 ml-2">{option.description}</span>
                          </div>
                          <div className="text-sm">
                            +{t('common.sar')} {option.price.toLocaleString()}
                            {option.isRequired && <Badge variant="secondary" className="ml-2">{t('common.required')}</Badge>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Edit Bundle Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('adminBundles.editBundle')}: {selectedBundle?.name}</DialogTitle>
          </DialogHeader>
          <Form {...bundleForm}>
            <form onSubmit={bundleForm.handleSubmit(onUpdateBundle)} className="space-y-4">
              {/* Same form fields as create, but with update handler */}
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={bundleForm.control}
                  name="eventTypeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('adminBundles.eventType')}</FormLabel>
                      <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {eventTypes.map(type => (
                            <SelectItem key={type.id} value={type.id.toString()}>
                              {type.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={bundleForm.control}
                  name="tier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pricing Tier</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="cheap">{t('adminBundles.cheap')}</SelectItem>
                          <SelectItem value="mid">{t('adminBundles.mid')}</SelectItem>
                          <SelectItem value="high">{t('adminBundles.high')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={bundleForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('adminBundles.bundleName')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={bundleForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('adminBundles.description')}</FormLabel>
                    <FormControl>
                      <Textarea rows={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={bundleForm.control}
                  name="basePrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('adminBundles.basePrice')}</FormLabel>
                      <FormControl>
                        <Input 
                          type="number"
                          min="0"
                          step="0.01"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={bundleForm.control}
                  name="totalQuantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('adminBundles.totalQuantity')}</FormLabel>
                      <FormControl>
                        <Input 
                          type="number"
                          min="1"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={bundleForm.control}
                name="features"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('adminBundles.features')}</FormLabel>
                    <FormControl>
                      <Textarea rows={6} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={bundleForm.control}
                name="images"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('adminBundles.packageImageUrls')}</FormLabel>
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        accept="image/*"
                        disabled={uploadingField !== null}
                        onChange={(event) => handleBundleMediaUpload(event.target.files?.[0], 'images')}
                      />
                      {uploadingField === 'images' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <FormControl>
                      <Textarea rows={3} placeholder={t('adminBundles.imageUrlsPlaceholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={bundleForm.control}
                name="videos"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('adminBundles.packageVideoUrls')}</FormLabel>
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        accept="video/*"
                        disabled={uploadingField !== null}
                        onChange={(event) => handleBundleMediaUpload(event.target.files?.[0], 'videos')}
                      />
                      {uploadingField === 'videos' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <FormControl>
                      <Textarea rows={3} placeholder={t('adminBundles.videoUrlsPlaceholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={bundleForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>{t('adminBundles.isActive')}</FormLabel>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditOpen(false)}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={updateBundleMutation.isPending}
                >
                  {updateBundleMutation.isPending ? t('common.loading') : t('adminBundles.editBundle')}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Add Option Dialog */}
      <Dialog open={isOptionOpen} onOpenChange={setIsOptionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('adminBundles.addOption')}: {selectedBundle?.name}</DialogTitle>
          </DialogHeader>
          <Form {...optionForm}>
            <form onSubmit={optionForm.handleSubmit(onCreateOption)} className="space-y-4">
              <FormField
                control={optionForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('adminBundles.optionName')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('adminBundles.optionNamePlaceholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={optionForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('adminBundles.description')}</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder={t('adminBundles.optionDescriptionPlaceholder')}
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={optionForm.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('adminBundles.additionalPrice')}</FormLabel>
                      <FormControl>
                        <Input 
                          type="number"
                          min="0"
                          step="0.01"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={optionForm.control}
                  name="maxQuantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('adminBundles.maxQuantity')}</FormLabel>
                      <FormControl>
                        <Input 
                          type="number"
                          min="1"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-3">
                <FormField
                  control={optionForm.control}
                  name="isRequired"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>{t('adminBundles.requiredOption')}</FormLabel>
                        <div className="text-sm text-gray-600">
                          {t('adminBundles.requiredOptionHelp')}
                        </div>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={optionForm.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>{t('adminBundles.activeOption')}</FormLabel>
                        <div className="text-sm text-gray-600">
                          {t('adminBundles.activeOptionHelp')}
                        </div>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsOptionOpen(false)}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={createOptionMutation.isPending}
                >
                  {createOptionMutation.isPending ? t('common.loading') : t('adminBundles.addOption')}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isBundleItemsOpen} onOpenChange={setIsBundleItemsOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('adminBundles.packageItemsTitle', { name: selectedBundle?.name })}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('adminBundles.addEventItemToPackage')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Select
                    value={bundleItemForm.eventItemId}
                    onValueChange={(value) => setBundleItemForm({ ...bundleItemForm, eventItemId: value, defaultOptionId: '' })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('adminBundles.selectEventItem')} />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedEventItems.map((item) => (
                        <SelectItem key={item.id} value={item.id.toString()}>
                          {item.name}{item.category ? ` (${item.category})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={bundleItemForm.defaultOptionId}
                    onValueChange={(value) => setBundleItemForm({ ...bundleItemForm, defaultOptionId: value })}
                    disabled={!bundleItemForm.eventItemId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('adminBundles.defaultVendorOption')} />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedItemOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id.toString()}>
                          {option.optionName} - {option.vendorName || t('adminBookingsExtra.vendor')} - {t('common.sar')} {option.price.toLocaleString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <Input
                    type="number"
                    min="1"
                    placeholder={t('adminBundles.quantity')}
                    value={bundleItemForm.quantity}
                    onChange={(event) => setBundleItemForm({ ...bundleItemForm, quantity: Number(event.target.value) || 1 })}
                  />
                  <Input
                    type="number"
                    min="0"
                    placeholder={t('adminBundles.priceOverride')}
                    value={bundleItemForm.priceOverride}
                    onChange={(event) => setBundleItemForm({ ...bundleItemForm, priceOverride: event.target.value })}
                  />
                  <Input
                    type="number"
                    placeholder={t('adminBundles.displayOrder')}
                    value={bundleItemForm.displayOrder}
                    onChange={(event) => setBundleItemForm({ ...bundleItemForm, displayOrder: Number(event.target.value) || 0 })}
                  />
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={() => createBundleItemMutation.mutate()}
                    disabled={!bundleItemForm.eventItemId || createBundleItemMutation.isPending}
                  >
                    {createBundleItemMutation.isPending ? t('adminEventItems.adding') : t('adminBundles.addPackageItem')}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2">
              {selectedBundleItems.length === 0 ? (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  {t('adminBundles.noPackageItems')}
                </div>
              ) : (
                selectedBundleItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                    <div>
                      <div className="font-medium">{item.itemName || t('adminBundles.itemNumber', { id: item.eventItemId })}</div>
                      <div className="text-muted-foreground">
                        {item.vendorName || t('adminBundles.noVendor')} - {item.optionName || t('adminBundles.noDefaultOption')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t('adminBundles.qty')} {item.quantity || 1}
                        {item.priceOverride != null
                          ? ` - ${t('adminBundles.override')} ${t('common.sar')} ${item.priceOverride.toLocaleString()}`
                          : item.optionPrice != null
                            ? ` - ${t('common.sar')} ${item.optionPrice.toLocaleString()}`
                            : ''}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => deleteBundleItemMutation.mutate(item.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
