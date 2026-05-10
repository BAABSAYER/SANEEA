import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import React, { useState, useEffect } from "react";
import { ArrowLeft, Phone, Video } from "lucide-react";
import { useLocation } from "wouter";
import { ChatWindow } from "@/components/chat/chat-window";
import { useAuth } from "@/hooks/use-auth";

interface User {
  id: number;
  username: string;
  fullName?: string;
  userType: string;
  email?: string;
  avatarUrl?: string;
  isOnline?: boolean;
}

export default function Chat() {
  const params = useParams<{ userId: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const userId = params.userId ? parseInt(params.userId) : 0;
  
  const { data: recipient, isLoading } = useQuery<User>({
    queryKey: [`/api/users/${userId}`],
  });
  
  const handleBack = () => {
    navigate(
      user?.userType === 'vendor'
        ? '/vendor/messages'
        : user?.userType === 'admin'
          ? '/admin/messages'
          : '/messages'
    );
  };
  
  // Online status is determined by user presence in the API response
  const isOnline = !!recipient?.isOnline;
  
  // Get appropriate icon based on user type
  const getUserAvatar = () => {
    if (!recipient) return null;
    
    const userType = recipient.userType || 'client';
    const iconColor = userType === 'vendor' ? 'text-primary' : 'text-secondary';
    const iconBg = userType === 'vendor' ? 'bg-primary/10' : 'bg-secondary/10';
    
    let icon;
    switch (userType) {
      case 'vendor':
        icon = (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="5" width="16" height="16" rx="2" />
            <path d="m9 10 2 2-2 2" />
            <path d="m13 10-2 2 2 2" />
          </svg>
        );
        break;
      default:
        icon = (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        );
    }
    
    return (
      <div className={`w-10 h-10 ${iconBg} rounded-full flex items-center justify-center mr-3`}>
        {icon}
      </div>
    );
  };
  
  return (
    <div className="h-full w-full bg-neutral-100 flex flex-col">
      {/* Header */}
      <header className="bg-white py-3 px-4 shadow-sm flex items-center">
        <button onClick={handleBack} className="mr-3">
          <ArrowLeft className="h-5 w-5 text-neutral-800" />
        </button>
        <div className="flex items-center">
          {getUserAvatar()}
          <div>
            <p className="font-medium text-neutral-800">
              {isLoading ? "Loading..." : (recipient && (recipient.fullName || recipient.username)) || "User"}
            </p>
            <p className={`text-xs ${isOnline ? 'text-green-500' : 'text-neutral-500'}`}>
              {isOnline ? 'Online' : 'Offline'}
            </p>
          </div>
        </div>
        <div className="ml-auto flex space-x-3">
          <button className="w-8 h-8 bg-neutral-100 rounded-full flex items-center justify-center">
            <Phone className="h-4 w-4 text-neutral-600" />
          </button>
          <button className="w-8 h-8 bg-neutral-100 rounded-full flex items-center justify-center">
            <Video className="h-4 w-4 text-neutral-600" />
          </button>
        </div>
      </header>

      {/* Chat Content */}
      <ChatWindow recipientId={userId} />
    </div>
  );
}
