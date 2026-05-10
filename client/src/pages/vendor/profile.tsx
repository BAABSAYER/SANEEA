import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Camera, Upload, X, MapPin, Phone, Mail, 
  Edit2, User, ChevronLeft, Save
} from "lucide-react";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Header } from "@/components/layout/header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EVENT_TYPES, SERVICE_CATEGORIES } from "@shared/schema";

// Form validation schema
const profileSchema = z.object({
  businessName: z.string().min(2, { message: "Business name must be at least 2 characters" }),
  description: z.string().min(20, { message: "Description must be at least 20 characters" }),
  phone: z.string().optional(),
  email: z.string().email({ message: "Please enter a valid email address" }),
  address: z.string().optional(),
  city: z.string().optional(),
  categories: z.array(z.string()).min(1, { message: "Select at least one category" }),
  eventTypes: z.array(z.string()).min(1, { message: "Select at least one event type" }),
  socialMedia: z.object({
    instagram: z.string().optional(),
    facebook: z.string().optional(),
    website: z.string().optional(),
  }),
});

type ProfileFormValues = z.infer<typeof profileSchema>;
type VendorProfileData = ProfileFormValues & {
  profileImage?: string | null;
};

export default function VendorProfile() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  
  // Redirect if not a vendor
  useEffect(() => {
    if (user && user.userType !== 'vendor') {
      navigate("/");
    }
  }, [user, navigate]);
  
  // Fetch vendor profile data
  const { data: vendorProfile, isLoading } = useQuery<VendorProfileData>({
    queryKey: ['/api/vendor/profile'],
    enabled: !!user && user.userType === 'vendor',
  });
  
  // Form setup
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      businessName: "",
      description: "",
      phone: "",
      email: "",
      address: "",
      city: "",
      categories: [],
      eventTypes: [],
      socialMedia: {
        instagram: "",
        facebook: "",
        website: "",
      },
    }
  });
  
  // Update form values when vendor data is loaded
  useEffect(() => {
    if (vendorProfile) {
      form.reset({
        businessName: vendorProfile.businessName || "",
        description: vendorProfile.description || "",
        phone: vendorProfile.phone || "",
        email: vendorProfile.email || "",
        address: vendorProfile.address || "",
        city: vendorProfile.city || "",
        categories: vendorProfile.categories || [],
        eventTypes: vendorProfile.eventTypes || [],
        socialMedia: {
          instagram: vendorProfile.socialMedia?.instagram || "",
          facebook: vendorProfile.socialMedia?.facebook || "",
          website: vendorProfile.socialMedia?.website || "",
        },
      });
      
      if (vendorProfile.profileImage) {
        setProfileImage(vendorProfile.profileImage);
      }
    }
  }, [vendorProfile, form]);
  
  // Update profile mutation
  const profileMutation = useMutation({
    mutationFn: async (data: ProfileFormValues & { profileImage?: string | null }) => {
      return await apiRequest("PUT", "/api/vendor/profile", data);
    },
    onSuccess: () => {
      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/vendor/profile'] });
      setIsEditing(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const onSubmit = (data: ProfileFormValues) => {
    profileMutation.mutate({
      ...data,
      profileImage,
    });
  };
  
  // Image handler
  const handleUpdateProfileImage = () => {
    // In a real app, you would use a file upload component
    // For this demo, we'll just add a placeholder image
    const placeholderImage = "https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60";
    setProfileImage(placeholderImage);
  };
  
  if (isLoading) {
    return (
      <div>
        <Header title="Profile" showBack={true} />
        <div className="px-5 py-6">
          <div className="flex flex-col items-center mb-6">
            <Skeleton className="h-24 w-24 rounded-full mb-4" />
            <Skeleton className="h-6 w-40 mb-2" />
            <Skeleton className="h-4 w-32" />
          </div>
          
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
      <Header title="Profile" showBack={true} />
      
      <div className="px-5 py-6">
        {isEditing ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Profile Image */}
              <div className="flex flex-col items-center mb-6">
                <div className="relative">
                  {profileImage ? (
                    <div className="relative">
                      <Avatar className="h-24 w-24">
                        <AvatarImage src={profileImage} alt="Profile" />
                        <AvatarFallback>
                          <User className="h-12 w-12 text-neutral-400" />
                        </AvatarFallback>
                      </Avatar>
                      <button
                        type="button"
                        onClick={() => setProfileImage(null)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="h-24 w-24 bg-neutral-200 rounded-full flex items-center justify-center">
                      <User className="h-12 w-12 text-neutral-400" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleUpdateProfileImage}
                    className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-2"
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                </div>
              </div>
              
              {/* Basic Info */}
              <div>
                <h3 className="font-medium text-neutral-800 mb-4">Business Information</h3>
                
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="businessName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Business Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Your business name" {...field} />
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
                            placeholder="Tell clients about your business..." 
                            {...field} 
                            rows={4}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              
              <Separator />
              
              {/* Contact Information */}
              <div>
                <h3 className="font-medium text-neutral-800 mb-4">Contact Information</h3>
                
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="your@email.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input placeholder="Your phone number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Address</FormLabel>
                          <FormControl>
                            <Input placeholder="Your address" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input placeholder="Your city" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>
              
              <Separator />
              
              {/* Social Media */}
              <div>
                <h3 className="font-medium text-neutral-800 mb-4">Social Media & Web</h3>
                
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="socialMedia.website"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Website</FormLabel>
                        <FormControl>
                          <Input placeholder="https://yourwebsite.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="socialMedia.instagram"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Instagram</FormLabel>
                          <FormControl>
                            <Input placeholder="@yourusername" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="socialMedia.facebook"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Facebook</FormLabel>
                          <FormControl>
                            <Input placeholder="Your Facebook page" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>
              
              {/* Submit Buttons */}
              <div className="flex space-x-2 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="flex-1 bg-primary text-primary-foreground"
                  disabled={profileMutation.isPending}
                >
                  {profileMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        ) : (
          <div>
            {/* Profile Header */}
            <div className="flex flex-col items-center mb-6">
              <Avatar className="h-24 w-24 mb-4">
                <AvatarImage src={profileImage || ""} alt="Profile" />
                <AvatarFallback>
                  <User className="h-12 w-12 text-neutral-400" />
                </AvatarFallback>
              </Avatar>
              <h2 className="font-bold text-xl text-foreground mb-1">
                {vendorProfile?.businessName || "Your Business"}
              </h2>
              <p className="text-neutral-600 text-center mb-4">
                {vendorProfile?.categories?.map((cat: string) => cat).join(", ")}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="border-primary text-primary"
                onClick={() => setIsEditing(true)}
              >
                <Edit2 className="h-4 w-4 mr-2" />
                Edit Profile
              </Button>
            </div>
            
            <Separator className="mb-6" />
            
            {/* Business Description */}
            <div className="mb-6">
              <h3 className="font-medium text-neutral-800 mb-2">About</h3>
              <p className="text-neutral-700">
                {vendorProfile?.description || "No description added yet."}
              </p>
            </div>
            
            <Separator className="mb-6" />
            
            {/* Contact Information */}
            <div className="mb-6">
              <h3 className="font-medium text-neutral-800 mb-4">Contact Information</h3>
              
              <div className="space-y-3">
                <div className="flex items-center">
                  <Mail className="h-5 w-5 text-neutral-500 mr-3" />
                  <span>{vendorProfile?.email || "No email added"}</span>
                </div>
                
                <div className="flex items-center">
                  <Phone className="h-5 w-5 text-neutral-500 mr-3" />
                  <span>{vendorProfile?.phone || "No phone added"}</span>
                </div>
                
                <div className="flex items-center">
                  <MapPin className="h-5 w-5 text-neutral-500 mr-3" />
                  <span>
                    {vendorProfile?.address && vendorProfile?.city 
                      ? `${vendorProfile.address}, ${vendorProfile.city}`
                      : "No address added"}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="mt-8 flex">
              <Button
                variant="outline"
                className="flex-1 mr-2"
                onClick={() => navigate("/vendor/dashboard")}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Dashboard
              </Button>
              <Button
                className="flex-1 bg-primary text-primary-foreground ml-2"
                onClick={() => setIsEditing(true)}
              >
                <Edit2 className="h-4 w-4 mr-1" />
                Edit Profile
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
