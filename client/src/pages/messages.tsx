import { ChatList } from "@/components/chat/chat-list";
import { Header } from "@/components/layout/header";
import { useTranslation } from "react-i18next";

export default function Messages() {
  const { t } = useTranslation();

  return (
    <div className="h-full w-full flex flex-col">
      {/* Header */}
      <Header title={t("messages.title")} showBack={false} showSearch={false} />
      
      {/* Chat List */}
      <ChatList />
    </div>
  );
}
