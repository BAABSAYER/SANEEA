import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';

class ApiTestHelper {
  static Future<void> testAllEndpoints(String? sessionCookie) async {
    print('🔍 Starting API connectivity test...');
    
    if (sessionCookie == null) {
      print('❌ No session cookie available');
      return;
    }
    
    final headers = {
      'Content-Type': 'application/json',
      'Cookie': sessionCookie,
    };
    
    // Test user endpoint
    await _testEndpoint('User Info', '${ApiConfig.baseUrl}/api/user', headers);
    
    // Test conversations endpoint
    await _testEndpoint('Conversations', '${ApiConfig.baseUrl}/api/conversations', headers);
    
    // Test event types endpoint
    await _testEndpoint('Event Types', '${ApiConfig.baseUrl}/api/event-types/active', headers);
    
    // Test bookings endpoint (assuming user ID 23 from logs)
    await _testEndpoint('User Bookings', '${ApiConfig.baseUrl}/api/bookings/client/23', headers);
    
    // Test messages endpoint (with admin user ID 7)
    await _testEndpoint('Messages with Admin', '${ApiConfig.baseUrl}/api/messages/7', headers);
    
    print('🏁 API connectivity test completed');
  }
  
  static Future<void> _testEndpoint(String name, String url, Map<String, String> headers) async {
    try {
      print('🔗 Testing $name: $url');
      
      final response = await http.get(
        Uri.parse(url),
        headers: headers,
      ).timeout(const Duration(seconds: 10));
      
      print('📊 $name - Status: ${response.statusCode}');
      
      if (response.statusCode == 200) {
        try {
          final data = json.decode(response.body);
          if (data is List) {
            print('✅ $name - Received list with ${data.length} items');
          } else if (data is Map) {
            print('✅ $name - Received object with ${data.keys.length} fields');
          } else {
            print('✅ $name - Received data: ${data.toString().substring(0, 50)}...');
          }
        } catch (e) {
          print('⚠️ $name - Response not JSON: ${response.body.substring(0, 100)}...');
        }
      } else {
        print('❌ $name - Error: ${response.body.substring(0, 200)}...');
      }
    } catch (e) {
      print('💥 $name - Exception: $e');
    }
  }
  
  static Future<void> testMessageSending(String? sessionCookie) async {
    if (sessionCookie == null) {
      print('❌ Cannot test message sending - no session cookie');
      return;
    }
    
    print('💬 Testing message sending to admin...');
    
    try {
      final response = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/api/messages'),
        headers: {
          'Content-Type': 'application/json',
          'Cookie': sessionCookie,
        },
        body: json.encode({
          'receiverId': 7, // Admin ID
          'content': 'Test message from mobile app - ${DateTime.now()}',
        }),
      ).timeout(const Duration(seconds: 10));
      
      print('📤 Message send - Status: ${response.statusCode}');
      print('📤 Message send - Response: ${response.body}');
      
    } catch (e) {
      print('💥 Message send failed: $e');
    }
  }
}