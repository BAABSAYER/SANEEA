import { useEffect } from "react";
import { useLocation, useParams } from "wouter";

export default function AdminChat() {
  const { userId } = useParams<{ userId: string }>();
  const [, navigate] = useLocation();

  useEffect(() => {
    const queryUserId = new URLSearchParams(window.location.search).get("userId");
    const targetUserId = userId || queryUserId;
    navigate(targetUserId ? `/admin/messages?userId=${targetUserId}` : "/admin/messages", { replace: true });
  }, [navigate, userId]);

  return <></>;
}
