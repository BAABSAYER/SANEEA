import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { AuthProvider } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";

// Admin Dashboard Pages
import AdminDashboard from "./pages/admin/dashboard";
import AdminBookings from "./pages/admin/bookings";
import AdminMessages from "./pages/admin/admin-messages";
import AdminChat from "./pages/admin/admin-chat";
import AdminUsers from "./pages/admin/users";
import AdminUsersList from "./pages/admin/users-list";
import UnifiedUsersPage from "./pages/admin/unified-users";
import AdminEvents from "./pages/admin/events";
import AdminBundles from "./pages/admin/bundles";
import AdminSchedule from "./pages/admin/schedule";
import AdminVendors from "./pages/admin/vendors";
import AdminAnalyticsPage from "./pages/admin-analytics";

import Messages from "./pages/messages";
import Chat from "./pages/chat";
import Dashboard from "./pages/dashboard";

// Vendor Pages
import VendorDashboard from "./pages/vendor/dashboard";
import VendorBookings from "./pages/vendor/bookings";
import VendorServices from "./pages/vendor/services";
import ServiceForm from "./pages/vendor/service-form";
import VendorProfile from "./pages/vendor/profile";

// Shared Pages
import Profile from "./pages/profile";

import { ProtectedRoute } from "./lib/protected-route";
import { AdminRoute } from "./lib/admin-route";
import { VendorRoute } from "./lib/vendor-route";
import "./app.css";

function Router() {
  return (
    <Switch>
      {/* Auth Route */}
      <Route path="/auth" component={AuthPage} />
      
      {/* Default Route - Role-based redirect */}
      <ProtectedRoute path="/" component={Dashboard} />
      <ProtectedRoute path="/messages" component={Messages} />
      <ProtectedRoute path="/chat/:userId" component={Chat} />

      {/* Vendor Routes */}
      <VendorRoute path="/vendor/dashboard" component={VendorDashboard} />
      <VendorRoute path="/vendor/bookings" component={VendorBookings} />
      <VendorRoute path="/vendor/messages" component={Messages} />
      <VendorRoute path="/vendor/chat/:userId" component={Chat} />
      <VendorRoute path="/vendor/services" component={VendorServices} />
      <VendorRoute path="/vendor/services/new" component={ServiceForm} />
      <VendorRoute path="/vendor/services/edit/:id" component={ServiceForm} />
      <VendorRoute path="/vendor/profile" component={VendorProfile} />
      
      {/* Admin Dashboard Routes */}
      <AdminRoute path="/admin" component={AdminDashboard} />
      <AdminRoute path="/admin/bookings" component={AdminBookings} />
      <AdminRoute path="/admin/schedule" component={AdminSchedule} />
      <AdminRoute path="/admin/events" component={AdminEvents} />
      <AdminRoute path="/admin/bundles" component={AdminBundles} />
      <AdminRoute path="/admin/vendors" component={AdminVendors} />
      <AdminRoute path="/admin/users" component={AdminUsers} />
      <AdminRoute path="/admin/users-list" component={AdminUsersList} />
      <AdminRoute path="/admin/unified-users" component={UnifiedUsersPage} />
      <AdminRoute path="/admin/messages" component={AdminMessages} />
      <AdminRoute path="/admin/chat" component={AdminChat} />
      <AdminRoute path="/admin/chat/:userId" component={AdminChat} />
      <AdminRoute path="/admin/profile" component={Profile} />
      
      {/* 404 Route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <div className="min-h-screen font-arabic bg-background">
            <Router />
          </div>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
