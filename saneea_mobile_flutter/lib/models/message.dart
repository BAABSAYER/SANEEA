class Message {
  final int id;
  final int senderId;
  final int receiverId;
  final String senderName;
  final String receiverName;
  final String content;
  final DateTime timestamp;
  final bool isRead;
  final String? senderAvatar;
  final String? receiverAvatar;
  
  Message({
    required this.id,
    required this.senderId,
    required this.receiverId,
    required this.senderName,
    required this.receiverName,
    required this.content,
    required this.timestamp,
    required this.isRead,
    this.senderAvatar,
    this.receiverAvatar,
  });
  
  factory Message.fromJson(Map<String, dynamic> json) {
    return Message(
      id: json['id'] as int? ?? 0,
      senderId: json['senderId'] as int? ?? 0,
      receiverId: json['receiverId'] as int? ?? 0,
      senderName: json['senderName'] as String? ?? 'Unknown',
      receiverName: json['receiverName'] as String? ?? 'Unknown',
      content: json['content'] as String? ?? '',
      timestamp: json['createdAt'] != null 
          ? DateTime.parse(json['createdAt']) 
          : json['timestamp'] != null 
              ? DateTime.parse(json['timestamp']) 
              : DateTime.now(),
      isRead: json['read'] as bool? ?? json['isRead'] as bool? ?? false,
      senderAvatar: json['senderAvatar'],
      receiverAvatar: json['receiverAvatar'],
    );
  }
  
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'senderId': senderId,
      'receiverId': receiverId,
      'senderName': senderName,
      'receiverName': receiverName,
      'content': content,
      'timestamp': timestamp.toIso8601String(),
      'isRead': isRead,
      'senderAvatar': senderAvatar,
      'receiverAvatar': receiverAvatar,
    };
  }
}