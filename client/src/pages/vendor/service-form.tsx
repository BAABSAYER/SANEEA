import { useEffect, useState } from "react";
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

// Form validation schema
const serviceSchema = z.object({
  name: z.string().min(3, { message: "Service name must be at least 3 characters" }),
  description: z.string().min(20, { message: "Description must be at least 20 characters" }),
  category: z.string().min(1, { message: "Please select a category" }),
  basePrice: z.coerce.number().min(1, { message: "Price must be greater than 0" }),
  hasStandardPackage: z.boolean().default(true),
  hasPremuiumPackage: z.boolean().default(true),
  duration: z.coerce.number().min(1, { message: "Duration must be greater than 0" }).optional(),
  maxGuests: z.coerce.number().min(1, { message: "Max guests must be greater than 0" }).optional(),
  availability: z.string().optional(),
  additionalInfo: z.string().optional(),
});

type ServiceFormValues = z.infer<typeof serviceSchema>;
type ServiceFormData = ServiceFormValues & {
  id?: number;
  images?: string[];
};

export default function ServiceForm() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const params = useParams();
  const { toast } = useToast();
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
        title: isEditing ? "Service Updated" : "Service Created",
        description: isEditing 
          ? "Your service has been updated successfully." 
          : "Your new service has been created.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/services'] });
      navigate("/vendor/services");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
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
        <Header title="Loading Service..." showBack={true} />
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
      <Header title={isEditing ? "Edit Service" : "New Service"} showBack={true} />
      
      <div className="px-5 py-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Service Images */}
            <div>
              <h3 className="font-medium text-neutral-800 mb-2">Service Images</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 mb-2">
                {images.map((img, index) => (
                  <div key={index} className="relative h-24 rounded-lg overflow-hidden">
                    <img src={img} alt={`Service ${index + 1}`} className="w-full h-full object-cover" />
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
                    <span className="text-xs">Add Photo</span>
                  </button>
                )}
              </div>
              <p className="text-xs text-neutral-500">Add up to 5 images. The first image will be the cover photo.</p>
            </div>
            
            <Separator />
            
            {/* Basic Info */}
            <div>
              <h3 className="font-medium text-neutral-800 mb-4">Basic Information</h3>
              
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Service Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Premium Photography Package" {...field} />
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
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Describe your service in detail..." 
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
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={SERVICE_CATEGORIES.VENUE}>Venue</SelectItem>
                          <SelectItem value={SERVICE_CATEGORIES.CATERING}>Catering</SelectItem>
                          <SelectItem value={SERVICE_CATEGORIES.PHOTOGRAPHY}>Photography</SelectItem>
                          <SelectItem value={SERVICE_CATEGORIES.DECORATION}>Decoration</SelectItem>
                          <SelectItem value={SERVICE_CATEGORIES.ENTERTAINMENT}>Entertainment</SelectItem>
                          <SelectItem value={SERVICE_CATEGORIES.OTHER}>Other</SelectItem>
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
              <h3 className="font-medium text-neutral-800 mb-4">Pricing & Packages</h3>
              
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="basePrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Base Price (Basic Package)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-500" />
                          <Input className="pl-9" type="number" {...field} />
                        </div>
                      </FormControl>
                      <FormDescription>
                        This is the price for your basic package. Standard and Premium package prices will be calculated automatically.
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
                          <FormLabel className="mb-1">Standard Package</FormLabel>
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
                          <FormLabel className="mb-1">Premium Package</FormLabel>
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
              <h3 className="font-medium text-neutral-800 mb-4">Additional Details</h3>
              
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="duration"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Duration (hours)</FormLabel>
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
                        <FormLabel>Max Guests</FormLabel>
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
                      <FormLabel>Availability</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Weekends only, All days, etc." {...field} />
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
                      <FormLabel>Additional Information</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Any other details clients should know..." 
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
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="flex-1 bg-primary text-primary-foreground"
                disabled={serviceMutation.isPending}
              >
                {serviceMutation.isPending ? "Saving..." : isEditing ? "Update Service" : "Create Service"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
