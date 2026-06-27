import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Camera, X, MapPin, Phone, Mail, 
  Edit2, User, ChevronLeft
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Header } from "@/components/layout/header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTranslation } from "react-i18next";

// Form validation schema
const createProfileSchema = (t: (key: string) => string) => z.object({
  businessName: z.string().min(2, { message: t("vendorProfile.businessNameMin") }),
  description: z.string().min(20, { message: t("vendorProfile.descriptionMin") }),
  phone: z.string().optional(),
  email: z.union([
    z.string().email({ message: t("auth.validEmailRequired") }),
    z.literal(""),
  ]).optional(),
  category: z.string().min(1, { message: t("vendorProfile.categoryRequired") }),
  address: z.string().optional(),
  city: z.string().optional(),
  priceRange: z.string().optional(),
  photosText: z.string().optional(),
  previousWorkText: z.string().optional(),
  attachmentsText: z.string().optional(),
});

type ProfileFormValues = z.infer<ReturnType<typeof createProfileSchema>>;
type VendorProfileData = ProfileFormValues & {
  photos?: string[] | null;
  previousWork?: Array<{ title: string; description?: string | null; url?: string | null; imageUrl?: string | null }> | null;
  attachments?: Array<{ url: string; fileName?: string | null; description?: string | null; contentType?: string | null }> | null;
};

function lines(value?: string | null) {
  return String(value || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function parsePreviousWork(value?: string | null) {
  return lines(value).map((line) => {
    const [title, url, imageUrl, description] = line.split("|").map((part) => part?.trim() || "");
    return { title, url: url || null, imageUrl: imageUrl || null, description: description || null };
  }).filter((item) => item.title);
}

function parseAttachments(value?: string | null) {
  return lines(value).map((line) => {
    const [url, fileName, description] = line.split("|").map((part) => part?.trim() || "");
    return { url, fileName: fileName || null, description: description || null, contentType: null };
  }).filter((item) => item.url);
}

function previousWorkToText(value: VendorProfileData["previousWork"]) {
  return (value || [])
    .map((item) => [item.title || "", item.url || "", item.imageUrl || "", item.description || ""].join(" | "))
    .join("\n");
}

function attachmentsToText(value: VendorProfileData["attachments"]) {
  return (value || [])
    .map((item) => [item.url || "", item.fileName || "", item.description || ""].join(" | "))
    .join("\n");
}

export default function VendorProfile() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();
  const profileSchema = useMemo(() => createProfileSchema(t), [t]);
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
      category: "",
      priceRange: "",
      photosText: "",
      previousWorkText: "",
      attachmentsText: "",
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
        category: vendorProfile.category || "",
        address: vendorProfile.address || "",
        city: vendorProfile.city || "",
        priceRange: vendorProfile.priceRange || "",
        photosText: (vendorProfile.photos || []).join("\n"),
        previousWorkText: previousWorkToText(vendorProfile.previousWork),
        attachmentsText: attachmentsToText(vendorProfile.attachments),
      });
      
      if (vendorProfile.photos?.[0]) {
        setProfileImage(vendorProfile.photos[0]);
      }
    }
  }, [vendorProfile, form]);
  
  // Update profile mutation
  const profileMutation = useMutation({
    mutationFn: async (data: ProfileFormValues & { profileImage?: string | null }) => {
      return await apiRequest("PUT", "/api/vendor/profile", {
        businessName: data.businessName,
        description: data.description,
        email: data.email || undefined,
        phone: data.phone,
        category: data.category,
        address: data.address,
        city: data.city,
        priceRange: data.priceRange,
        photos: [data.profileImage, ...lines(data.photosText)].filter(Boolean),
        previousWork: parsePreviousWork(data.previousWorkText),
        attachments: parseAttachments(data.attachmentsText),
      });
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
        <Header title={t("profile.title")} showBack={true} />
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
      <Header title={t("profile.title")} showBack={true} />
      
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
                <h3 className="font-medium text-neutral-800 mb-4">{t("vendorProfile.businessInformation")}</h3>
                
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="businessName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("vendorProfile.businessName")}</FormLabel>
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

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <FormControl>
                            <Input placeholder="venue, catering, photography..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="priceRange"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Price Range</FormLabel>
                          <FormControl>
                            <Input placeholder="budget, moderate, premium..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>
              
              <Separator />
              
              {/* Contact Information */}
              <div>
                <h3 className="font-medium text-neutral-800 mb-4">{t("vendorProfile.contactInformation")}</h3>
                
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
                  
                  <div className="grid gap-4 sm:grid-cols-2">
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
              
              {/* Portfolio */}
              <div>
                <h3 className="font-medium text-neutral-800 mb-4">{t("vendorProfile.portfolioAndAttachments")}</h3>
                
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="photosText"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Photo URLs</FormLabel>
                        <FormControl>
                          <Textarea placeholder="One image URL per line" {...field} rows={3} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="previousWorkText"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("adminVendors.previousWork")}</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Title | link URL | image URL | description" {...field} rows={4} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="attachmentsText"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("adminVendors.attachments")}</FormLabel>
                        <FormControl>
                          <Textarea placeholder="File URL | file name | description" {...field} rows={4} />
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
                  onClick={() => setIsEditing(false)}
                >
                  {t("common.cancel")}
                </Button>
                <Button 
                  type="submit" 
                  className="flex-1 bg-primary text-primary-foreground"
                  disabled={profileMutation.isPending}
                >
                  {profileMutation.isPending ? t("vendorProfile.saving") : t("profile.saveChanges")}
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
                {vendorProfile?.businessName || t("vendorProfile.yourBusiness")}
              </h2>
              <p className="text-neutral-600 text-center mb-4">
                {[vendorProfile?.category, vendorProfile?.priceRange].filter(Boolean).join(" · ") || t("vendorProfile.noCategoryAdded")}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="border-primary text-primary"
                onClick={() => setIsEditing(true)}
              >
                <Edit2 className="h-4 w-4 mr-2" />
                {t("profile.editProfile")}
              </Button>
            </div>
            
            <Separator className="mb-6" />
            
            {/* Business Description */}
            <div className="mb-6">
              <h3 className="font-medium text-neutral-800 mb-2">{t("vendorProfile.about")}</h3>
              <p className="text-neutral-700">
                {vendorProfile?.description || t("adminVendors.noDescriptionAdded")}
              </p>
            </div>
            
            <Separator className="mb-6" />

            {/* Portfolio */}
            <div className="mb-6">
              <h3 className="font-medium text-neutral-800 mb-3">{t("adminVendors.previousWork")}</h3>
              {vendorProfile?.previousWork?.length ? (
                <div className="space-y-3">
                  {vendorProfile.previousWork.map((item, index) => (
                    <div key={`${item.title}-${index}`} className="rounded-lg border bg-white p-4">
                      <h4 className="font-medium text-neutral-800">{item.title}</h4>
                      {item.description ? <p className="text-sm text-neutral-600 mt-1">{item.description}</p> : null}
                      {item.url ? <a className="text-sm text-primary mt-2 inline-block" href={item.url} target="_blank" rel="noreferrer">{t("adminVendors.openWorkLink")}</a> : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-neutral-600">{t("adminVendors.noPreviousWorkAdded")}</p>
              )}
            </div>

            <Separator className="mb-6" />

            <div className="mb-6">
              <h3 className="font-medium text-neutral-800 mb-3">{t("adminVendors.attachments")}</h3>
              {vendorProfile?.attachments?.length ? (
                <div className="space-y-2">
                  {vendorProfile.attachments.map((attachment, index) => (
                    <a
                      key={`${attachment.url}-${index}`}
                      className="block rounded-lg border bg-white p-3 text-sm text-primary"
                      href={attachment.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {attachment.fileName || attachment.description || attachment.url}
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-neutral-600">{t("adminVendors.noAttachmentsAdded")}</p>
              )}
            </div>
            
            <Separator className="mb-6" />
            
            {/* Contact Information */}
            <div className="mb-6">
              <h3 className="font-medium text-neutral-800 mb-4">{t("vendorProfile.contactInformation")}</h3>
              
              <div className="space-y-3">
                <div className="flex items-center">
                  <Mail className="h-5 w-5 text-neutral-500 mr-3" />
                  <span>{vendorProfile?.email || t("vendorProfile.noEmailAdded")}</span>
                </div>
                
                <div className="flex items-center">
                  <Phone className="h-5 w-5 text-neutral-500 mr-3" />
                  <span>{vendorProfile?.phone || t("vendorProfile.noPhoneAdded")}</span>
                </div>
                
                <div className="flex items-center">
                  <MapPin className="h-5 w-5 text-neutral-500 mr-3" />
                  <span>
                    {vendorProfile?.address && vendorProfile?.city 
                      ? `${vendorProfile.address}, ${vendorProfile.city}`
                      : t("vendorProfile.noAddressAdded")}
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
                {t("vendorDashboard.dashboard")}
              </Button>
              <Button
                className="flex-1 bg-primary text-primary-foreground ml-2"
                onClick={() => setIsEditing(true)}
              >
                <Edit2 className="h-4 w-4 mr-1" />
                {t("profile.editProfile")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
