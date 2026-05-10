import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Redirect } from "wouter";

// Role-based dashboard router
export default function Dashboard() {
  const { user, isLoading, logoutMutation } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  // Route based on user type
  switch (user.userType) {
    case 'admin':
      return <Redirect to="/admin" />;
    case 'vendor':
      return <Redirect to="/vendor/dashboard" />;
    case 'client':
    default:
      return (
        <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
          <div className="max-w-md w-full rounded-xl border bg-white p-8 text-center shadow-sm">
            <h1 className="text-2xl font-bold text-foreground mb-3">Mobile app only</h1>
            <p className="text-muted-foreground mb-6">
              Client accounts are managed in the mobile app. The web app is now for admins and vendors.
            </p>
            <Button
              className="w-full"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
            >
              {logoutMutation.isPending ? "Signing out..." : "Sign out"}
            </Button>
          </div>
        </div>
      );
  }
}
