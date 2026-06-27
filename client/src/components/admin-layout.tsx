import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { 
  Home, 
  Users, 
  Calendar, 
  CalendarDays,
  MessageSquare, 
  LogOut, 
  UserCircle,
  Menu,
  UserCog,
  X,
  Package
} from "lucide-react";
import appIcon from '@/assets/logo.png';
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
}

export function AdminLayout({ children, title }: AdminLayoutProps) {
  const { logoutMutation, user } = useAuth();
  const { t } = useTranslation();
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    { name: t('navigation.dashboard'), path: "/admin", icon: <Home className="h-5 w-5" /> },
    { name: t('navigation.eventManagement'), path: "/admin/events", icon: <CalendarDays className="h-5 w-5" /> },
    { name: t('navigation.bundles'), path: "/admin/bundles", icon: <Package className="h-5 w-5" /> },
    { name: t('navigation.bookings'), path: "/admin/bookings", icon: <Calendar className="h-5 w-5" /> },
    { name: t('navigation.schedule', { defaultValue: 'Schedule' }), path: "/admin/schedule", icon: <CalendarDays className="h-5 w-5" /> },
    { name: t('navigation.vendors', { defaultValue: 'Vendors' }), path: "/admin/vendors", icon: <UserCog className="h-5 w-5" /> },
    { name: t('navigation.users'), path: "/admin/unified-users", icon: <Users className="h-5 w-5" /> },
    { name: t('navigation.messages'), path: "/admin/messages", icon: <MessageSquare className="h-5 w-5" /> },
    { name: t('navigation.profile'), path: "/admin/profile", icon: <UserCircle className="h-5 w-5" /> },
  ];

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="flex items-center justify-center h-24 border-b border-sidebar-border p-4">
          <img
            src={appIcon}
            alt="سنيع"
            className="h-16 max-w-[180px] object-contain brightness-0 invert"
          />
        </div>

        <nav className="flex flex-col flex-1 p-4 space-y-1">
          {menuItems.map((item) => (
            <Link key={item.path} href={item.path}>
              <div className={cn(
                "flex items-center px-4 py-3 rounded-md transition-colors cursor-pointer",
                location === item.path
                  ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}>
                {item.icon}
                <span className="ml-3">{item.name}</span>
              </div>
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <Button
            variant="ghost"
            className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-5 w-5" />
            {t('navigation.logout')}
          </Button>
        </div>
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button 
            variant="outline" 
            size="icon" 
            className="md:hidden absolute top-4 left-4 z-50"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-64 bg-sidebar text-sidebar-foreground border-sidebar-border">
          <div className="flex items-center justify-center h-24 border-b border-sidebar-border p-4">
            <img
              src={appIcon}
              alt="سنيع"
              className="h-16 max-w-[180px] object-contain brightness-0 invert"
            />
          </div>

          <nav className="flex flex-col flex-1 p-4 space-y-1">
            {menuItems.map((item) => (
              <Link key={item.path} href={item.path}>
                <div
                  className={cn(
                    "flex items-center px-4 py-3 rounded-md transition-colors cursor-pointer",
                    location === item.path
                      ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                  onClick={() => setIsOpen(false)}
                >
                  {item.icon}
                  <span className="ml-3">{item.name}</span>
                </div>
              </Link>
            ))}
          </nav>

          <div className="p-4 border-t border-sidebar-border">
            <Button
              variant="ghost"
              className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-5 w-5" />
              {t('navigation.logout')}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        <header className="min-h-16 border-b border-border bg-card flex items-center justify-between gap-3 px-4 py-3 pl-16 md:px-6 md:pl-6">
          <h1 className="min-w-0 truncate text-lg font-bold md:text-xl">{title}</h1>
          <div className="flex shrink-0 items-center gap-2 md:gap-4">
            <LanguageSwitcher />
            {user && (
              <div className="hidden md:flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {user.fullName || user.username}
                </span>
              </div>
            )}
          </div>
        </header>
        <main className="min-w-0 flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
