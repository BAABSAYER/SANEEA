import 'package:flutter/foundation.dart';

import 'dart:convert';
import 'package:saneea_mobile_flutter/models/event_type.dart';
// Removed old imports - now using unified Booking system
import 'package:saneea_mobile_flutter/models/questionnaire_item.dart';
import 'package:saneea_mobile_flutter/models/event_category.dart';
import 'package:saneea_mobile_flutter/config/api_config.dart';
import 'package:saneea_mobile_flutter/services/auth_service.dart';

class EventProvider with ChangeNotifier {
  List<EventType> _eventTypes = [];
  // Removed old EventRequest and Quotation - now using unified Booking system
  List<EventCategory> _categories = [];
  bool _isLoading = false;
  String? _error;

  // Getters
  List<EventType> get eventTypes => _eventTypes;
  // Removed old getters - now using BookingService for requests/quotations
  List<EventCategory> get categories => _categories;
  bool get isLoading => _isLoading;
  String? get error => _error;
  
  // Currently selected category ID
  String? _selectedCategoryId;
  
  // Get a category by ID
  EventCategory? getCategoryById(String id) {
    return _categories.firstWhere(
      (category) => category.id == id,
      orElse: () => EventCategory(
        id: id,
        name: id.substring(0, 1).toUpperCase() + id.substring(1).replaceAll('-', ' '),
        icon: '📅',
      ),
    );
  }
  
  // Get the selected category
  EventCategory? get selectedCategory {
    if (_selectedCategoryId == null) return null;
    return getCategoryById(_selectedCategoryId!);
  }
  
  // Select a category
  void selectCategory(String id) {
    _selectedCategoryId = id;
    notifyListeners();
  }
  
  // Initialize with empty categories
  EventProvider() {
    _categories = [];
  }
  
  // Load categories from event types
  Future<void> loadCategories() async {
    try {
      // Categories are derived from event types in this application
      // Group event types by their category property
      Map<String, EventCategory> categoryMap = {};
      
      for (var eventType in _eventTypes) {
        if (eventType.categoryId != null && eventType.categoryId!.isNotEmpty) {
          // Use the event type's icon for the category if available
          final categoryId = eventType.categoryId!;
          
          if (!categoryMap.containsKey(categoryId)) {
            // Use name as the display name for the category
            final categoryName = eventType.name;
            
            categoryMap[categoryId] = EventCategory(
              id: categoryId,
              name: categoryName,
              icon: eventType.icon ?? _getCategoryIcon(categoryId),
              description: eventType.description ?? 'Events related to ${eventType.name}',
            );
          }
        }
      }
      
      _categories = categoryMap.values.toList();
      notifyListeners();
    } catch (e) {
      _error = 'Failed to load categories: $e';
      notifyListeners();
    }
  }
  
  // Get appropriate icon for category
  String _getCategoryIcon(String categoryId) {
    final iconMap = {
      'wedding': '💍',
      'corporate': '🏢',
      'birthday': '🎂',
      'graduation': '🎓',
      'baby-shower': '👶',
      'cultural': '🎭',
    };
    
    return iconMap[categoryId] ?? '📅'; // Default icon
  }

  // Load event types from the server
  Future<void> loadEventTypes(AuthService authService) async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();

      // Use the ApiService to handle cookie management consistently
      final response = await authService.apiService.get(ApiConfig.eventTypesEndpoint);

      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body);
        _eventTypes = data.map((item) => EventType.fromJson(item)).toList();
        _isLoading = false;
        
        // Now load categories based on event types
        await loadCategories();
        
        notifyListeners();
      } else if (response.statusCode == 401) {
        // Authentication error - let the user know they need to log in
        _error = 'Please log in to view event types';
        _isLoading = false;
        notifyListeners();
        
        // If this is an auth error, attempt to clear session and redirect to login
        if (authService.isLoggedIn) {
          print('Authentication error - clearing session');
          await authService.logout();
        }
      } else {
        _error = 'Failed to load event types: ${response.statusCode}';
        _isLoading = false;
        notifyListeners();
      }
    } catch (e) {
      _error = 'Failed to load event types: $e';
      _isLoading = false;
      notifyListeners();
    }
  }

  // Get questions for a specific event type
  Future<List<QuestionnaireItem>> getQuestionsForEventType(
    int eventTypeId,
    AuthService authService,
  ) async {
    try {
      final response = await authService.apiService.get(
        '${ApiConfig.baseUrl}/api/event-types/$eventTypeId/questionnaire-items'
      );

      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body);
        return data.map((item) => QuestionnaireItem.fromJson(item)).toList();
      } else {
        throw Exception('Failed to load questions: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Failed to load questions: $e');
    }
  }

  // Removed submitEventRequest method - now using BookingService for unified event management

  // Removed all old EventRequest and Quotation methods - now using BookingService for unified event management
}