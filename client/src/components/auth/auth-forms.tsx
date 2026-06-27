import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { USER_TYPES, SERVICE_CATEGORIES } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useMemo } from "react";

// Login form validation schema
const createLoginSchema = (t: (key: string) => string) => z.object({
  username: z.string().min(1, t("auth.phoneRequired")),
  password: z.string().min(1, t("auth.passwordRequired")),
});

type LoginFormValues = z.infer<ReturnType<typeof createLoginSchema>>;

// Vendor registration schema
const createVendorRegistrationSchema = (t: (key: string) => string) => z.object({
  email: z.string().email(t("auth.validEmailRequired")),
  username: z.string().min(3, t("auth.usernameMin")),
  password: z.string().min(8, t("auth.passwordMin")),
  businessName: z.string().min(1, t("auth.businessNameRequired")),
  phone: z.string().optional(),
  category: z.string().min(1, t("auth.serviceCategoryRequired")),
  userType: z.literal(USER_TYPES.VENDOR),
});

type VendorRegistrationValues = z.infer<ReturnType<typeof createVendorRegistrationSchema>>;

export function LoginForm() {
  const { loginMutation } = useAuth();
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const loginSchema = useMemo(() => createLoginSchema(t), [t]);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    loginMutation.mutate(data, {
      onSuccess: () => {
        navigate("/");
      }
    });
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm">
      <h2 className="font-bold text-xl text-foreground mb-6">{t("auth.login")}</h2>
      
      {loginMutation.isError && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {loginMutation.error?.message || t("auth.loginError")}
          </AlertDescription>
        </Alert>
      )}
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label htmlFor="username">{t("profile.phoneNumber")}</Label>
          <Input
            id="username"
            type="tel"
            inputMode="tel"
            placeholder="05xxxxxxxx"
            {...register("username")}
            className={errors.username ? "border-red-500" : ""}
          />
          {errors.username && (
            <p className="text-red-500 text-xs mt-1">{errors.username.message}</p>
          )}
        </div>
        
        <div>
          <div className="flex justify-between items-center">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <span className="text-xs text-muted-foreground">
              {t("auth.contactAdminReset")}
            </span>
          </div>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            {...register("password")}
            className={errors.password ? "border-red-500" : ""}
          />
          {errors.password && (
            <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>
          )}
        </div>
        
        <Button 
          type="submit" 
          className="w-full btn-primary"
          disabled={loginMutation.isPending}
        >
          {loginMutation.isPending ? t("auth.loggingIn") : t("auth.login")}
        </Button>
      </form>
    </div>
  );
}

export function VendorRegistrationForm({ onSwitch }: { onSwitch: () => void }) {
  const { registerMutation } = useAuth();
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const vendorRegistrationSchema = useMemo(() => createVendorRegistrationSchema(t), [t]);
  
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<VendorRegistrationValues>({
    resolver: zodResolver(vendorRegistrationSchema),
    defaultValues: {
      userType: USER_TYPES.VENDOR,
    },
  });

  const onSubmit = async (data: VendorRegistrationValues) => {
    registerMutation.mutate(data, {
      onSuccess: () => {
        navigate("/");
      }
    });
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h2 className="font-bold text-xl text-foreground">{t("auth.signUpAsVendor")}</h2>
        <button onClick={onSwitch} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-5 w-5" />
        </button>
      </div>
      
      {registerMutation.isError && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {registerMutation.error?.message || t("auth.registrationFailed")}
          </AlertDescription>
        </Alert>
      )}
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label htmlFor="businessName">{t("auth.businessName")}</Label>
          <Input
            id="businessName"
            placeholder="Your Business LLC"
            {...register("businessName")}
            className={errors.businessName ? "border-red-500" : ""}
          />
          {errors.businessName && (
            <p className="text-red-500 text-xs mt-1">{errors.businessName.message}</p>
          )}
        </div>
        
        <div>
          <Label htmlFor="email">{t("auth.businessEmail")}</Label>
          <Input
            id="email"
            type="email"
            placeholder="business@email.com"
            {...register("email")}
            className={errors.email ? "border-red-500" : ""}
          />
          {errors.email && (
            <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
          )}
        </div>
        
        <div>
          <Label htmlFor="username">{t("auth.username")}</Label>
          <Input
            id="username"
            placeholder="businessname"
            {...register("username")}
            className={errors.username ? "border-red-500" : ""}
          />
          {errors.username && (
            <p className="text-red-500 text-xs mt-1">{errors.username.message}</p>
          )}
        </div>
        
        <div>
          <Label htmlFor="password">{t("auth.password")}</Label>
          <Input
            id="password"
            type="password"
            placeholder={t("auth.passwordMinPlaceholder")}
            {...register("password")}
            className={errors.password ? "border-red-500" : ""}
          />
          {errors.password && (
            <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>
          )}
        </div>
        
        <div>
          <Label htmlFor="phone">{t("auth.businessPhoneOptional")}</Label>
          <Input
            id="phone"
            placeholder="+1 (555) 000-0000"
            {...register("phone")}
            className={errors.phone ? "border-red-500" : ""}
          />
          {errors.phone && (
            <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>
          )}
        </div>
        
        <div>
          <Label htmlFor="category">{t("auth.serviceCategory")}</Label>
          <Select 
            onValueChange={(value) => setValue("category", value)}
            defaultValue=""
          >
            <SelectTrigger 
              id="category"
              className={errors.category ? "border-red-500" : ""}
            >
              <SelectValue placeholder={t("auth.selectServiceType")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SERVICE_CATEGORIES.VENUE}>{t("serviceCategories.venue")}</SelectItem>
              <SelectItem value={SERVICE_CATEGORIES.CATERING}>{t("serviceCategories.catering")}</SelectItem>
              <SelectItem value={SERVICE_CATEGORIES.PHOTOGRAPHY}>{t("serviceCategories.photography")}</SelectItem>
              <SelectItem value={SERVICE_CATEGORIES.DECORATION}>{t("serviceCategories.decoration")}</SelectItem>
              <SelectItem value={SERVICE_CATEGORIES.ENTERTAINMENT}>{t("serviceCategories.entertainment")}</SelectItem>
              <SelectItem value={SERVICE_CATEGORIES.OTHER}>{t("serviceCategories.other")}</SelectItem>
            </SelectContent>
          </Select>
          {errors.category && (
            <p className="text-red-500 text-xs mt-1">{errors.category.message}</p>
          )}
        </div>
        
        <input type="hidden" {...register("userType")} />
        
        <Button 
          type="submit" 
          className="w-full bg-primary text-white font-semibold py-3 px-6 rounded-lg shadow hover:bg-primary/90 transition duration-200"
          disabled={registerMutation.isPending}
        >
          {registerMutation.isPending ? t("auth.creatingAccount") : t("auth.createVendorAccount")}
        </Button>
        
        <p className="text-center text-xs text-muted-foreground mt-4">
          {t("auth.bySigningUp")}
          <a href="#" className="text-primary font-medium"> {t("auth.termsOfService")} </a>
          {t("auth.and")}
          <a href="#" className="text-primary font-medium"> {t("auth.privacyPolicy")}</a>.
        </p>
      </form>
    </div>
  );
}
