import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:provider/provider.dart';
import 'dart:io';
import '../config/api_config.dart';
import './api_service.dart';
import '../l10n/language_provider.dart';

class User {
  final int id;
  final String? name;
  final String email;
  final String userType;
  final String? phone;  // Added phone field
  final String? username;  // Added username field for compatibility
  
  User({
    required this.id,
    required this.name,
    required this.email,
    required this.userType,
    this.phone,  // Added to constructor
    this.username,  // Added to constructor
  });
  
  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'],
      name: json['fullName'] ?? json['name'], // Backend sends fullName
      email: json['email'],
      userType: json['userType'],
      phone: json['phone'],
      username: json['username'],
    );
  }
  
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'email': email,
      'userType': userType,
      'phone': phone,  // Added to toJson
      'username': username,  // Added to toJson
    };
  }
}

class AuthService extends ChangeNotifier {
  static const String _userStorageKey = 'saneea_user_data';
  static const String _loginTimestampKey = 'saneea_login_timestamp';

  User? _user;
  String? _token;
  String? _error;
  bool _isLoading = false;
  bool _isLoggedIn = false;
  int _unreadMessageCount = 0;
  
  // API Service for consistent API communication
  final ApiService apiService = ApiService();

  User? get user => _user;
  String? get token => _token;
  String? get error => _error;
  bool get isLoading => _isLoading;
  bool get isLoggedIn => _isLoggedIn;
  int get unreadMessageCount => _unreadMessageCount;
  
  // Update unread message count
  void updateUnreadMessageCount(int count) {
    _unreadMessageCount = count;
    notifyListeners();
  }
  
  // Show login required dialog
  Future<bool> checkLoginStatus(BuildContext context) async {
    if (!_isLoggedIn || _user == null) {
      // Get language for i18n
      final languageProvider = Provider.of<LanguageProvider>(context, listen: false);
      final bool isArabic = languageProvider.locale.languageCode == 'ar';
      
      // Show dialog
      await showDialog(
        context: context,
        barrierDismissible: false,
        builder: (BuildContext dialogContext) {
          return AlertDialog(
            title: Text(isArabic ? 'تسجيل الدخول مطلوب' : 'Login Required'),
            content: Text(
              isArabic 
                  ? 'يجب تسجيل الدخول أولاً لإكمال هذا الإجراء.'
                  : 'You need to login first to complete this action.'
            ),
            actions: [
              TextButton(
                onPressed: () {
                  Navigator.of(dialogContext).pop();
                  Navigator.pushNamedAndRemoveUntil(
                    context, 
                    '/login', 
                    (route) => false
                  );
                },
                child: Text(isArabic ? 'تسجيل الدخول' : 'Login'),
              ),
            ],
          );
        },
      );
      return false;
    }
    return true;
  }

  AuthService() {
    _loadStoredData();
  }

  Future<void> _loadStoredData() async {
    final prefs = await SharedPreferences.getInstance();
    final storedUserData = prefs.getString(_userStorageKey);
    final loginTimestamp = prefs.getInt(_loginTimestampKey);

    if (storedUserData != null) {
      _user = User.fromJson(json.decode(storedUserData));
      
      // Check if login is recent (within 7 days)
      final now = DateTime.now().millisecondsSinceEpoch;
      final sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
      
      if (loginTimestamp != null && (now - loginTimestamp) < sevenDaysInMs) {
        // Validate session by checking with server
        try {
          final response = await apiService.get(ApiConfig.userEndpoint);
          if (response.statusCode == 200) {
            _isLoggedIn = true;
            print("Session restored successfully for user: ${_user!.email}");
          } else {
            // Session expired, clear stored data
            await _clearStoredData();
            print("Session expired, cleared stored data");
          }
        } catch (e) {
          // Network error, assume session is valid for offline use
          // Will validate again when network is available
          _isLoggedIn = true;
          print("Network error validating session, assuming valid: $e");
        }
      } else {
        // Login too old, clear data
        await _clearStoredData();
        print("Login session too old, cleared stored data");
      }
    }
    
    notifyListeners();
  }

  Future<void> _clearStoredData() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_userStorageKey);
    await prefs.remove(_loginTimestampKey);
    await apiService.clearCookies();
    _user = null;
    _token = null;
    _isLoggedIn = false;
  }

  Future<bool> login(String username, String password) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    
    try {
      // Login using the ApiService
      final loginResponse = await apiService.post(
        ApiConfig.loginEndpoint,
        {
          'username': username,
          'password': password,
        },
      );
      
      if (loginResponse.statusCode == 200) {
        try {
          // Get user info from the current session
          final userResponse = await apiService.get(ApiConfig.userEndpoint);
          
          if (userResponse.statusCode == 200) {
            final dynamic userData = json.decode(userResponse.body);
            print("User data from server: $userData");
            
            try {
              // Use more flexible parsing to handle different response formats
              _user = User(
                id: userData['id'],
                name: userData['fullName'] ?? userData['username'] ?? username,
                email: userData['email'] ?? '$username@example.com',
                userType: userData['userType'] ?? 'client',
                phone: userData['phone'],
                username: userData['username'] ?? username,
              );
              
              // For debugging
              print("Successfully created user object: ${_user!.toJson()}");
              
              // Cookie-based authentication is handled by the ApiService
              _isLoggedIn = true;
              
              final prefs = await SharedPreferences.getInstance();
              await prefs.setString(_userStorageKey, json.encode(_user!.toJson()));
              await prefs.setInt(_loginTimestampKey, DateTime.now().millisecondsSinceEpoch);
              
              _isLoading = false;
              notifyListeners();
              return true;
            } catch (parseError) {
              _error = 'Error parsing user data: ${parseError.toString()}\nData: $userData';
              _isLoading = false;
              notifyListeners();
              return false;
            }
          } else {
            _error = 'Failed to get user info after login. Status: ${userResponse.statusCode}, Body: ${userResponse.body}';
            _isLoading = false;
            notifyListeners();
            return false;
          }
        } catch (e) {
          _error = 'Error getting user data: ${e.toString()}';
          _isLoading = false;
          notifyListeners();
          return false;
        }
      } else {
        try {
          _error = json.decode(loginResponse.body)['message'] ?? 'Login failed';
        } catch (e) {
          _error = 'Login failed: ${loginResponse.statusCode}';
        }
        _isLoading = false;
        notifyListeners();
        return false;
      }
    } catch (e) {
      _error = 'Network error: ${e.toString()}';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> register(String username, String email, String password, String fullName, String userType) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    
    try {
      final registrationResponse = await apiService.post(
        ApiConfig.registerEndpoint,
        {
          'username': username,
          'email': email,
          'password': password,
          'fullName': fullName,
          'userType': userType,
        },
      );
      
      if (registrationResponse.statusCode == 201) {
        final dynamic userData = json.decode(registrationResponse.body);
        
        _user = User(
          id: userData['id'],
          name: userData['fullName'] ?? userData['username'],
          email: userData['email'],
          userType: userData['userType'] ?? 'client',
          phone: userData['phone'],
          username: userData['username'],
        );
        
        _isLoggedIn = true;
        
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(_userStorageKey, json.encode(_user!.toJson()));
        await prefs.setInt(_loginTimestampKey, DateTime.now().millisecondsSinceEpoch);
        
        _isLoading = false;
        notifyListeners();
        return true;
      } else {
        try {
          _error = json.decode(registrationResponse.body)['message'] ?? 'Registration failed';
        } catch (e) {
          _error = 'Registration failed: ${registrationResponse.statusCode}';
        }
        _isLoading = false;
        notifyListeners();
        return false;
      }
    } catch (e) {
      _error = 'Network error: ${e.toString()}';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    try {
      // Call the logout endpoint using ApiService (which handles cookies)
      await apiService.post(ApiConfig.logoutEndpoint, {});
    } catch (e) {
      // Ignore errors during logout
      print('Error during logout: $e');
    }
    
    // Clear all stored authentication data
    await _clearStoredData();
    notifyListeners();
  }
  
  // Server connectivity check
  Future<bool> testServerConnectivity() async {
    try {
      final response = await http.get(Uri.parse("${ApiConfig.apiUrl}/health"))
          .timeout(const Duration(seconds: 5));
      return response.statusCode >= 200 && response.statusCode < 300;
    } catch (e) {
      print("Server connectivity test failed: $e");
      return false;
    }
  }
}
