import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface AvatarGroupProps {
  avatars: {
    src?: string;
    fallback: string;
  }[];
  max?: number;
  size?: "sm" | "md" | "lg";
}

export function AvatarGroup({
  avatars,
  max = 4,
  size = "md",
}: AvatarGroupProps) {
  const displayAvatars = avatars.slice(0, max);
  const overflow = avatars.length - max;

  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
  };

  const ringClasses = {
    sm: "-ml-2 ring-2",
    md: "-ml-3 ring-2",
    lg: "-ml-4 ring-2",
  };

  return (
    <div className="flex">
      {displayAvatars.map((avatar, i) => (
        <Avatar
          key={i}
          className={cn(
            sizeClasses[size], 
            i > 0 && ringClasses[size], 
            "ring-background"
          )}
        >
          <AvatarImage src={avatar.src} alt="" />
          <AvatarFallback>{avatar.fallback}</AvatarFallback>
        </Avatar>
      ))}
      
      {overflow > 0 && (
        <div 
          className={cn(
            sizeClasses[size], 
            ringClasses[size],
            "ring-background bg-muted text-muted-foreground flex items-center justify-center rounded-full text-sm font-medium"
          )}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
