import { useEffect } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { LoginForm } from "@/components/auth/auth-forms";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import logoSvg from "@/assets/logo.png";

export default function AuthPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  
  // Redirect to home if already logged in
  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="absolute top-4 right-4">
          <LanguageSwitcher />
        </div>

        <div className="text-center">
          <img src={logoSvg} alt="سنيع" className="h-28 max-w-[260px] mx-auto mb-4 object-contain" />
          <h2 className="text-3xl font-bold text-foreground">{t('auth.login')}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('auth.loginError')}
          </p>
        </div>

        <div className="bg-white py-8 px-6 shadow-brand rounded-xl border border-border">
          <LoginForm />

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-3 bg-white text-muted-foreground">
                  {t('dashboard.title')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
