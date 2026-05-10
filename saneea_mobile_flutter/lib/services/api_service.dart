import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../config/api_config.dart';

/// API Service to handle all HTTP requests with consistent cookie handling
class ApiService {
  static final ApiService _instance = ApiService._internal();
  static const String _cookieStorageKey = 'saneea_session_cookies';
  
  factory ApiService() {
    return _instance;
  }
  
  ApiService._internal();
  
  String? _storedCookies;
  
  Future<String?> _getCookies() async {
    if (_storedCookies != null) {
      return _storedCookies;
    }

    final prefs = await SharedPreferences.getInstance();
    _storedCookies = prefs.getString(_cookieStorageKey);
    return _storedCookies;
  }
  
  // Store cookies from response
  Future<void> _saveCookies(http.Response response) async {
    final cookies = response.headers['set-cookie'];
    if (cookies != null) {
      _storedCookies = cookies;
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_cookieStorageKey, cookies);
    }
  }

  Future<void> clearCookies() async {
    _storedCookies = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_cookieStorageKey);
  }
  
  // Add cookies to headers if available
  Future<Map<String, String>> _getHeaders({bool isJson = true}) async {
    final cookies = await _getCookies();
    final headers = isJson ? ApiConfig.jsonHeaders : <String, String>{};
    
    if (cookies != null) {
      headers['Cookie'] = cookies;
    }
    
    return headers;
  }
  
  // HTTP GET request with cookie handling
  Future<http.Response> get(String url) async {
    final headers = await _getHeaders();
    final response = await http.get(Uri.parse(url), headers: headers);
    
    if (response.headers.containsKey('set-cookie')) {
      await _saveCookies(response);
    }
    
    return response;
  }
  
  // HTTP POST request with cookie handling
  Future<http.Response> post(String url, dynamic body) async {
    final headers = await _getHeaders();
    final response = await http.post(
      Uri.parse(url),
      headers: headers,
      body: json.encode(body),
    );
    
    if (response.headers.containsKey('set-cookie')) {
      await _saveCookies(response);
    }
    
    return response;
  }
  
  // HTTP PUT request with cookie handling
  Future<http.Response> put(String url, dynamic body) async {
    final headers = await _getHeaders();
    final response = await http.put(
      Uri.parse(url),
      headers: headers,
      body: json.encode(body),
    );
    
    if (response.headers.containsKey('set-cookie')) {
      await _saveCookies(response);
    }
    
    return response;
  }
  
  // HTTP PATCH request with cookie handling
  Future<http.Response> patch(String url, dynamic body) async {
    final headers = await _getHeaders();
    final response = await http.patch(
      Uri.parse(url),
      headers: headers,
      body: json.encode(body),
    );
    
    if (response.headers.containsKey('set-cookie')) {
      await _saveCookies(response);
    }
    
    return response;
  }
  
  // HTTP DELETE request with cookie handling
  Future<http.Response> delete(String url) async {
    final headers = await _getHeaders();
    final response = await http.delete(Uri.parse(url), headers: headers);
    
    if (response.headers.containsKey('set-cookie')) {
      await _saveCookies(response);
    }
    
    return response;
  }
  
  // Parse response and handle common errors
  dynamic parseResponse(http.Response response) {
    final statusCode = response.statusCode;
    
    if (statusCode >= 200 && statusCode < 300) {
      final body = response.body;
      if (body.isEmpty) return null;
      return json.decode(body);
    } else if (statusCode == 401) {
      throw Exception('Authentication required. Please log in.');
    } else if (statusCode == 403) {
      throw Exception('You do not have permission to access this resource.');
    } else if (statusCode == 404) {
      throw Exception('Resource not found.');
    } else {
      String errorMessage;
      try {
        final body = json.decode(response.body);
        errorMessage = body['message'] ?? 'An error occurred. Status: $statusCode';
      } catch (e) {
        errorMessage = 'An error occurred. Status: $statusCode';
      }
      throw Exception(errorMessage);
    }
  }
  
  // Higher-level methods for common operations
  
  // Fetch with automatic parsing
  Future<dynamic> fetch(String url) async {
    final response = await get(url);
    return parseResponse(response);
  }
  
  // Submit data with automatic parsing
  Future<dynamic> submit(String url, dynamic data) async {
    final response = await post(url, data);
    return parseResponse(response);
  }
  
  // Update data with automatic parsing
  Future<dynamic> update(String url, dynamic data) async {
    final response = await put(url, data);
    return parseResponse(response);
  }
  
  // Remove resource with automatic parsing
  Future<dynamic> remove(String url) async {
    final response = await delete(url);
    return parseResponse(response);
  }
  
  // WebSocket connection handling
  WebSocket? _socket;
  
  // Get WebSocket connection (create if not exists)
  Future<WebSocket> getWebSocketConnection() async {
    if (_socket != null && _socket!.readyState == WebSocket.open) {
      return _socket!;
    }
    
    // Close any existing connections
    if (_socket != null) {
      await _socket!.close();
      _socket = null;
    }
    
    // Get stored cookies
    final cookies = await _getCookies();
    
    // Connect to WebSocket with cookies for authentication
    final headers = cookies != null ? {'Cookie': cookies} : null;
    _socket = await WebSocket.connect(ApiConfig.wsUrl, headers: headers);
    
    // Handle WebSocket closure
    _socket!.done.then((_) {
      _socket = null;
    });
    
    return _socket!;
  }
  
  // Close WebSocket connection
  Future<void> closeWebSocketConnection() async {
    if (_socket != null) {
      await _socket!.close();
      _socket = null;
    }
  }
  
  // Send message over WebSocket
  Future<void> sendWebSocketMessage(Map<String, dynamic> message) async {
    final socket = await getWebSocketConnection();
    socket.add(json.encode(message));
  }
  
  // Listen to WebSocket messages
  Stream<dynamic> listenToWebSocketMessages() async* {
    final socket = await getWebSocketConnection();
    
    await for (var message in socket) {
      if (message is String) {
        try {
          yield json.decode(message);
        } catch (e) {
          yield message;
        }
      } else {
        yield message;
      }
    }
  }
}
