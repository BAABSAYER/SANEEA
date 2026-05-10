import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:saneea_mobile_flutter/services/auth_service.dart';
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';
import '../config/api_config.dart';
import 'package:saneea_mobile_flutter/models/booking.dart';

// Using the Booking model from models/booking.dart instead of redefining it here
/* Commented out to avoid conflict
class BookingOld {
  final int id;
  final int clientId;
  final int vendorId;
  final String? vendorName;
  final String? clientName;
  final DateTime eventDate;
  final String eventType;
  final String packageType;
  final double totalPrice;
  final String status;
  final String? notes;
  final List<int> additionalVendorIds; // New: For multiple vendors
  final List<String>? additionalVendorNames; // New: Names of additional vendors
  
  Booking({
    required this.id,
    required this.clientId,
    required this.vendorId,
    this.vendorName,
    this.clientName,
    required this.eventDate,
    required this.eventType,
    required this.packageType,
    required this.totalPrice,
    required this.status,
    this.notes,
    this.additionalVendorIds = const [],
    this.additionalVendorNames,
  });
  
  factory Booking.fromJson(Map<String, dynamic> json) {
    return Booking(
      id: json['id'],
      clientId: json['clientId'],
      vendorId: json['vendorId'],
      vendorName: json['vendorName'],
      clientName: json['clientName'],
      eventDate: DateTime.parse(json['eventDate']),
      eventType: json['eventType'],
      packageType: json['packageType'],
      totalPrice: json['totalPrice'].toDouble(),
      status: json['status'],
      notes: json['notes'],
      additionalVendorIds: json['additionalVendorIds'] != null
        ? (json['additionalVendorIds'] is List 
            ? List<int>.from(json['additionalVendorIds'])
            : List<int>.from(jsonDecode(json['additionalVendorIds'].toString())))
        : [],
      additionalVendorNames: json['additionalVendorNames'] != null
        ? (json['additionalVendorNames'] is List
            ? List<String>.from(json['additionalVendorNames'])
            : List<String>.from(jsonDecode(json['additionalVendorNames'].toString())))
        : null,
    );
  }
  
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'clientId': clientId,
      'vendorId': vendorId,
      'vendorName': vendorName,
      'clientName': clientName,
      'eventDate': eventDate.toIso8601String(),
      'eventType': eventType,
      'packageType': packageType,
      'totalPrice': totalPrice,
      'status': status,
      'notes': notes,
      'additionalVendorIds': jsonEncode(additionalVendorIds),
      'additionalVendorNames': additionalVendorNames != null ? jsonEncode(additionalVendorNames) : null,
    };
  }
}
*/

class BookingService extends ChangeNotifier {
  List<Booking> _bookings = [];
  bool _isLoading = false;
  String? _error;
  Database? _database;
  
  List<Booking> get bookings => _bookings;
  bool get isLoading => _isLoading;
  String? get error => _error;
  
  BookingService() {
    _initDatabase();
  }
  
  Future<void> _initDatabase() async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, 'bookings.db');
    
    _database = await openDatabase(
      path,
      version: 1,
      onCreate: (db, version) async {
        await db.execute('''
        CREATE TABLE bookings(
          id INTEGER PRIMARY KEY,
          clientId INTEGER,
          vendorId INTEGER,
          vendorName TEXT,
          clientName TEXT,
          eventDate TEXT,
          eventType TEXT,
          packageType TEXT,
          totalPrice REAL,
          status TEXT,
          notes TEXT,
          additionalVendorIds TEXT,
          additionalVendorNames TEXT
        )
        ''');
      },
    );
  }
  
  Future<void> loadBookings(AuthService authService) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    
    // Load from API
    final user = authService.user;
    final token = authService.token;
    
    if (user == null || token == null) {
      _error = 'User not authenticated';
      _isLoading = false;
      notifyListeners();
      return;
    }
    
    try {
      // Use correct endpoint from server routes.ts
      final endpoint = '${ApiConfig.apiUrl}/bookings/client/${user.id}';
      
      print('Fetching bookings from endpoint: $endpoint');
      
      // Use session-based authentication instead of token
      final response = await authService.apiService.get(endpoint);
      
      print('Response status: ${response.statusCode}');
      
      if (response.statusCode == 200) {
        print('Received booking data: ${response.body}');
        final List<dynamic> data = json.decode(response.body);
        _bookings = data.map((item) => Booking.fromJson(item)).toList();
        
        _isLoading = false;
        notifyListeners();
      } else {
        _error = 'Failed to load bookings: ${response.statusCode} - ${response.body}';
        _isLoading = false;
        notifyListeners();
      }
    } catch (e) {
      _error = 'Network error: ${e.toString()}';
      _isLoading = false;
      notifyListeners();
    }
  }
  
  // Database methods to save bookings locally for caching
  Future<void> _saveBookingsLocally(List<Booking> bookings) async {
    if (_database == null) {
      await _initDatabase();
    }
    
    // Clear existing bookings
    await _database!.delete('bookings');
    
    // Insert new bookings
    for (var booking in bookings) {
      await _database!.insert(
        'bookings',
        booking.toJson(),
      );
    }
  }
  
  Future<bool> createBooking(Booking booking, AuthService authService) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    
    final user = authService.user;
    final token = authService.token;
    
    if (user == null || token == null) {
      _error = 'User not authenticated';
      _isLoading = false;
      notifyListeners();
      return false;
    }
    
    try {
      print('Creating booking via API: ${ApiConfig.bookingsEndpoint}');
      print('Booking data: ${json.encode(booking.toJson())}');
      
      final response = await http.post(
        Uri.parse(ApiConfig.bookingsEndpoint),
        headers: ApiConfig.authHeaders(token),
        body: json.encode(booking.toJson()),
      ).timeout(const Duration(seconds: 10));
      
      print('Create booking response: ${response.statusCode} - ${response.body}');
      
      if (response.statusCode == 201) {
        final createdBooking = Booking.fromJson(json.decode(response.body));
        _bookings.add(createdBooking);
        
        // Save to local database for caching
        await _saveBookingLocally(createdBooking);
        
        _isLoading = false;
        notifyListeners();
        return true;
      } else {
        _error = json.decode(response.body)['message'] ?? 'Failed to create booking';
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
  
  Future<void> _saveBookingLocally(Booking booking) async {
    if (_database == null) {
      await _initDatabase();
    }
    
    await _database!.insert(
      'bookings',
      booking.toJson(),
    );
  }
  
  Future<bool> updateBookingStatus(int bookingId, String status, AuthService authService) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    
    final user = authService.user;
    final token = authService.token;
    
    if (user == null || token == null) {
      _error = 'User not authenticated';
      _isLoading = false;
      notifyListeners();
      return false;
    }
    
    try {
      print('Updating booking status via API: ${ApiConfig.bookingsEndpoint}/$bookingId/status');
      print('Status data: ${json.encode({'status': status})}');
      
      final response = await http.put(
        Uri.parse('${ApiConfig.bookingsEndpoint}/$bookingId/status'),
        headers: ApiConfig.authHeaders(token),
        body: json.encode({'status': status}),
      ).timeout(const Duration(seconds: 10));
      
      print('Update booking status response: ${response.statusCode} - ${response.body}');
      
      if (response.statusCode == 200) {
        // Update the booking in the list
        final index = _bookings.indexWhere((b) => b.id == bookingId);
        if (index != -1) {
          final updatedBooking = Booking(
            id: _bookings[index].id,
            clientId: _bookings[index].clientId,
            vendorId: _bookings[index].vendorId,
            vendorName: _bookings[index].vendorName,
            clientName: _bookings[index].clientName,
            eventDate: _bookings[index].eventDate,
            eventType: _bookings[index].eventType,
            packageType: _bookings[index].packageType,
            totalPrice: _bookings[index].totalPrice,
            status: status,
            notes: _bookings[index].notes,
            additionalVendorIds: _bookings[index].additionalVendorIds,
            additionalVendorNames: _bookings[index].additionalVendorNames,
          );
          
          _bookings[index] = updatedBooking;
          
          // Update in local database for caching
          await _updateBookingLocally(updatedBooking);
        }
        
        _isLoading = false;
        notifyListeners();
        return true;
      } else {
        _error = json.decode(response.body)['message'] ?? 'Failed to update booking status';
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
  
  Future<void> _updateBookingLocally(Booking booking) async {
    if (_database == null) {
      await _initDatabase();
    }
    
    await _database!.update(
      'bookings',
      booking.toJson(),
      where: 'id = ?',
      whereArgs: [booking.id],
    );
  }
}
