import { ChatList } from "@/components/chat/chat-list";
import { Header } from "@/components/layout/header";

export default function Messages() {
  return (
    <div className="h-full w-full flex flex-col">
      {/* Header */}
      <Header title="Messages" showBack={false} showSearch={false} />
      
      {/* Chat List */}
      <ChatList />
    </div>
  );
}
