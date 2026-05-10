import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Route } from "wouter";
import { useEffect } from "react";
import { useLocation } from "wouter";

export function ProtectedRoute({
  path,
  component: Component,
}: {
  path: string;
  component: () => React.JSX.Element;
}) {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();

  // Handle the redirection in useEffect to avoid infinite rendering
  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/auth");
    }
  }, [user, isLoading, navigate]);

  return (
    <Route path={path}>
      {isLoading ? (
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : user ? (
        <Component />
      ) : null}
    </Route>
  );
}
