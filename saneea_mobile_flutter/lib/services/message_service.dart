import 'dart:convert';
import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import '../config/api_config.dart';
import '../models/message.dart';
import '../models/chat_user.dart';
import 'auth_service.dart';

class MessageService extends ChangeNotifier {
  final AuthService _authService;
  List<Message> _messages = [];
  List<ChatUser> _conversations = [];
  bool _isLoading = false;
  String? _error;
  bool _disposed = false;
  Timer? _refreshTimer;
  int? _currentChatUserId;

  MessageService(this._authService);

  List<Message> get messages => _messages;
  List<ChatUser> get conversations => _conversations;
  List<ChatUser> get chatUsers => _conversations; // Alias for compatibility
  bool get isLoading => _isLoading;
  String? get error => _error;

  void _safeNotifyListeners() {
    if (!_disposed) {
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _disposed = true;
    _refreshTimer?.cancel();
    super.dispose();
  }

  // Start automatic refresh for active chat
  void startAutoRefresh(int userId) {
    _currentChatUserId = userId;
    _refreshTimer?.cancel();
    _refreshTimer = Timer.periodic(Duration(seconds: 3), (timer) {
      if (!_disposed && _currentChatUserId == userId) {
        loadMessages(userId);
      }
    });
  }

  // Stop automatic refresh
  void stopAutoRefresh() {
    _refreshTimer?.cancel();
    _currentChatUserId = null;
  }

  Future<void> loadMessages(int otherUserId) async {
    if (_disposed) return;
    
    try {
      print('Loading messages for user: $otherUserId');
      if (!_authService.isLoggedIn || _authService.user == null) {
        throw Exception('User not authenticated');
      }

      _isLoading = true;
      _error = null;
      _safeNotifyListeners();

      final url = '${ApiConfig.baseUrl}/api/messages/$otherUserId';
      print('Making request to: $url');
      
      final response = await _authService.apiService.get(url);

      print('Response status: ${response.statusCode}');
      print('Response body: ${response.body}');

      if (response.statusCode == 200) {
        final responseBody = response.body.trim();
        if (responseBody.isEmpty || responseBody == '[]') {
          _messages = [];
        } else {
          // Check if response is HTML (error page)
          if (responseBody.startsWith('<!DOCTYPE html>')) {
            throw Exception('Received HTML response instead of JSON');
          }
          
          try {
            final List<dynamic> messagesJson = json.decode(responseBody);
            final newMessages = messagesJson.map((json) => Message.fromJson(json)).toList();
            
            // Merge with existing messages to avoid duplicates
            final Map<int, Message> messageMap = {};
            
            // Add existing messages
            for (final msg in _messages) {
              if (msg.id != null) {
                messageMap[msg.id!] = msg;
              }
            }
            
            // Add new messages
            for (final msg in newMessages) {
              if (msg.id != null) {
                messageMap[msg.id!] = msg;
              }
            }
            
            _messages = messageMap.values.toList();
            _messages.sort((a, b) => a.timestamp.compareTo(b.timestamp));
          } catch (e) {
            print('JSON decode error: $e');
            throw Exception('Invalid JSON response');
          }
        }
      } else if (response.statusCode == 404) {
        _messages = [];
      } else {
        throw Exception('HTTP ${response.statusCode}: ${response.body}');
      }
    } catch (e) {
      _error = e.toString();
      print('Error loading messages: $e');
    } finally {
      _isLoading = false;
      _safeNotifyListeners();
    }
  }

  Future<void> loadConversations() async {
    if (_disposed) return;
    
    try {
      print('Loading conversations...');
      if (!_authService.isLoggedIn || _authService.user == null) {
        throw Exception('User not authenticated');
      }

      final url = '${ApiConfig.baseUrl}/api/conversations';
      print('Making request to: $url');
      
      final response = await _authService.apiService.get(url);

      print('Conversations response status: ${response.statusCode}');
      print('Conversations response body: ${response.body}');

      if (response.statusCode == 200) {
        final responseBody = response.body.trim();
        if (responseBody.isEmpty || responseBody == '[]') {
          _conversations = [];
        } else {
          // Check if response is HTML (error page)
          if (responseBody.startsWith('<!DOCTYPE html>')) {
            throw Exception('Received HTML response instead of JSON');
          }
          
          try {
            final List<dynamic> conversationsJson = json.decode(responseBody);
            _conversations = conversationsJson.map((data) {
              try {
                return ChatUser.fromJson(data);
              } catch (e) {
                print('Error parsing conversation item: $e');
                print('Data: $data');
                // Create fallback ChatUser with safe defaults
                return ChatUser(
                  id: data['userId'] as int? ?? data['id'] as int? ?? 0,
                  name: data['fullName'] as String? ?? data['username'] as String? ?? 'Unknown',
                  email: data['email'] as String? ?? '',
                  username: data['username'] as String? ?? '',
                  userType: data['userType'] as String? ?? 'client',
                  unreadCount: data['unreadCount'] as int? ?? 0,
                  hasUnreadMessages: (data['unreadCount'] as int? ?? 0) > 0,
                );
              }
            }).toList();
          } catch (e) {
            print('JSON decode error for conversations: $e');
            throw Exception('Invalid JSON response');
          }
        }
      } else if (response.statusCode == 404) {
        _conversations = [];
      } else {
        throw Exception('HTTP ${response.statusCode}: ${response.body}');
      }
      
      // Add admin conversation if not present
      await _ensureAdminConversation();
      
    } catch (e) {
      _error = e.toString();
      print('Error loading conversations: $e');
    } finally {
      if (!_disposed) {
        _isLoading = false;
        WidgetsBinding.instance.addPostFrameCallback((_) => _safeNotifyListeners());
      }
    }
  }

  Future<void> _ensureAdminConversation() async {
    // Check if admin conversation already exists
    final adminExists = _conversations.any((user) => user.id == 7);
    if (!adminExists) {
      final adminUser = ChatUser(
        id: 7,
        name: 'Admin',
        email: 'admin@saneea.local',
        username: 'admin',
        unreadCount: 0,
      );
      _conversations.insert(0, adminUser);
    }
  }

  Future<bool> sendMessage(int receiverId, String content) async {
    if (_disposed) return false;
    
    try {
      print('Sending message to user: $receiverId');
      if (!_authService.isLoggedIn || _authService.user == null) {
        throw Exception('User not authenticated');
      }

      final url = '${ApiConfig.baseUrl}/api/messages';
      final messageData = {
        'receiverId': receiverId,
        'content': content,
      };
      
      print('Sending message to: $url');
      print('Message data: $messageData');

      final response = await _authService.apiService.post(url, messageData);

      print('Send message response status: ${response.statusCode}');
      print('Send message response body: ${response.body}');

      if (response.statusCode == 200 || response.statusCode == 201) {
        // Add the new message directly to avoid full reload
        try {
          final messageJson = json.decode(response.body);
          final newMessage = Message.fromJson(messageJson);
          _messages.add(newMessage);
          _messages.sort((a, b) => a.timestamp.compareTo(b.timestamp));
          WidgetsBinding.instance.addPostFrameCallback((_) => _safeNotifyListeners());
        } catch (e) {
          print('Error parsing sent message: $e');
          // Fallback to reload if parsing fails
          await loadMessages(receiverId);
        }
        return true;
      } else {
        _error = 'Failed to send message: ${response.statusCode} - ${response.body}';
        WidgetsBinding.instance.addPostFrameCallback((_) => _safeNotifyListeners());
        return false;
      }
    } catch (e) {
      _error = e.toString();
      print('Error sending message: $e');
      WidgetsBinding.instance.addPostFrameCallback((_) => _safeNotifyListeners());
      return false;
    }
  }

  void clearError() {
    if (_disposed) return;
    _error = null;
    WidgetsBinding.instance.addPostFrameCallback((_) => _safeNotifyListeners());
  }

  void clearMessages() {
    if (_disposed) return;
    _messages.clear();
    WidgetsBinding.instance.addPostFrameCallback((_) => _safeNotifyListeners());
  }

  // Initialize conversations with admin user
  Future<void> initialize() async {
    if (_disposed) return;
    _isLoading = true;
    WidgetsBinding.instance.addPostFrameCallback((_) => _safeNotifyListeners());
    
    await loadConversations();
  }



  // Alias method for compatibility with existing screens
  Future<void> loadChatUsers(AuthService authService) async {
    await loadConversations();
  }
}