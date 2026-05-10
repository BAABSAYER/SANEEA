import 'dart:convert';

class Booking {
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
  final Map<String, dynamic>? quotationDetails;
  final String? quotationNotes;
  final DateTime? quotationValidUntil;
  final List<int> additionalVendorIds; // For multiple vendors
  final List<String>? additionalVendorNames; // Names of additional vendors
  
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
    this.quotationDetails,
    this.quotationNotes,
    this.quotationValidUntil,
    this.additionalVendorIds = const [],
    this.additionalVendorNames,
  });
  
  factory Booking.fromJson(Map<String, dynamic> json) {
    // Handle the additionalVendorIds which might be a string or a list
    List<int> additionalIds = [];
    if (json['additionalVendorIds'] != null) {
      if (json['additionalVendorIds'] is String) {
        try {
          final List<dynamic> decoded = jsonDecode(json['additionalVendorIds']);
          additionalIds = decoded.map((id) => id as int).toList();
        } catch (e) {
          // If parsing fails, leave as empty list
        }
      } else if (json['additionalVendorIds'] is List) {
        additionalIds = List<int>.from(json['additionalVendorIds']);
      }
    }
    
    // Handle the additionalVendorNames which might be a string or a list
    List<String>? additionalNames;
    if (json['additionalVendorNames'] != null) {
      if (json['additionalVendorNames'] is String) {
        try {
          final List<dynamic> decoded = jsonDecode(json['additionalVendorNames']);
          additionalNames = decoded.map((name) => name as String).toList();
        } catch (e) {
          // If parsing fails, leave as null
        }
      } else if (json['additionalVendorNames'] is List) {
        additionalNames = List<String>.from(json['additionalVendorNames']);
      }
    }
    
    return Booking(
      id: json['id'] as int? ?? 0,
      clientId: json['clientId'] as int? ?? 0,
      vendorId: json['vendorId'] as int? ?? 0,
      vendorName: json['vendorName'] as String? ?? 'Saneea',
      clientName: json['clientName'] as String? ?? '',
      eventDate: json['eventDate'] is String
          ? DateTime.parse(json['eventDate'])
          : DateTime.fromMillisecondsSinceEpoch(json['eventDate']),
      eventType: json['eventType'] as String? ?? json['eventTypeName'] as String? ?? 'Event',
      packageType: json['packageType'] as String? ?? 'Standard',
      totalPrice: json['totalPrice'] is int
          ? (json['totalPrice'] as int).toDouble()
          : (json['totalPrice'] as double? ?? 0.0),
      status: json['status'] as String? ?? 'pending',
      notes: json['notes'] as String? ?? '',
      quotationDetails: json['quotationDetails'] as Map<String, dynamic>?,
      quotationNotes: json['quotationNotes'] as String?,
      quotationValidUntil: json['quotationValidUntil'] != null 
          ? DateTime.tryParse(json['quotationValidUntil'])
          : null,
      additionalVendorIds: additionalIds,
      additionalVendorNames: additionalNames,
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
      'quotationDetails': quotationDetails,
      'quotationNotes': quotationNotes,
      'quotationValidUntil': quotationValidUntil?.toIso8601String(),
      'additionalVendorIds': additionalVendorIds,
      'additionalVendorNames': additionalVendorNames,
    };
  }
  
  // Copy with method to create a new booking with some updated fields
  Booking copyWith({
    int? id,
    int? clientId,
    int? vendorId,
    String? vendorName,
    String? clientName,
    DateTime? eventDate,
    String? eventType,
    String? packageType,
    double? totalPrice,
    String? status,
    String? notes,
    List<int>? additionalVendorIds,
    List<String>? additionalVendorNames,
  }) {
    return Booking(
      id: id ?? this.id,
      clientId: clientId ?? this.clientId,
      vendorId: vendorId ?? this.vendorId,
      vendorName: vendorName ?? this.vendorName,
      clientName: clientName ?? this.clientName,
      eventDate: eventDate ?? this.eventDate,
      eventType: eventType ?? this.eventType,
      packageType: packageType ?? this.packageType,
      totalPrice: totalPrice ?? this.totalPrice,
      status: status ?? this.status,
      notes: notes ?? this.notes,
      additionalVendorIds: additionalVendorIds ?? this.additionalVendorIds,
      additionalVendorNames: additionalVendorNames ?? this.additionalVendorNames,
    );
  }

  // Quotation helper methods
  bool get hasQuotation => quotationDetails != null || quotationNotes != null;
  bool get isQuotationValid => quotationValidUntil == null || quotationValidUntil!.isAfter(DateTime.now());
  String get quotationStatusText {
    if (!hasQuotation) return 'No quotation';
    if (!isQuotationValid) return 'Quotation expired';
    return 'Quotation available';
  }
}