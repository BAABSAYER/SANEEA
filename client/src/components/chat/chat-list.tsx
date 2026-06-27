import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { formatDistanceToNow } from "date-fns";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Building, User, Camera, Utensils, Gift, MessageSquareMore, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

interface Conversation {
  userId: number;
  username: string;
  fullName?: string;
  phone?: string;
  userType: string;
  lastMessage?: {
    content: string;
    createdAt: string;
    senderId: number;
  };
  unreadCount: number;
}

export function ChatList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  
  const { data: conversations, isLoading, error } = useQuery<Conversation[]>({
    queryKey: ['/api/conversations'],
    retry: 1,
    staleTime: 30000,
    refetchInterval: 3000, // Auto-refresh every 3 seconds
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
  
  // Show toast on error
  if (error) {
    toast({
      title: t("chat.loadConversationsFailed"),
      description: t("chat.loadConversationsFailedDescription"),
      variant: "destructive",
    });
    console.error("Error loading conversations:", error);
  }
  
  const filteredConversations = conversations ? conversations.filter((conv: Conversation) => {
    if (!conv) return false;
    const fullName = conv.fullName?.toLowerCase() || "";
    const username = conv.username?.toLowerCase() || "";
    const phone = conv.phone?.toLowerCase() || "";
    const search = searchTerm.toLowerCase();
    
    return fullName.includes(search) || username.includes(search) || phone.includes(search);
  }) : [];

  const handleUserSelect = (userId: number) => {
    if (user?.userType === 'admin') {
      navigate(`/admin/messages?userId=${userId}`);
      return;
    }

    const basePath = user?.userType === 'vendor' ? '/vendor/chat' : '/chat';
    navigate(`${basePath}/${userId}`);
  };

  const getTimeAgo = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (error) {
      return "recently";
    }
  };

  // Helper to get appropriate icon based on user type
  const getUserIcon = (userType: string) => {
    switch (userType) {
      case 'vendor':
        return <Building className="text-primary" />;
      case 'client':
        return <User className="text-secondary" />;
      case 'photography':
        return <Camera className="text-accent" />;
      case 'catering':
        return <Utensils className="text-green-600" />;
      case 'decoration':
        return <Gift className="text-purple-600" />;
      default:
        return <User className="text-neutral-500" />;
    }
  };

  // Determine if we have no data because of an error
  const hasError = error !== null;
  
  return (
    <div className="min-h-[calc(100svh-8rem)] bg-muted/40 pb-20 md:min-h-screen">
      <div className="bg-white px-5 py-3 shadow-sm">
        <div className="relative">
          <Input 
            placeholder={t("chat.searchConversations")}
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-500 h-4 w-4" />
        </div>
      </div>

      <div className="divide-y divide-neutral-200">
        {isLoading && (
          <>
            <ConversationSkeleton />
            <ConversationSkeleton />
            <ConversationSkeleton />
          </>
        )}

        {hasError && (
          <div className="p-10 flex flex-col items-center justify-center text-center">
            <AlertCircle className="text-red-500 h-10 w-10 mb-3" />
            <p className="text-neutral-700 font-medium">{t("chat.couldNotLoadConversations")}</p>
            <p className="text-neutral-500 text-sm mt-1">{t("chat.tryAgainLater")}</p>
          </div>
        )}

        {!isLoading && !hasError && (!filteredConversations || filteredConversations.length === 0) && (
          <div className="p-10 flex flex-col items-center justify-center text-center">
            <MessageSquareMore className="text-neutral-400 h-10 w-10 mb-3" />
            <p className="text-neutral-700 font-medium">{t("chat.noConversations")}</p>
            <p className="text-neutral-500 text-sm mt-1">{t("chat.messagesWillAppear")}</p>
          </div>
        )}

        {filteredConversations?.map((conversation: Conversation) => (
          <button 
            key={conversation.userId}
            className="block w-full bg-white p-4 text-left hover:bg-neutral-50"
            onClick={() => handleUserSelect(conversation.userId)}
          >
            <div className="flex min-w-0 items-center">
              <div className="relative">
                <div className={`w-12 h-12 ${conversation.userType === 'vendor' ? 'bg-primary/10' : 'bg-secondary/10'} rounded-full flex items-center justify-center mr-3`}>
                  {getUserIcon(conversation.userType)}
                </div>
                <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${conversation.unreadCount > 0 ? 'bg-green-500' : 'bg-neutral-300'}`}></div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center justify-between gap-3">
                  <p className="truncate font-medium text-neutral-800">
                    {conversation.fullName || conversation.username || t("adminUsers.unknownUser")}
                  </p>
                  {conversation.lastMessage && (
                    <p className="shrink-0 text-xs text-neutral-500">
                      {getTimeAgo(conversation.lastMessage.createdAt)}
                    </p>
                  )}
                </div>
                <p className="text-sm text-neutral-600 truncate">
                  {conversation.lastMessage 
                    ? (conversation.lastMessage.senderId === user?.id 
                        ? `${t("chat.you")}: ` 
                        : "") + conversation.lastMessage.content
                    : t("chat.startConversation")}
                </p>
                {conversation.phone && (
                  <p className="text-xs text-neutral-500 mt-0.5 dir-ltr">
                    {conversation.phone}
                  </p>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ConversationSkeleton() {
  return (
    <div className="block w-full bg-white p-4 text-left">
      <div className="flex items-center">
        <Skeleton className="w-12 h-12 rounded-full mr-3" />
        <div className="flex-1">
          <div className="mb-1 flex items-center justify-between gap-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
    </div>
  );
}
