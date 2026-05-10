import { ReactElement, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Route, useLocation } from "wouter";

interface AdminRouteProps {
  path: string;
  component: () => ReactElement;
}

export function AdminRoute({ path, component: Component }: AdminRouteProps) {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        navigate("/auth");
      } else if (user.userType !== 'admin') {
        navigate("/");
      }
    }
  }, [user, isLoading, navigate]);

  return (
    <Route path={path}>
      {() => {
        if (isLoading) {
          return (
            <div className="flex items-center justify-center min-h-screen">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          );
        }

        if (!user || user.userType !== 'admin') {
          return null;
        }

        return <Component />;
      }}
    </Route>
  );
}
