import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import '../config/api_config.dart';
import '../models/booking.dart';
import 'auth_service.dart';

class BookingService extends ChangeNotifier {
  final AuthService _authService;
  List<Booking> _bookings = [];
  bool _isLoading = false;
  String? _error;
  bool _disposed = false;

  BookingService(this._authService);

  List<Booking> get bookings => _bookings;
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
    super.dispose();
  }

  // Alias method for compatibility with existing screens
  Future<void> loadBookings(AuthService authService) async {
    await loadUserBookings();
  }

  Future<void> loadUserBookings() async {
    if (_disposed) return;
    
    try {
      print('Loading user bookings...');
      if (!_authService.isLoggedIn || _authService.user == null) {
        throw Exception('User not authenticated');
      }

      final user = _authService.user!;
      final url = '${ApiConfig.baseUrl}/api/bookings/client/${user.id}';
      print('Making request to: $url');

      final response = await _authService.apiService.get(url);

      print('Bookings response status: ${response.statusCode}');
      print('Bookings response body: ${response.body}');

      if (response.statusCode == 200) {
        final responseBody = response.body.trim();
        if (responseBody.isEmpty || responseBody == '[]') {
          _bookings = [];
        } else {
          // Check if response is HTML (error page)
          if (responseBody.startsWith('<!DOCTYPE html>')) {
            throw Exception('Received HTML response instead of JSON');
          }
          
          try {
            final List<dynamic> bookingsJson = json.decode(responseBody);
            _bookings = bookingsJson.map((data) {
              try {
                return Booking.fromJson(data);
              } catch (e) {
                print('Error parsing booking item: $e');
                print('Data: $data');
                // Create fallback booking with safe defaults
                return Booking(
                  id: data['id'] as int? ?? 0,
                  clientId: data['clientId'] as int? ?? 0,
                  vendorId: data['vendorId'] as int? ?? 0,
                  vendorName: data['vendorName'] as String? ?? 'Saneea',
                  clientName: data['clientName'] as String? ?? '',
                  eventDate: data['eventDate'] != null 
                      ? DateTime.tryParse(data['eventDate']) ?? DateTime.now()
                      : DateTime.now(),
                  eventType: data['eventType'] as String? ?? data['eventTypeName'] as String? ?? 'Event',
                  packageType: data['packageType'] as String? ?? 'Standard',
                  totalPrice: (data['totalPrice'] as num?)?.toDouble() ?? 0.0,
                  status: data['status'] as String? ?? 'pending',
                  notes: data['notes'] as String? ?? '',
                );
              }
            }).toList();
            
            // Sort by creation date (newest first)
            _bookings.sort((a, b) => b.eventDate.compareTo(a.eventDate));
          } catch (e) {
            print('JSON decode error for bookings: $e');
            throw Exception('Invalid JSON response');
          }
        }
      } else if (response.statusCode == 404) {
        // No bookings found - this is normal for new users
        _bookings = [];
      } else {
        throw Exception('HTTP ${response.statusCode}: ${response.body}');
      }
    } catch (e) {
      _error = e.toString();
      print('Error loading bookings: $e');
    } finally {
      if (!_disposed) {
        _isLoading = false;
        WidgetsBinding.instance.addPostFrameCallback((_) => _safeNotifyListeners());
      }
    }
  }

  Future<bool> submitBooking({
    required int eventTypeId,
    required String eventDate,
    required String eventTime,
    required String location,
    required int guestCount,
    required Map<String, dynamic> questionnaireResponses,
    String? specialRequests,
  }) async {
    if (_disposed) return false;
    
    try {
      print('Submitting booking...');
      if (!_authService.isLoggedIn || _authService.user == null) {
        throw Exception('User not authenticated');
      }

      final user = _authService.user!;
      final bookingData = {
        'clientId': user.id,
        'eventTypeId': eventTypeId,
        'eventDate': eventDate,
        'eventTime': eventTime,
        'location': location,
        'guestCount': guestCount,
        'questionnaireResponses': json.encode(questionnaireResponses),
        'specialRequests': specialRequests,
        'status': 'pending',
      };

      final url = '${ApiConfig.baseUrl}/api/bookings';
      print('Submitting to: $url');
      print('Booking data: $bookingData');

      final response = await _authService.apiService.post(url, bookingData);

      print('Submit booking response status: ${response.statusCode}');
      print('Submit booking response body: ${response.body}');

      if (response.statusCode == 200 || response.statusCode == 201) {
        // Refresh bookings list
        await loadUserBookings();
        return true;
      } else {
        // Check if response is HTML (error page)
        if (response.body.startsWith('<!DOCTYPE html>')) {
          throw Exception('Server returned error page');
        }
        
        _error = 'Failed to submit booking: ${response.statusCode} - ${response.body}';
        WidgetsBinding.instance.addPostFrameCallback((_) => _safeNotifyListeners());
        return false;
      }
    } catch (e) {
      _error = e.toString();
      print('Error submitting booking: $e');
      WidgetsBinding.instance.addPostFrameCallback((_) => _safeNotifyListeners());
      return false;
    }
  }

  void clearError() {
    if (_disposed) return;
    _error = null;
    WidgetsBinding.instance.addPostFrameCallback((_) => _safeNotifyListeners());
  }

  // Method to refresh bookings after submission
  Future<void> refreshBookings() async {
    if (_disposed) return;
    _isLoading = true;
    WidgetsBinding.instance.addPostFrameCallback((_) => _safeNotifyListeners());
    await loadUserBookings();
  }

  // Initialize by loading user bookings
  Future<void> initialize() async {
    if (_disposed) return;
    _isLoading = true;
    WidgetsBinding.instance.addPostFrameCallback((_) => _safeNotifyListeners());
    await loadUserBookings();
  }

  // Alias method for compatibility with existing screens  
  Future<bool> createBooking(Map<String, dynamic> bookingData, AuthService authService) async {
    return await submitBooking(
      eventTypeId: bookingData['eventTypeId'] ?? 1,
      eventDate: bookingData['eventDate'] ?? DateTime.now().add(Duration(days: 7)).toIso8601String(),
      eventTime: bookingData['eventTime'] ?? '18:00:00',
      location: bookingData['location']?.toString() ?? '',
      guestCount: bookingData['guestCount'] ?? bookingData['estimatedGuests'] ?? 0,
      questionnaireResponses: bookingData['questionnaireResponses'] ?? {},
      specialRequests: bookingData['specialRequests']?.toString() ?? '',
    );
  }

  // Method to update booking status
  Future<bool> updateBookingStatus(int bookingId, String status) async {
    if (_disposed) return false;
    
    try {
      if (!_authService.isLoggedIn || _authService.user == null) {
        throw Exception('User not authenticated');
      }

      final url = '${ApiConfig.baseUrl}/api/bookings/$bookingId';
      final updateData = {'status': status};
      
      print('Updating booking status to: $status');
      print('URL: $url');

      final response = await _authService.apiService.put(url, updateData);

      print('Update booking response status: ${response.statusCode}');
      print('Update booking response body: ${response.body}');

      if (response.statusCode == 200) {
        // Refresh bookings list
        await loadUserBookings();
        return true;
      } else {
        _error = 'Failed to update booking status: ${response.statusCode}';
        WidgetsBinding.instance.addPostFrameCallback((_) => _safeNotifyListeners());
        return false;
      }
    } catch (e) {
      _error = e.toString();
      print('Error updating booking status: $e');
      WidgetsBinding.instance.addPostFrameCallback((_) => _safeNotifyListeners());
      return false;
    }
  }
}