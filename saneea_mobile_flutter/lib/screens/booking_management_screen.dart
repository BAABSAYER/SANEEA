import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:saneea_mobile_flutter/services/auth_service.dart';
import 'package:saneea_mobile_flutter/services/booking_service.dart';
import 'package:saneea_mobile_flutter/l10n/language_provider.dart';
import 'package:saneea_mobile_flutter/models/booking.dart';

class BookingManagementScreen extends StatefulWidget {
  final Booking booking;
  
  const BookingManagementScreen({
    super.key,
    required this.booking,
  });

  @override
  State<BookingManagementScreen> createState() => _BookingManagementScreenState();
}

class _BookingManagementScreenState extends State<BookingManagementScreen> {
  bool _isUpdating = false;
  
  Future<void> _updateStatus(String status) async {
    setState(() {
      _isUpdating = true;
    });
    
    try {
      final authService = Provider.of<AuthService>(context, listen: false);
      final bookingService = Provider.of<BookingService>(context, listen: false);
      
      final success = await bookingService.updateBookingStatus(
        widget.booking.id,
        status,
      );
      
      if (mounted) {
        if (success) {
          Navigator.pop(context);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                Provider.of<LanguageProvider>(context, listen: false)
                           .locale.languageCode == 'ar'
                    ? 'تم تحديث حالة الحجز بنجاح'
                    : 'Booking status updated successfully',
              ),
              backgroundColor: Colors.green,
            ),
          );
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                bookingService.error ?? 'Failed to update booking status',
              ),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: ${e.toString()}'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isUpdating = false;
        });
      }
    }
  }
  
  @override
  Widget build(BuildContext context) {
    final languageProvider = Provider.of<LanguageProvider>(context);
    final authService = Provider.of<AuthService>(context);
    final bool isArabic = languageProvider.locale.languageCode == 'ar';
    final bool isVendor = authService.user?.userType == 'vendor';
    
    // Translate status
    String statusText = widget.booking.status;
    if (isArabic) {
      switch (widget.booking.status) {
        case 'pending':
          statusText = 'قيد الانتظار';
          break;
        case 'confirmed':
          statusText = 'مؤكد';
          break;
        case 'completed':
          statusText = 'مكتمل';
          break;
        case 'cancelled':
          statusText = 'ملغى';
          break;
      }
    }
    
    // Status color
    Color statusColor;
    switch (widget.booking.status) {
      case 'confirmed':
        statusColor = Colors.green;
        break;
      case 'pending':
        statusColor = Colors.orange;
        break;
      case 'cancelled':
        statusColor = Colors.red;
        break;
      case 'completed':
        statusColor = Colors.blue;
        break;
      default:
        statusColor = Colors.grey;
    }
    
    return Scaffold(
      appBar: AppBar(
        title: Text(
          isArabic ? 'تفاصيل الحجز' : 'Booking Details',
          style: const TextStyle(color: Colors.white),
        ),
        backgroundColor: const Color(0xFF6A3DE8),
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Status card
            Card(
              elevation: 2,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Row(
                  children: [
                    Container(
                      width: 64,
                      height: 64,
                      decoration: BoxDecoration(
                        color: statusColor.withValues(alpha: 0.1),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        _getStatusIcon(widget.booking.status),
                        color: statusColor,
                        size: 32,
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            isArabic ? 'حالة الحجز' : 'Booking Status',
                            style: TextStyle(
                              color: Colors.grey.shade600,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            statusText,
                            style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                              color: statusColor,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),
            
            // Booking info card
            Card(
              elevation: 2,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      isArabic ? 'معلومات الحجز' : 'Booking Information',
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 16),
                    
                    // Booking ID
                    _buildInfoRow(
                      isArabic ? 'رقم الحجز' : 'Booking ID',
                      '#${widget.booking.id}',
                    ),
                    const Divider(height: 24),
                    
                    // Event type
                    _buildInfoRow(
                      isArabic ? 'نوع المناسبة' : 'Event Type',
                      widget.booking.eventType,
                    ),
                    const Divider(height: 24),
                    
                    // Event date
                    _buildInfoRow(
                      isArabic ? 'تاريخ المناسبة' : 'Event Date',
                      '${widget.booking.eventDate.day}/${widget.booking.eventDate.month}/${widget.booking.eventDate.year}',
                    ),
                    const Divider(height: 24),
                    
                    // Package type
                    _buildInfoRow(
                      isArabic ? 'نوع الباقة' : 'Package Type',
                      widget.booking.packageType,
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),
            
            // Client/Vendor info card
            Card(
              elevation: 2,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      isVendor
                          ? isArabic ? 'معلومات العميل' : 'Client Information'
                          : isArabic ? 'معلومات مزود الخدمة' : 'Vendor Information',
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 16),
                    
                    // Name
                    _buildInfoRow(
                      isArabic ? 'الاسم' : 'Name',
                      isVendor
                          ? widget.booking.clientName ?? 'Unknown Client'
                          : widget.booking.vendorName ?? 'Unknown Vendor',
                    ),
                    
                    // Show additional vendors if client view
                    if (!isVendor && widget.booking.additionalVendorNames != null &&
                        widget.booking.additionalVendorNames!.isNotEmpty) ...[
                      const Divider(height: 24),
                      
                      Text(
                        isArabic ? 'مزودو الخدمة الإضافيون' : 'Additional Vendors',
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 8),
                      
                      ...widget.booking.additionalVendorNames!.map((name) {
                        return Padding(
                          padding: const EdgeInsets.only(left: 16, bottom: 4),
                          child: Row(
                            children: [
                              const Icon(
                                Icons.check_circle,
                                size: 16,
                                color: Color(0xFF6A3DE8),
                              ),
                              const SizedBox(width: 8),
                              Text(name),
                            ],
                          ),
                        );
                      }).toList(),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),
            
            // Price card
            Card(
              elevation: 2,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      isArabic ? 'تفاصيل السعر' : 'Price Details',
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 16),
                    
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          isArabic ? 'المبلغ الإجمالي' : 'Total Amount',
                          style: const TextStyle(
                            fontSize: 16,
                          ),
                        ),
                        Text(
                          '\$${widget.booking.totalPrice.toStringAsFixed(2)}',
                          style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF6A3DE8),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),
            
            // Notes card
            if (widget.booking.notes != null && widget.booking.notes!.isNotEmpty)
              Card(
                elevation: 2,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        isArabic ? 'ملاحظات' : 'Notes',
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        widget.booking.notes!,
                        style: TextStyle(
                          color: Colors.grey.shade700,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            const SizedBox(height: 32),
            
            // Action buttons for vendors
            if (isVendor && widget.booking.status == 'pending') ...[
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton(
                      onPressed: _isUpdating ? null : () => _updateStatus('confirmed'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.green,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                      ),
                      child: _isUpdating
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : Text(
                              isArabic ? 'قبول' : 'Accept',
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: _isUpdating ? null : () => _updateStatus('cancelled'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.red,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                      ),
                      child: Text(
                        isArabic ? 'رفض' : 'Decline',
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
            
            // Mark as completed button for vendors
            if (isVendor && widget.booking.status == 'confirmed') ...[
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _isUpdating ? null : () => _updateStatus('completed'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.blue,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  child: _isUpdating
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : Text(
                          isArabic ? 'تحديث كمكتمل' : 'Mark as Completed',
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                ),
              ),
            ],
            
            // Cancel button for clients
            if (!isVendor && widget.booking.status == 'pending') ...[
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _isUpdating ? null : () => _updateStatus('cancelled'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.red,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  child: _isUpdating
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : Text(
                          isArabic ? 'إلغاء الحجز' : 'Cancel Booking',
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
  
  Widget _buildInfoRow(String label, String value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          flex: 2,
          child: Text(
            label,
            style: TextStyle(
              color: Colors.grey.shade600,
            ),
          ),
        ),
        Expanded(
          flex: 3,
          child: Text(
            value,
            style: const TextStyle(
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
      ],
    );
  }
  
  IconData _getStatusIcon(String status) {
    switch (status) {
      case 'confirmed':
        return Icons.check_circle;
      case 'pending':
        return Icons.access_time;
      case 'cancelled':
        return Icons.cancel;
      case 'completed':
        return Icons.done_all;
      default:
        return Icons.help;
    }
  }
}
