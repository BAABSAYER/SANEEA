import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:saneea_mobile_flutter/services/auth_service.dart';
import 'package:saneea_mobile_flutter/services/message_service.dart';
import 'package:saneea_mobile_flutter/models/message.dart';
import 'package:saneea_mobile_flutter/l10n/language_provider.dart';

class ChatScreen extends StatefulWidget {
  final int userId;
  final String userName;
  
  const ChatScreen({
    super.key,
    required this.userId,
    required this.userName,
  });

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final TextEditingController _messageController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  bool _isLoading = true;
  
  @override
  void initState() {
    super.initState();
    _loadMessages();
    // Start automatic refresh for this chat
    final messageService = Provider.of<MessageService>(context, listen: false);
    messageService.startAutoRefresh(widget.userId);
  }
  
  @override
  void dispose() {
    // Stop automatic refresh when leaving chat
    final messageService = Provider.of<MessageService>(context, listen: false);
    messageService.stopAutoRefresh();
    _messageController.dispose();
    _scrollController.dispose();
    super.dispose();
  }
  
  Future<void> _loadMessages() async {
    final messageService = Provider.of<MessageService>(context, listen: false);
    await messageService.loadMessages(widget.userId);
    
    if (mounted) {
      setState(() {
        _isLoading = false;
      });
      
      // Scroll to bottom after messages load
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_scrollController.hasClients) {
          _scrollController.animateTo(
            _scrollController.position.maxScrollExtent,
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeOut,
          );
        }
      });
    }
  }
  
  Future<void> _sendMessage() async {
    final text = _messageController.text.trim();
    if (text.isEmpty) return;
    
    final messageService = Provider.of<MessageService>(context, listen: false);
    final success = await messageService.sendMessage(
      widget.userId,
      text,
    );
    
    if (success) {
      _messageController.clear();
      
      // Scroll to bottom after sending
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_scrollController.hasClients) {
          _scrollController.animateTo(
            _scrollController.position.maxScrollExtent,
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeOut,
          );
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final languageProvider = Provider.of<LanguageProvider>(context);
    final messageService = Provider.of<MessageService>(context);
    final authService = Provider.of<AuthService>(context);
    final bool isArabic = languageProvider.locale.languageCode == 'ar';
    
    final currentUserId = authService.user?.id;
    
    return Scaffold(
      appBar: AppBar(
        title: Text(
          widget.userName,
          style: const TextStyle(color: Colors.white),
        ),
        backgroundColor: const Color(0xFF6A3DE8),
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: Column(
        children: [
          // Messages list
          Expanded(
            child: _isLoading
              ? const Center(child: CircularProgressIndicator())
              : messageService.messages.isEmpty
                ? Center(
                    child: Text(
                      isArabic
                        ? 'ابدأ محادثة جديدة'
                        : 'Start a new conversation',
                      style: TextStyle(
                        color: Colors.grey.shade600,
                      ),
                    ),
                  )
                : ListView.builder(
                    controller: _scrollController,
                    padding: const EdgeInsets.all(16),
                    itemCount: messageService.messages.length,
                    itemBuilder: (context, index) {
                      final message = messageService.messages[index];
                      final bool isCurrentUser = message.senderId == currentUserId;
                      
                      return _buildMessageBubble(
                        context,
                        message,
                        isCurrentUser,
                        isArabic,
                      );
                    },
                  ),
          ),
          
          // Message input
          Container(
            padding: const EdgeInsets.all(8.0),
            decoration: BoxDecoration(
              color: Colors.white,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.05),
                  blurRadius: 10,
                  offset: const Offset(0, -3),
                ),
              ],
            ),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _messageController,
                    decoration: InputDecoration(
                      hintText: isArabic ? 'اكتب رسالة...' : 'Type a message...',
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(24),
                        borderSide: BorderSide.none,
                      ),
                      filled: true,
                      fillColor: Colors.grey.shade100,
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 10,
                      ),
                    ),
                    textInputAction: TextInputAction.send,
                    onSubmitted: (_) => _sendMessage(),
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  decoration: const BoxDecoration(
                    color: Color(0xFF6A3DE8),
                    shape: BoxShape.circle,
                  ),
                  child: IconButton(
                    icon: const Icon(Icons.send, color: Colors.white),
                    onPressed: _sendMessage,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
  
  Widget _buildMessageBubble(
    BuildContext context,
    Message message,
    bool isCurrentUser,
    bool isArabic,
  ) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4.0),
      child: Row(
        mainAxisAlignment: isCurrentUser
          ? MainAxisAlignment.end
          : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (!isCurrentUser) ...[
            // Avatar for other user
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: const Color(0xFF6A3DE8).withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: Center(
                child: Text(
                  message.senderName[0].toUpperCase(),
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF6A3DE8),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
          ],
          
          // Message bubble
          ConstrainedBox(
            constraints: BoxConstraints(
              maxWidth: MediaQuery.of(context).size.width * 0.7,
            ),
            child: Container(
              padding: const EdgeInsets.symmetric(
                horizontal: 16,
                vertical: 10,
              ),
              decoration: BoxDecoration(
                color: isCurrentUser
                  ? const Color(0xFF6A3DE8)
                  : Colors.grey.shade200,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    message.content,
                    style: TextStyle(
                      color: isCurrentUser ? Colors.white : Colors.black,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      Text(
                        _formatTime(message.timestamp),
                        style: TextStyle(
                          fontSize: 10,
                          color: isCurrentUser
                            ? Colors.white.withValues(alpha: 0.7)
                            : Colors.grey.shade600,
                        ),
                      ),
                      if (isCurrentUser) ...[
                        const SizedBox(width: 4),
                        Icon(
                          message.isRead ? Icons.done_all : Icons.done,
                          size: 12,
                          color: Colors.white.withValues(alpha: 0.7),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
          ),
          
          if (isCurrentUser) const SizedBox(width: 8),
        ],
      ),
    );
  }
  
  String _formatTime(DateTime dateTime) {
    final hours = dateTime.hour.toString().padLeft(2, '0');
    final minutes = dateTime.minute.toString().padLeft(2, '0');
    return '$hours:$minutes';
  }
}
