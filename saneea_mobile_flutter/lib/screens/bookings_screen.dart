import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:saneea_mobile_flutter/services/auth_service.dart';
import 'package:saneea_mobile_flutter/services/booking_service.dart';
import 'package:saneea_mobile_flutter/l10n/language_provider.dart';
import 'package:saneea_mobile_flutter/screens/booking_management_screen.dart';
import 'package:saneea_mobile_flutter/models/booking.dart';

class BookingsScreen extends StatefulWidget {
  const BookingsScreen({super.key});

  @override
  State<BookingsScreen> createState() => _BookingsScreenState();
}

class _BookingsScreenState extends State<BookingsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  bool _isLoading = true;
  
  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    _loadBookings();
  }
  
  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }
  
  Future<void> _loadBookings() async {
    final authService = Provider.of<AuthService>(context, listen: false);
    final bookingService = Provider.of<BookingService>(context, listen: false);
    
    await bookingService.loadBookings(authService);
    
    if (mounted) {
      setState(() {
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final languageProvider = Provider.of<LanguageProvider>(context);
    final bookingService = Provider.of<BookingService>(context);
    final authService = Provider.of<AuthService>(context);
    final bool isArabic = languageProvider.locale.languageCode == 'ar';
    final bool isVendor = authService.user?.userType == 'vendor';
    
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }
    
    if (bookingService.bookings.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.calendar_today_outlined,
              size: 64,
              color: Colors.grey.shade400,
            ),
            const SizedBox(height: 16),
            Text(
              isArabic ? 'لا توجد حجوزات' : 'No bookings yet',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Colors.grey.shade600,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              isVendor
                  ? (isArabic 
                      ? 'ستظهر الحجوزات الجديدة هنا عندما يحجز العملاء خدماتك'
                      : 'New bookings will appear here when clients book your services')
                  : (isArabic 
                      ? 'ابدأ باستكشاف الفئات وحجز مناسبتك القادمة'
                      : 'Start exploring categories and book your next event'),
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.grey.shade600,
              ),
            ),
            const SizedBox(height: 24),
            if (!isVendor)
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF6A3DE8),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                onPressed: () {
                  Navigator.pushNamed(context, '/categories');
                },
                child: Text(
                  isArabic ? 'استكشاف الفئات' : 'Explore Categories'
                ),
              ),
          ],
        ),
      );
    }

    // Group bookings by status
    final Map<String, List<Booking>> bookingsByStatus = {
      'pending': [],
      'confirmed': [],
      'completed': [],
      'cancelled': [],
    };

    for (final booking in bookingService.bookings) {
      if (bookingsByStatus.containsKey(booking.status)) {
        bookingsByStatus[booking.status]!.add(booking);
      } else {
        bookingsByStatus['pending']!.add(booking);
      }
    }

    return Column(
      children: [
        TabBar(
          controller: _tabController,
          isScrollable: true,
          tabs: [
            Tab(text: isArabic ? 'قيد الانتظار' : 'Pending'),
            Tab(text: isArabic ? 'مؤكد' : 'Confirmed'),
            Tab(text: isArabic ? 'مكتمل' : 'Completed'),
            Tab(text: isArabic ? 'ملغى' : 'Cancelled'),
          ],
          labelColor: const Color(0xFF6A3DE8),
          unselectedLabelColor: Colors.grey,
          indicatorColor: const Color(0xFF6A3DE8),
        ),
        Expanded(
          child: TabBarView(
            controller: _tabController,
            children: [
              _buildBookingsList(bookingsByStatus['pending']!, isArabic, isVendor),
              _buildBookingsList(bookingsByStatus['confirmed']!, isArabic, isVendor),
              _buildBookingsList(bookingsByStatus['completed']!, isArabic, isVendor),
              _buildBookingsList(bookingsByStatus['cancelled']!, isArabic, isVendor),
            ],
          ),
        ),
      ],
    );
  }
  
  Widget _buildBookingsList(List<Booking> bookings, bool isArabic, bool isVendor) {
    if (bookings.isEmpty) {
      return Center(
        child: Text(
          isArabic ? 'لا توجد حجوزات في هذه الفئة' : 'No bookings in this category',
          style: TextStyle(color: Colors.grey.shade600),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadBookings,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: bookings.length,
        itemBuilder: (context, index) {
          final booking = bookings[index];
          return _buildBookingCard(context, booking, isArabic, isVendor);
        },
      ),
    );
  }
  
  Widget _buildBookingCard(BuildContext context, Booking booking, bool isArabic, bool isVendor) {
    // Determine status color
    Color statusColor;
    switch (booking.status) {
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

    String statusText = booking.status;
    if (isArabic) {
      switch (booking.status) {
        case 'confirmed':
          statusText = 'مؤكد';
          break;
        case 'pending':
          statusText = 'قيد الانتظار';
          break;
        case 'cancelled':
          statusText = 'ملغى';
          break;
        case 'completed':
          statusText = 'مكتمل';
          break;
      }
    }

    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
      ),
      elevation: 2,
      child: InkWell(
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => BookingManagementScreen(booking: booking),
            ),
          ).then((_) => _loadBookings());
        },
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      isVendor 
                          ? booking.clientName ?? 'Unknown Client'
                          : booking.vendorName ?? 'Unknown Vendor',
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: statusColor.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      statusText,
                      style: TextStyle(
                        color: statusColor,
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Icon(
                    Icons.event,
                    size: 16,
                    color: Colors.grey.shade600,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    '${booking.eventDate.day}/${booking.eventDate.month}/${booking.eventDate.year}',
                    style: TextStyle(
                      color: Colors.grey.shade700,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Icon(
                    Icons.category,
                    size: 16,
                    color: Colors.grey.shade600,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    booking.eventType,
                    style: TextStyle(
                      color: Colors.grey.shade700,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Icon(
                    Icons.payments_outlined,
                    size: 16,
                    color: Colors.grey.shade600,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    '\$${booking.totalPrice.toStringAsFixed(2)}',
                    style: TextStyle(
                      color: Colors.grey.shade700,
                    ),
                  ),
                  const Spacer(),
                  Text(
                    booking.packageType,
                    style: const TextStyle(
                      fontWeight: FontWeight.w500,
                      color: Color(0xFF6A3DE8),
                    ),
                  ),
                ],
              ),
              if (booking.additionalVendorNames != null &&
                  booking.additionalVendorNames!.isNotEmpty) ...[
                const SizedBox(height: 12),
                const Divider(height: 1),
                const SizedBox(height: 12),
                Text(
                  isArabic ? 'مزودو الخدمة الإضافيون' : 'Additional Vendors',
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey.shade700,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  booking.additionalVendorNames!.join(', '),
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
