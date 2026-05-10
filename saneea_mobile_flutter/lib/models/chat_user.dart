class ChatUser {
  final int id;
  final String name;
  final String email;
  final String username;
  final String? avatar;
  final String userType;
  final String? lastMessage;
  final DateTime? lastMessageTime;
  final bool hasUnreadMessages;
  final int unreadCount;

  ChatUser({
    required this.id,
    required this.name,
    required this.email,
    required this.username,
    this.avatar,
    this.userType = 'client',
    this.lastMessage,
    this.lastMessageTime,
    this.hasUnreadMessages = false,
    this.unreadCount = 0,
  });

  factory ChatUser.fromJson(Map<String, dynamic> json) {
    return ChatUser(
      id: json['userId'] as int? ?? json['id'] as int? ?? 0,
      name: json['name'] as String? ?? json['fullName'] as String? ?? json['username'] as String? ?? '',
      email: json['email'] as String? ?? '',
      username: json['username'] as String? ?? '',
      avatar: json['avatar'] as String? ?? json['avatarUrl'] as String?,
      userType: json['userType'] as String? ?? 'client',
      lastMessage: json['lastMessage'] != null 
          ? json['lastMessage']['content'] as String?
          : null,
      lastMessageTime: json['lastMessage'] != null && json['lastMessage']['createdAt'] != null
          ? DateTime.tryParse(json['lastMessage']['createdAt'])
          : json['lastMessageTime'] != null 
              ? DateTime.tryParse(json['lastMessageTime']) 
              : null,
      hasUnreadMessages: (json['unreadCount'] as int? ?? 0) > 0,
      unreadCount: json['unreadCount'] as int? ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'email': email,
      'username': username,
      'avatar': avatar,
      'userType': userType,
      'lastMessage': lastMessage,
      'lastMessageTime': lastMessageTime?.toIso8601String(),
      'hasUnreadMessages': hasUnreadMessages,
      'unreadCount': unreadCount,
    };
  }
}