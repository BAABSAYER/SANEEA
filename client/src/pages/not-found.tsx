import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
      <div className="text-9xl font-bold text-primary">404</div>
      <h1 className="text-3xl font-bold mt-4">Page Not Found</h1>
      <p className="text-muted-foreground mt-2 text-center max-w-md">
        The page you're looking for doesn't exist or you don't have permission to access it.
      </p>
      <Link href="/admin">
        <Button className="mt-8">
          Back to Dashboard
        </Button>
      </Link>
    </div>
  );
}