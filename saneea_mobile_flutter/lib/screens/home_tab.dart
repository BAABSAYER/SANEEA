import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:saneea_mobile_flutter/screens/event_selection_screen.dart';
import 'package:saneea_mobile_flutter/services/auth_service.dart';
import 'package:saneea_mobile_flutter/services/booking_service.dart';
import 'package:saneea_mobile_flutter/l10n/language_provider.dart';
import 'package:saneea_mobile_flutter/providers/event_provider.dart';
import 'package:saneea_mobile_flutter/models/booking.dart';
import 'package:saneea_mobile_flutter/models/event_category.dart';

class HomeTab extends StatefulWidget {
  const HomeTab({super.key});

  @override
  State<HomeTab> createState() => _HomeTabState();
}

class _HomeTabState extends State<HomeTab> {
  @override
  void initState() {
    super.initState();
    // Load bookings when the home tab is created
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final authService = Provider.of<AuthService>(context, listen: false);
      final bookingService = Provider.of<BookingService>(context, listen: false);
      
      // Load bookings
      bookingService.loadBookings(authService);
    });
  }

  @override
  Widget build(BuildContext context) {
    final languageProvider = Provider.of<LanguageProvider>(context);
    bool isArabic = languageProvider.locale.languageCode == 'ar';
    final authService = Provider.of<AuthService>(context);
    final bookingService = Provider.of<BookingService>(context);
    final eventProvider = Provider.of<EventProvider>(context);
    final user = authService.user;
    
    return Center(
      child: Column(
        children: [
          const SizedBox(height: 24),
          Text(
            isArabic ? 'مرحبًا، ${user?.name ?? ''}!' : 'Welcome, ${user?.name ?? ''}!',
            style: const TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 16),
          Text(
            isArabic 
              ? 'ماذا تخطط اليوم؟'
              : 'What are you planning today?',
            style: const TextStyle(
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 24),
          
          // New Event Request button
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0),
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF6A3DE8),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => const EventSelectionScreen(),
                  ),
                );
              },
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.celebration, size: 24),
                  const SizedBox(width: 10),
                  Text(
                    isArabic ? 'طلب تنظيم حدث جديد' : 'Plan a New Event',
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
          ),
          
          const SizedBox(height: 24),
          
          // Categories section
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  isArabic ? 'الفئات' : 'Categories',
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                TextButton(
                  onPressed: () {
                    Navigator.pushNamed(context, '/categories');
                  },
                  child: Text(
                    isArabic ? 'عرض الكل' : 'View All',
                    style: const TextStyle(
                      color: Color(0xFF6A3DE8),
                    ),
                  ),
                ),
              ],
            ),
          ),
          
          // Category cards - dynamically loaded from API
          SizedBox(
            height: 140,
            child: eventProvider.isLoading
                ? const Center(child: CircularProgressIndicator())
                : eventProvider.categories.isEmpty
                    ? Center(
                        child: Text(
                          isArabic 
                              ? 'لا توجد فئات متاحة'
                              : 'No categories available',
                          style: TextStyle(
                            color: Colors.grey.shade600,
                          ),
                        ),
                      )
                    : ListView.builder(
                        scrollDirection: Axis.horizontal,
                        padding: const EdgeInsets.symmetric(horizontal: 16.0),
                        itemCount: eventProvider.categories.length,
                        itemBuilder: (context, index) {
                          final category = eventProvider.categories[index];
                          return _buildCategoryCard(
                            context,
                            isArabic 
                                ? _getArabicCategoryName(category.name) 
                                : category.name,
                            _getCategoryIcon(category.icon ?? '📅'),
                            onTap: () => _navigateToCategory(category.id),
                          );
                        },
                      ),
          ),
          
          const SizedBox(height: 24),
          
          // Recent bookings section
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  isArabic ? 'الحجوزات الأخيرة' : 'Recent Bookings',
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                TextButton(
                  onPressed: () {
                    // Navigate to the requests tab - using named routes instead of direct state access
                    Navigator.pushNamed(context, '/categories');
                  },
                  child: Text(
                    isArabic ? 'عرض الكل' : 'View All',
                    style: const TextStyle(
                      color: Color(0xFF6A3DE8),
                    ),
                  ),
                ),
              ],
            ),
          ),
          
          // Recent bookings list
          Expanded(
            child: bookingService.isLoading
              ? const Center(child: CircularProgressIndicator())
              : bookingService.bookings.isEmpty
                ? Center(
                    child: Text(
                      isArabic 
                        ? 'لا توجد حجوزات حتى الآن'
                        : 'No bookings yet',
                      style: TextStyle(
                        color: Colors.grey.shade600,
                      ),
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 16.0),
                    itemCount: bookingService.bookings.length > 3 
                      ? 3 
                      : bookingService.bookings.length,
                    itemBuilder: (context, index) {
                      final booking = bookingService.bookings[index];
                      return _buildBookingCard(context, booking, isArabic);
                    },
                  ),
          ),
        ],
      ),
    );
  }

  void _navigateToCategory(String categoryId) {
    // Navigate to event questionnaire for this category
    Navigator.pushNamed(
      context, 
      '/event-questionnaire',
      arguments: categoryId,
    );
  }

  // Get icon data based on string icon name
  IconData _getCategoryIcon(String iconName) {
    final iconMap = {
      '💍': Icons.favorite,
      '🏢': Icons.business,
      '🎂': Icons.cake,
      '🎓': Icons.school,
      '👶': Icons.child_care,
      '🎭': Icons.theater_comedy,
      '📅': Icons.calendar_today,
    };
    
    return iconMap[iconName] ?? Icons.event;
  }
  
  // Get Arabic category name
  String _getArabicCategoryName(String englishName) {
    final nameMap = {
      'Wedding': 'زفاف',
      'Corporate': 'شركات',
      'Birthday': 'أعياد ميلاد',
      'Graduation': 'تخرج',
      'Baby Shower': 'استقبال مولود',
      'Cultural': 'ثقافي',
    };
    
    return nameMap[englishName] ?? englishName;
  }

  Widget _buildCategoryCard(
    BuildContext context,
    String title,
    IconData icon, {
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 120,
        margin: const EdgeInsets.only(right: 16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.1),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: const Color(0xFF6A3DE8).withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(
                icon,
                color: const Color(0xFF6A3DE8),
                size: 28,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              title,
              style: const TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 14,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBookingCard(BuildContext context, Booking booking, bool isArabic) {
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
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  booking.eventType ?? 'Unknown Event',
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
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
          ],
        ),
      ),
    );
  }
}