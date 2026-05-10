import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:saneea_mobile_flutter/services/auth_service.dart';
import 'package:saneea_mobile_flutter/services/message_service.dart';
import 'package:saneea_mobile_flutter/l10n/language_provider.dart';
import 'package:saneea_mobile_flutter/screens/chat_screen.dart';
import 'package:saneea_mobile_flutter/models/chat_user.dart';

class ChatListScreen extends StatefulWidget {
  const ChatListScreen({super.key});

  @override
  State<ChatListScreen> createState() => _ChatListScreenState();
}

class _ChatListScreenState extends State<ChatListScreen> {
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    // Initialize message service and load chats
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final authService = Provider.of<AuthService>(context, listen: false);
      final messageService = Provider.of<MessageService>(context, listen: false);
      
      // Make sure message service is initialized and load chat users
      await messageService.initialize();
      messageService.loadChatUsers(authService);
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final languageProvider = Provider.of<LanguageProvider>(context);
    final bool isArabic = languageProvider.locale.languageCode == 'ar';
    final messageService = Provider.of<MessageService>(context);
    
    // Get chat users and filter based on search query if needed
    // Only show admin users - filter out any vendors
    List<ChatUser> filteredUsers = messageService.chatUsers
        .where((user) => user.userType == 'admin')
        .toList();
        
    // Then apply search filter if needed
    final List<ChatUser> chatUsers = _searchQuery.isEmpty
        ? filteredUsers
        : filteredUsers
            .where((user) =>
                user.name.toLowerCase().contains(_searchQuery.toLowerCase()))
            .toList();

    return Column(
      children: [
        // Search bar
        Padding(
          padding: const EdgeInsets.all(16.0),
          child: TextField(
            controller: _searchController,
            decoration: InputDecoration(
              hintText: isArabic ? 'بحث عن مستخدمين...' : 'Search users...',
              prefixIcon: const Icon(Icons.search),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide.none,
              ),
              filled: true,
              fillColor: Colors.grey.shade100,
              contentPadding: const EdgeInsets.symmetric(vertical: 12),
            ),
            onChanged: (value) {
              setState(() {
                _searchQuery = value;
              });
            },
          ),
        ),
        
        // Chat users list
        Expanded(
          child: messageService.isLoading
              ? const Center(child: CircularProgressIndicator())
              : chatUsers.isEmpty
                  ? _buildEmptyState(isArabic)
                  : ListView.builder(
                      itemCount: chatUsers.length,
                      itemBuilder: (context, index) {
                        final user = chatUsers[index];
                        return _buildChatUserItem(context, user, isArabic);
                      },
                    ),
        ),
      ],
    );
  }

  Widget _buildEmptyState(bool isArabic) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.chat_outlined,
            size: 64,
            color: Colors.grey.shade400,
          ),
          const SizedBox(height: 16),
          Text(
            isArabic ? 'لا توجد محادثات' : 'No conversations yet',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: Colors.grey.shade600,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            isArabic
                ? 'ستظهر هنا محادثاتك مع المسؤولين فقط'
                : 'Your conversations with admins will appear here',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Colors.grey.shade600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildChatUserItem(BuildContext context, ChatUser user, bool isArabic) {
    return ListTile(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => ChatScreen(
              userId: user.id,
              userName: user.name,
            ),
          ),
        );
      },
      leading: CircleAvatar(
        backgroundColor: const Color(0xFF6A3DE8).withValues(alpha: 0.1),
        child: Text(
          user.name.isNotEmpty ? user.name[0].toUpperCase() : 'U',
          style: const TextStyle(
            fontWeight: FontWeight.bold,
            color: Color(0xFF6A3DE8),
          ),
        ),
      ),
      title: Text(
        user.name,
        style: const TextStyle(
          fontWeight: FontWeight.bold,
        ),
      ),
      subtitle: Row(
        children: [
          Text(
            user.userType.isNotEmpty ? '[${user.userType}] ' : '',
            style: TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: 12,
              color: Colors.grey.shade700,
            ),
          ),
          Expanded(
            child: Text(
              user.lastMessage ?? (isArabic ? 'ابدأ المحادثة...' : 'Start conversation...'),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: user.lastMessage != null ? Colors.black87 : Colors.grey.shade600,
              ),
            ),
          ),
        ],
      ),
      trailing: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (user.lastMessageTime != null)
            Text(
              _formatLastMessageTime(user.lastMessageTime!, isArabic),
              style: TextStyle(
                fontSize: 12,
                color: Colors.grey.shade600,
              ),
            ),
          const SizedBox(height: 4),
          if (user.hasUnreadMessages)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: const BoxDecoration(
                color: Color(0xFF6A3DE8),
                shape: BoxShape.circle,
              ),
              child: const Text(
                "●",
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
        ],
      ),
    );
  }

  String _formatLastMessageTime(DateTime time, bool isArabic) {
    final now = DateTime.now();
    final difference = now.difference(time);
    
    if (difference.inDays > 0) {
      return isArabic 
          ? '${difference.inDays} ${difference.inDays == 1 ? 'يوم' : 'أيام'}'
          : '${difference.inDays}${difference.inDays == 1 ? 'd' : 'd'}';
    } else if (difference.inHours > 0) {
      return isArabic 
          ? '${difference.inHours} ${difference.inHours == 1 ? 'ساعة' : 'ساعات'}'
          : '${difference.inHours}h';
    } else if (difference.inMinutes > 0) {
      return isArabic 
          ? '${difference.inMinutes} ${difference.inMinutes == 1 ? 'دقيقة' : 'دقائق'}'
          : '${difference.inMinutes}m';
    } else {
      return isArabic ? 'الآن' : 'Now';
    }
  }
}