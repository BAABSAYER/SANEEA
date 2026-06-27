import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Camera, Package, Upload, X, Info, Plus, DollarSign, 
  CameraOff, Trash2, ChevronLeft
} from "lucide-react";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage,
  FormDescription
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Header } from "@/components/layout/header";
import { SERVICE_CATEGORIES } from "@shared/schema";
import { useTranslation } from "react-i18next";

// Form validation schema
const createServiceSchema = (t: (key: string) => string) => z.object({
  name: z.string().min(3, { message: t("vendorServices.serviceNameMin") }),
  description: z.string().min(20, { message: t("vendorServices.descriptionMin") }),
  category: z.string().min(1, { message: t("vendorServices.categoryRequired") }),
  basePrice: z.coerce.number().min(1, { message: t("vendorServices.priceGreaterThanZero") }),
  hasStandardPackage: z.boolean().default(true),
  hasPremuiumPackage: z.boolean().default(true),
  duration: z.coerce.number().min(1, { message: t("vendorServices.durationGreaterThanZero") }).optional(),
  maxGuests: z.coerce.number().min(1, { message: t("vendorServices.maxGuestsGreaterThanZero") }).optional(),
  availability: z.string().optional(),
  additionalInfo: z.string().optional(),
});

type ServiceFormValues = z.infer<ReturnType<typeof createServiceSchema>>;
type ServiceFormData = ServiceFormValues & {
  id?: number;
  images?: string[];
};

export default function ServiceForm() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const params = useParams();
  const { toast } = useToast();
  const { t } = useTranslation();
  const serviceSchema = useMemo(() => createServiceSchema(t), [t]);
  const serviceId = params.id ? parseInt(params.id) : null;
  const isEditing = !!serviceId;
  
  const [images, setImages] = useState<string[]>([]);
  
  // Redirect if not a vendor
  useEffect(() => {
    if (user && user.userType !== 'vendor') {
      navigate("/");
    }
  }, [user, navigate]);
  
  // Fetch service data if editing
  const { data: serviceData, isLoading } = useQuery<ServiceFormData>({
    queryKey: [`/api/services/${serviceId}`],
    enabled: isEditing,
  });
  
  // Form setup
  const form = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: "",
      description: "",
      category: "",
      basePrice: 0,
      hasStandardPackage: true,
      hasPremuiumPackage: true,
      duration: 0,
      maxGuests: 0,
      availability: "",
      additionalInfo: "",
    }
  });
  
  // Update form values when service data is loaded
  useEffect(() => {
    if (serviceData) {
      form.reset({
        name: serviceData.name,
        description: serviceData.description,
        category: serviceData.category,
        basePrice: serviceData.basePrice,
        hasStandardPackage: serviceData.hasStandardPackage,
        hasPremuiumPackage: serviceData.hasPremuiumPackage,
        duration: serviceData.duration || 0,
        maxGuests: serviceData.maxGuests || 0,
        availability: serviceData.availability || "",
        additionalInfo: serviceData.additionalInfo || "",
      });
      
      if (serviceData.images) {
        setImages(serviceData.images);
      }
    }
  }, [serviceData, form]);
  
  // Create/update service mutation
  const serviceMutation = useMutation({
    mutationFn: async (data: ServiceFormValues & { images: string[] }) => {
      if (isEditing) {
        return await apiRequest("PUT", `/api/services/${serviceId}`, data);
      } else {
        return await apiRequest("POST", "/api/services", data);
      }
    },
    onSuccess: () => {
      toast({
        title: isEditing ? t("vendorServices.serviceUpdated") : t("vendorServices.serviceCreated"),
        description: isEditing 
          ? t("vendorServices.serviceUpdatedDescription") 
          : t("vendorServices.serviceCreatedDescription"),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/services'] });
      navigate("/vendor/services");
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const onSubmit = (data: ServiceFormValues) => {
    serviceMutation.mutate({
      ...data,
      images,
    });
  };
  
  // Image handlers
  const handleAddImage = () => {
    // In a real app, you would use a file upload component
    // For this demo, we'll just add a placeholder image
    const placeholderImage = "https://images.unsplash.com/photo-1605774337664-7a846e9cdf17?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60";
    setImages([...images, placeholderImage]);
  };
  
  const handleRemoveImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };
  
  if (isLoading && isEditing) {
    return (
      <div>
        <Header title={t("vendorServices.loadingService")} showBack={true} />
        <div className="px-5 py-6">
          <Skeleton className="h-8 w-48 mb-6" />
          <Skeleton className="h-32 w-full mb-4" />
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="pb-24">
      <Header title={isEditing ? t("vendorServices.editService") : t("vendorServices.newService")} showBack={true} />
      
      <div className="px-5 py-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Service Images */}
            <div>
              <h3 className="font-medium text-neutral-800 mb-2">{t("vendorServices.serviceImages")}</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 mb-2">
                {images.map((img, index) => (
                  <div key={index} className="relative h-24 rounded-lg overflow-hidden">
                    <img src={img} alt={t("vendorServices.serviceImageAlt", { number: index + 1 })} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(index)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {images.length < 5 && (
                  <button
                    type="button"
                    onClick={handleAddImage}
                    className="h-24 border-2 border-dashed border-neutral-300 rounded-lg flex flex-col items-center justify-center text-neutral-500"
                  >
                    <Camera className="h-6 w-6 mb-1" />
                    <span className="text-xs">{t("common.uploadPhoto")}</span>
                  </button>
                )}
              </div>
              <p className="text-xs text-neutral-500">{t("vendorServices.imageHelp")}</p>
            </div>
            
            <Separator />
            
            {/* Basic Info */}
            <div>
              <h3 className="font-medium text-neutral-800 mb-4">{t("vendorServices.basicInformation")}</h3>
              
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("vendorServices.serviceName")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("vendorServices.serviceNamePlaceholder")} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("vendorServices.description")}</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder={t("vendorServices.descriptionPlaceholder")} 
                          {...field} 
                          rows={4}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("vendorServices.category")}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("auth.selectServiceType")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={SERVICE_CATEGORIES.VENUE}>{t("serviceCategories.venue")}</SelectItem>
                          <SelectItem value={SERVICE_CATEGORIES.CATERING}>{t("serviceCategories.catering")}</SelectItem>
                          <SelectItem value={SERVICE_CATEGORIES.PHOTOGRAPHY}>{t("serviceCategories.photography")}</SelectItem>
                          <SelectItem value={SERVICE_CATEGORIES.DECORATION}>{t("serviceCategories.decoration")}</SelectItem>
                          <SelectItem value={SERVICE_CATEGORIES.ENTERTAINMENT}>{t("serviceCategories.entertainment")}</SelectItem>
                          <SelectItem value={SERVICE_CATEGORIES.OTHER}>{t("serviceCategories.other")}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            
            <Separator />
            
            {/* Pricing */}
            <div>
              <h3 className="font-medium text-neutral-800 mb-4">{t("vendorServices.pricingAndPackages")}</h3>
              
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="basePrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("vendorServices.basePriceBasic")}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-500" />
                          <Input className="pl-9" type="number" {...field} />
                        </div>
                      </FormControl>
                      <FormDescription>
                        {t("vendorServices.basePriceHelp")}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="hasStandardPackage"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between p-3 rounded-lg border">
                        <div>
                          <FormLabel className="mb-1">{t("vendorServices.standardPackage")}</FormLabel>
                          <FormDescription className="text-xs">
                            1.75x base price
                          </FormDescription>
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
                    control={form.control}
                    name="hasPremuiumPackage"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between p-3 rounded-lg border">
                        <div>
                          <FormLabel className="mb-1">{t("vendorServices.premiumPackage")}</FormLabel>
                          <FormDescription className="text-xs">
                            2.5x base price
                          </FormDescription>
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
              </div>
            </div>
            
            <Separator />
            
            {/* Additional Details */}
            <div>
              <h3 className="font-medium text-neutral-800 mb-4">{t("vendorServices.additionalDetails")}</h3>
              
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="duration"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("vendorServices.durationHours")}</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="maxGuests"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("vendorServices.maxGuests")}</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="availability"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("vendorServices.availability")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("vendorServices.availabilityPlaceholder")} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="additionalInfo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("vendorServices.additionalInformation")}</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder={t("vendorServices.additionalInfoPlaceholder")} 
                          {...field} 
                          rows={3}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            
            {/* Submit Buttons */}
            <div className="flex space-x-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                className="flex-1"
                onClick={() => navigate("/vendor/services")}
              >
                {t("common.cancel")}
              </Button>
              <Button 
                type="submit" 
                className="flex-1 bg-primary text-primary-foreground"
                disabled={serviceMutation.isPending}
              >
                {serviceMutation.isPending ? t("vendorProfile.saving") : isEditing ? t("vendorServices.updateService") : t("vendorServices.createService")}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
