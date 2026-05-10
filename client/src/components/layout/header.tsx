import { useLocation } from "wouter";
import { Bell, User, ChevronLeft, Search, SlidersHorizontal } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "react-i18next";
import logoSvg from "@/assets/logo.png";

interface HeaderProps {
  title?: string;
  showBack?: boolean;
  showSearch?: boolean;
  showProfile?: boolean;
  onSearchChange?: (value: string) => void;
  searchValue?: string;
}

export function Header({
  title,
  showBack = false,
  showSearch = false,
  showProfile = true,
  onSearchChange,
  searchValue = "",
}: HeaderProps) {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { t } = useTranslation();

  return (
    <header className="bg-white py-4 px-5 border-b border-border">
      {showBack ? (
        <div className="flex items-center">
          <button onClick={() => window.history.back()} className="mr-3">
            <ChevronLeft className="h-5 w-5 text-foreground" />
          </button>
          <h1 className="font-bold text-xl text-foreground">{title || ""}</h1>
        </div>
      ) : (
        <div className="flex justify-between items-center">
          <div>
            {title ? (
              <h1 className="font-bold text-2xl text-foreground">{title}</h1>
            ) : (
              <div className="flex items-center">
                <img src={logoSvg} alt="سنيع" className="h-16 max-w-[180px] object-contain" />
              </div>
            )}
            {user && (
              <p className="text-sm text-muted-foreground">
                Welcome back, <span className="font-medium text-foreground">{user.fullName || user.username}</span>
              </p>
            )}
          </div>
          {showProfile && (
            <div className="flex items-center space-x-3">
              <button className="w-10 h-10 bg-muted rounded-full flex items-center justify-center hover:bg-muted/80 transition-colors">
                <Bell className="h-5 w-5 text-muted-foreground" />
              </button>
              <button
                onClick={() => navigate("/profile")}
                className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center hover:bg-primary/20 transition-colors"
              >
                <User className="h-5 w-5 text-primary" />
              </button>
            </div>
          )}
        </div>
      )}

      {showSearch && (
        <div className="mt-4 flex space-x-3">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder={t('auth.searchPlaceholder')}
              className="w-full bg-muted py-2 pl-9 pr-4 rounded-lg border-none outline-none text-sm focus:ring-2 focus:ring-primary/20"
              value={searchValue}
              onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          </div>
          <button className="bg-muted px-3 rounded-lg flex items-center justify-center hover:bg-muted/80 transition-colors">
            <SlidersHorizontal className="h-4 w-4 text-foreground" />
          </button>
        </div>
      )}
    </header>
  );
}
