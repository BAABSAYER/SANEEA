import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { AdminLayout } from "@/components/admin-layout";
import { ChatList } from "@/components/chat/chat-list";
import { ChatWindow } from "@/components/chat/chat-window";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export default function AdminMessages() {
  const { t } = useTranslation();
  const [location, navigate] = useLocation();
  const search = location.includes("?") ? location.slice(location.indexOf("?")) : window.location.search;
  const userIdParam = new URLSearchParams(search).get("userId");
  const userId = userIdParam ? Number(userIdParam) : null;

  return (
    <AdminLayout title={t("messages.title")}>
      <div className="h-full">
        {userId && Number.isFinite(userId) ? (
          <div className="flex h-[calc(100svh-7rem)] flex-col gap-4 md:h-[calc(100vh-8rem)]">
            <div>
              <Button variant="outline" size="sm" onClick={() => navigate("/admin/messages")}>
                <ArrowRight className="mr-2 h-4 w-4" />
                {t("adminChat.clientConversations")}
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden rounded-lg border bg-white">
              <ChatWindow recipientId={userId} />
            </div>
          </div>
        ) : (
          <ChatList />
        )}
      </div>
    </AdminLayout>
  );
}
