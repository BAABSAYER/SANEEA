import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:saneea_mobile_flutter/services/auth_service.dart';
import 'package:saneea_mobile_flutter/services/message_service.dart';
import 'package:saneea_mobile_flutter/l10n/language_provider.dart';
import 'package:saneea_mobile_flutter/screens/chat_screen.dart';
import 'package:saneea_mobile_flutter/models/chat_user.dart';

class MessagesScreen extends StatefulWidget {
  const MessagesScreen({super.key});

  @override
  State<MessagesScreen> createState() => _MessagesScreenState();
}

class _MessagesScreenState extends State<MessagesScreen> {
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    // Initialize message service and load chats
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final messageService = Provider.of<MessageService>(context, listen: false);
      
      // Initialize message service and load conversations
      await messageService.initialize();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _startChatWithAdmin(BuildContext context, bool isArabic) async {
    final authService = Provider.of<AuthService>(context, listen: false);
    
    try {
      // Get admin user ID (assuming admin has ID 7 based on logs)
      const int adminUserId = 7;
      
      // Create ChatUser object for admin
      final adminUser = ChatUser(
        id: adminUserId,
        name: isArabic ? 'الإدارة' : 'Admin',
        email: 'admin@saneea.local',
        username: 'admin',
        userType: 'admin',
        unreadCount: 0,
      );
      
      // Navigate to chat screen
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => ChatScreen(
            userId: adminUser.id,
            userName: adminUser.name,
          ),
        ),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(isArabic ? 'خطأ في فتح المحادثة' : 'Error opening chat'),
          backgroundColor: Colors.red,
        ),
      );
    }
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
        
    if (_searchQuery.isNotEmpty) {
      filteredUsers = filteredUsers.where((user) {
        return user.name.toLowerCase().contains(_searchQuery.toLowerCase()) ||
               user.email.toLowerCase().contains(_searchQuery.toLowerCase());
      }).toList();
    }

    return Scaffold(
      backgroundColor: Color(0xFFF8F9FA),
      appBar: AppBar(
        title: Text(
          isArabic ? 'الرسائل' : 'Messages',
          style: TextStyle(
            fontWeight: FontWeight.bold,
            color: Colors.white,
            fontSize: 20,
          ),
        ),
        backgroundColor: Color(0xFF6A3DE8),
        elevation: 0,
        centerTitle: true,
        actions: [
          IconButton(
            icon: Icon(Icons.add_comment, color: Colors.white),
            onPressed: () => _startChatWithAdmin(context, isArabic),
          ),
        ],
      ),
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              Color(0xFF6A3DE8).withValues(alpha: 0.1),
              Color(0xFFF8F9FA),
            ],
            stops: [0.0, 0.3],
          ),
        ),
        child: Column(
          children: [
            // Enhanced Search Bar
            Container(
              padding: EdgeInsets.all(20),
              child: Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.05),
                      blurRadius: 20,
                      offset: Offset(0, 10),
                    ),
                  ],
                ),
                child: TextField(
                  controller: _searchController,
                  decoration: InputDecoration(
                    hintText: isArabic ? 'البحث عن المحادثات...' : 'Search conversations...',
                    hintStyle: TextStyle(color: Colors.grey.shade500),
                    prefixIcon: Icon(Icons.search, color: Color(0xFF6A3DE8)),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(20),
                      borderSide: BorderSide.none,
                    ),
                    filled: true,
                    fillColor: Colors.white,
                    contentPadding: EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                  ),
                  onChanged: (value) {
                    setState(() {
                      _searchQuery = value;
                    });
                  },
                ),
              ),
            ),

            // Enhanced Chat List
            Expanded(
              child: messageService.isLoading
                  ? Center(
                      child: Container(
                        padding: EdgeInsets.all(40),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            CircularProgressIndicator(
                              valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF6A3DE8)),
                            ),
                            SizedBox(height: 16),
                            Text(
                              isArabic ? 'جاري تحميل المحادثات...' : 'Loading conversations...',
                              style: TextStyle(color: Colors.grey.shade600),
                            ),
                          ],
                        ),
                      ),
                    )
                  : filteredUsers.isEmpty
                      ? Container(
                          padding: EdgeInsets.all(40),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Container(
                                padding: EdgeInsets.all(32),
                                decoration: BoxDecoration(
                                  color: Color(0xFF6A3DE8).withValues(alpha: 0.1),
                                  borderRadius: BorderRadius.circular(50),
                                ),
                                child: Icon(
                                  Icons.chat_bubble_outline,
                                  size: 80,
                                  color: Color(0xFF6A3DE8),
                                ),
                              ),
                              SizedBox(height: 32),
                              Text(
                                _searchQuery.isNotEmpty
                                    ? (isArabic ? 'لا توجد محادثات مطابقة' : 'No matching conversations')
                                    : (isArabic ? 'لا توجد محادثات بعد' : 'No conversations yet'),
                                style: TextStyle(
                                  fontSize: 20,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF2D3748),
                                ),
                                textAlign: TextAlign.center,
                              ),
                              SizedBox(height: 12),
                              Text(
                                isArabic 
                                    ? 'ابدأ محادثة جديدة مع الإدارة\nللحصول على المساعدة والدعم'
                                    : 'Start a new conversation with admin\nto get help and support',
                                style: TextStyle(
                                  fontSize: 16,
                                  color: Colors.grey.shade600,
                                ),
                                textAlign: TextAlign.center,
                              ),
                              SizedBox(height: 32),
                              Container(
                                width: double.infinity,
                                height: 56,
                                decoration: BoxDecoration(
                                  gradient: LinearGradient(
                                    colors: [Color(0xFF6A3DE8), Color(0xFF8B5CF6)],
                                    begin: Alignment.topLeft,
                                    end: Alignment.bottomRight,
                                  ),
                                  borderRadius: BorderRadius.circular(16),
                                  boxShadow: [
                                    BoxShadow(
                                      color: Color(0xFF6A3DE8).withValues(alpha: 0.3),
                                      blurRadius: 15,
                                      offset: Offset(0, 8),
                                    ),
                                  ],
                                ),
                                child: Material(
                                  color: Colors.transparent,
                                  child: InkWell(
                                    borderRadius: BorderRadius.circular(16),
                                    onTap: () => _startChatWithAdmin(context, isArabic),
                                    child: Container(
                                      padding: EdgeInsets.symmetric(horizontal: 24),
                                      child: Row(
                                        mainAxisAlignment: MainAxisAlignment.center,
                                        children: [
                                          Icon(Icons.add_comment, color: Colors.white, size: 20),
                                          SizedBox(width: 8),
                                          Text(
                                            isArabic ? 'ابدأ محادثة' : 'Start Message',
                                            style: TextStyle(
                                              color: Colors.white,
                                              fontSize: 16,
                                              fontWeight: FontWeight.w600,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        )
                      : Container(
                          padding: EdgeInsets.symmetric(horizontal: 20),
                          child: ListView.builder(
                            physics: BouncingScrollPhysics(),
                            itemCount: filteredUsers.length,
                            itemBuilder: (context, index) {
                              final user = filteredUsers[index];
                              return _buildEnhancedChatUserCard(user, isArabic);
                            },
                          ),
                        ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEnhancedChatUserCard(ChatUser user, bool isArabic) {
    return Container(
      margin: EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 15,
            offset: Offset(0, 5),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
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
          child: Padding(
            padding: EdgeInsets.all(16),
            child: Row(
              children: [
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [Color(0xFF6A3DE8), Color(0xFF8B5CF6)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(28),
                  ),
                  child: Icon(
                    Icons.person,
                    color: Colors.white,
                    size: 28,
                  ),
                ),
                SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        user.name,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF2D3748),
                        ),
                      ),
                      SizedBox(height: 4),
                      Text(
                        user.lastMessage ?? (isArabic ? 'لا توجد رسائل' : 'No messages'),
                        style: TextStyle(
                          fontSize: 14,
                          color: Colors.grey.shade600,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                if (user.unreadCount > 0)
                  Container(
                    padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: Color(0xFFFF6B6B),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      '${user.unreadCount}',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                SizedBox(width: 8),
                Icon(
                  Icons.chevron_right,
                  color: Colors.grey.shade400,
                  size: 20,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}