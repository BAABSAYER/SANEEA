import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:saneea_mobile_flutter/screens/messages_screen.dart';
import 'package:saneea_mobile_flutter/screens/chat_screen.dart';
import 'package:saneea_mobile_flutter/screens/event_selection_screen.dart';
import 'package:saneea_mobile_flutter/screens/bookings_screen.dart';
import 'package:saneea_mobile_flutter/services/auth_service.dart';
import 'package:saneea_mobile_flutter/services/booking_service.dart';
import 'package:saneea_mobile_flutter/services/message_service.dart';
import 'package:saneea_mobile_flutter/l10n/language_provider.dart';
import 'package:saneea_mobile_flutter/providers/event_provider.dart';
import 'package:saneea_mobile_flutter/models/booking.dart';
import 'package:saneea_mobile_flutter/models/chat_user.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _selectedIndex = 0;

  @override
  void initState() {
    super.initState();
    // Load data when the home screen is created
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final authService = Provider.of<AuthService>(context, listen: false);
      final bookingService = Provider.of<BookingService>(context, listen: false);
      final messageService = Provider.of<MessageService>(context, listen: false);
      
      // Test API connectivity first
      if (authService.isLoggedIn && authService.user != null) {
        // Connection verified through AuthService
        print('User authenticated: ${authService.user!.email}');
      }
      
      // Load bookings
      await bookingService.loadUserBookings();
      
      // Initialize message service
      await messageService.initialize();
    });
  }

  void _startChatWithAdmin(BuildContext context) async {
    final authService = Provider.of<AuthService>(context, listen: false);
    final languageProvider = Provider.of<LanguageProvider>(context, listen: false);
    bool isArabic = languageProvider.locale.languageCode == 'ar';
    
    try {
      // Get admin user ID (assuming admin has ID 7 based on logs)
      const int adminUserId = 7;
      
      // Create ChatUser object for admin
      final adminUser = ChatUser(
        id: adminUserId,
        name: isArabic ? 'الإدارة' : 'Admin',
        email: 'admin@saneea.local',
        username: 'admin',
        unreadCount: 0,
      );
      
      // Navigate to chat screen
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => ChatScreen(
            userId: adminUser.id,
            userName: adminUser.name,
          ),
        ),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(isArabic ? 'خطأ في فتح المحادثة' : 'Error opening chat'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final languageProvider = Provider.of<LanguageProvider>(context);
    bool isArabic = languageProvider.locale.languageCode == 'ar';
    final authService = Provider.of<AuthService>(context);
    final bookingService = Provider.of<BookingService>(context);
    final user = authService.user;
    
    // Initialize EventProvider
    Provider.of<EventProvider>(context);
    
    final List<Widget> pages = [
      // Home page content with improved UI
      SafeArea(
        child: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.all(20.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
              // Welcome Section with enhanced design
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(28),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Color(0xFF6A3DE8), Color(0xFF8B5CF6), Color(0xFF9C6CFF)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(24),
                  boxShadow: [
                    BoxShadow(
                      color: Color(0xFF6A3DE8).withValues(alpha: 0.3),
                      blurRadius: 20,
                      offset: Offset(0, 10),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: Icon(
                            Icons.celebration,
                            color: Colors.white,
                            size: 28,
                          ),
                        ),
                        SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                isArabic ? 'مرحبًا، ${user?.name ?? 'صديق'}!' : 'Welcome, ${user?.name ?? 'Friend'}!',
                                style: const TextStyle(
                                  fontSize: 24,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                isArabic 
                                  ? 'دعنا نخطط لحدثك المثالي'
                                  : 'Let\'s plan your perfect event',
                                style: const TextStyle(
                                  fontSize: 16,
                                  color: Colors.white70,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    Container(
                      padding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.stars, color: Colors.white, size: 20),
                          SizedBox(width: 8),
                          Text(
                            isArabic 
                              ? 'خدمة عملاء متاحة 24/7'
                              : '24/7 Customer Support Available',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 14,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              
              const SizedBox(height: 32),
              
              // Enhanced Action Buttons Grid
              Row(
                children: [
                  Expanded(
                    child: Container(
                      height: 120,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [Color(0xFF6A3DE8), Color(0xFF8B5CF6)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [
                          BoxShadow(
                            color: Color(0xFF6A3DE8).withValues(alpha: 0.25),
                            blurRadius: 15,
                            offset: Offset(0, 8),
                          ),
                        ],
                      ),
                      child: Material(
                        color: Colors.transparent,
                        child: InkWell(
                          borderRadius: BorderRadius.circular(20),
                          onTap: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (context) => const EventSelectionScreen(),
                              ),
                            );
                          },
                          child: Padding(
                            padding: EdgeInsets.all(16),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Container(
                                  padding: EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    color: Colors.white.withValues(alpha: 0.2),
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: Icon(
                                    Icons.add_circle_outline,
                                    color: Colors.white,
                                    size: 24,
                                  ),
                                ),
                                SizedBox(height: 8),
                                Text(
                                  isArabic ? 'حدث جديد' : 'New Event',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                  ),
                                  textAlign: TextAlign.center,
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                  SizedBox(width: 16),
                  Expanded(
                    child: Container(
                      height: 120,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [Color(0xFFFF6B6B), Color(0xFFFF8E8E)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [
                          BoxShadow(
                            color: Color(0xFFFF6B6B).withValues(alpha: 0.25),
                            blurRadius: 15,
                            offset: Offset(0, 8),
                          ),
                        ],
                      ),
                      child: Material(
                        color: Colors.transparent,
                        child: InkWell(
                          borderRadius: BorderRadius.circular(20),
                          onTap: () {
                            _startChatWithAdmin(context);
                          },
                          child: Padding(
                            padding: EdgeInsets.all(16),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Container(
                                  padding: EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    color: Colors.white.withValues(alpha: 0.2),
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: Icon(
                                    Icons.support_agent,
                                    color: Colors.white,
                                    size: 24,
                                  ),
                                ),
                                SizedBox(height: 8),
                                Text(
                                  isArabic ? 'الدعم' : 'Support',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                  ),
                                  textAlign: TextAlign.center,
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              
              const SizedBox(height: 24),
            
            // Enhanced Categories section
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4.0),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    isArabic ? 'الفئات الشائعة' : 'Popular Categories',
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF2D3748),
                    ),
                  ),
                  Container(
                    padding: EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: Color(0xFF6A3DE8).withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      isArabic ? 'عرض الكل' : 'View All',
                      style: const TextStyle(
                        color: Color(0xFF6A3DE8),
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            
            const SizedBox(height: 16),
            
            // Enhanced Category cards
            SizedBox(
              height: 160,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 20.0),
                children: [
                  _buildEnhancedCategoryCard(
                    context,
                    isArabic ? 'زفاف' : 'Wedding',
                    Icons.favorite,
                    Color(0xFFFFB6C1),
                    Color(0xFFFF69B4),
                    onTap: () => _navigateToCategory('wedding'),
                  ),
                  _buildEnhancedCategoryCard(
                    context,
                    isArabic ? 'شركات' : 'Corporate',
                    Icons.business,
                    Color(0xFF87CEEB),
                    Color(0xFF4682B4),
                    onTap: () => _navigateToCategory('corporate'),
                  ),
                  _buildEnhancedCategoryCard(
                    context,
                    isArabic ? 'أعياد ميلاد' : 'Birthday',
                    Icons.cake,
                    Color(0xFFFFE4B5),
                    Color(0xFFFF8C00),
                    onTap: () => _navigateToCategory('birthday'),
                  ),
                  _buildEnhancedCategoryCard(
                    context,
                    isArabic ? 'مناسبة خاصة' : 'Special',
                    Icons.star,
                    Color(0xFFDDA0DD),
                    Color(0xFF9370DB),
                    onTap: () => Navigator.pushNamed(context, '/custom-event'),
                  ),
                ],
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
                      setState(() {
                        _selectedIndex = 1; // Switch to bookings tab
                      });
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
            SizedBox(
              height: 200,
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
          ),
        ),
      ),
      
      // Event Requests page (replacing Bookings)
      const BookingsScreen(),
      
      // Messages page
      const MessagesScreen(),
      
      // Profile page
      _buildProfilePage(context, authService, languageProvider, isArabic),
    ];

    return Scaffold(
      appBar: AppBar(
        title: Text(
          isArabic ? 'سنيع' : 'Saneea',
          style: TextStyle(
            fontFamily: isArabic ? 'Almarai' : 'Roboto',
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
        ),
        backgroundColor: const Color(0xFF6A3DE8),
        centerTitle: true,
        actions: [
          IconButton(
            icon: Icon(
              isArabic ? Icons.language : Icons.translate,
              color: Colors.white,
            ),
            onPressed: () {
              // Toggle language
              languageProvider.setLocale(
                isArabic ? const Locale('en', '') : const Locale('ar', '')
              );
            },
          ),
        ],
      ),
      body: pages[_selectedIndex],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _selectedIndex,
        onDestinationSelected: (int index) {
          setState(() {
            _selectedIndex = index;
          });
        },
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.home_outlined),
            label: isArabic ? 'الرئيسية' : 'Home',
            selectedIcon: const Icon(Icons.home),
          ),
          NavigationDestination(
            icon: const Icon(Icons.event_note_outlined),
            label: isArabic ? 'الطلبات' : 'Requests',
            selectedIcon: const Icon(Icons.event_note),
          ),
          NavigationDestination(
            icon: const Icon(Icons.chat_outlined),
            label: isArabic ? 'الرسائل' : 'Messages',
            selectedIcon: const Icon(Icons.chat),
          ),
          NavigationDestination(
            icon: const Icon(Icons.person_outline),
            label: isArabic ? 'حسابي' : 'Profile',
            selectedIcon: const Icon(Icons.person),
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

  Widget _buildEnhancedCategoryCard(
    BuildContext context,
    String title,
    IconData icon,
    Color lightColor,
    Color darkColor, {
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 140,
        margin: const EdgeInsets.only(right: 16),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [lightColor, darkColor],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: darkColor.withValues(alpha: 0.3),
              blurRadius: 15,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Padding(
          padding: EdgeInsets.all(20),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                padding: EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(
                  icon,
                  color: Colors.white,
                  size: 32,
                ),
              ),
              SizedBox(height: 12),
              Text(
                title,
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBookingCard(BuildContext context, Booking booking, bool isArabic) {
    // Determine status color and gradient
    List<Color> statusColors;
    switch (booking.status) {
      case 'confirmed':
        statusColors = [Color(0xFF4CAF50), Color(0xFF66BB6A)];
        break;
      case 'pending':
        statusColors = [Color(0xFFFF9800), Color(0xFFFFB74D)];
        break;
      case 'cancelled':
        statusColors = [Color(0xFFF44336), Color(0xFFEF5350)];
        break;
      case 'completed':
        statusColors = [Color(0xFF2196F3), Color(0xFF42A5F5)];
        break;
      default:
        statusColors = [Color(0xFF9E9E9E), Color(0xFFBDBDBD)];
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

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 20,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(20.0),
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
                    color: statusColors[0].withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    statusText,
                    style: TextStyle(
                      color: statusColors[0],
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


  Widget _buildBookingsList(List<Booking> bookings, bool isArabic) {
    if (bookings.isEmpty) {
      return Center(
        child: Text(
          isArabic ? 'لا توجد حجوزات في هذه الفئة' : 'No bookings in this category',
          style: TextStyle(color: Colors.grey.shade600),
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: bookings.length,
      itemBuilder: (context, index) {
        return _buildBookingCard(context, bookings[index], isArabic);
      },
    );
  }

  Widget _buildProfilePage(
    BuildContext context, 
    AuthService authService, 
    LanguageProvider languageProvider,
    bool isArabic,
  ) {
    final user = authService.user;
    
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Profile header
          Row(
            children: [
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  color: const Color(0xFF6A3DE8).withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: Text(
                    user?.name?.isNotEmpty == true 
                      ? user!.name![0].toUpperCase() 
                      : 'U',
                    style: const TextStyle(
                      fontSize: 32,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF6A3DE8),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      user?.name ?? 'User',
                      style: const TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    Text(
                      user?.email ?? '',
                      style: TextStyle(
                        color: Colors.grey.shade700,
                      ),
                    ),
                    Text(
                      isArabic
                        ? user?.userType == 'vendor' ? 'مزود خدمة' : 'عميل'
                        : user?.userType == 'vendor' ? 'Vendor' : 'Client',
                      style: TextStyle(
                        color: const Color(0xFF6A3DE8),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          
          const SizedBox(height: 32),
          
          // Settings section
          Text(
            isArabic ? 'الإعدادات' : 'Settings',
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 16),
          
          // Language setting
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.language),
            title: Text(isArabic ? 'اللغة' : 'Language'),
            trailing: DropdownButton<String>(
              value: isArabic ? 'ar' : 'en',
              underline: Container(),
              items: [
                DropdownMenuItem(
                  value: 'en',
                  child: const Text('English'),
                ),
                DropdownMenuItem(
                  value: 'ar',
                  child: const Text('العربية'),
                ),
              ],
              onChanged: (value) {
                if (value != null) {
                  languageProvider.setLocale(Locale(value, ''));
                }
              },
            ),
          ),
          
          // Removed offline mode toggle as we now always use server API
          
          const Divider(),
          
          // Logout button
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(
              Icons.logout,
              color: Colors.red,
            ),
            title: Text(
              isArabic ? 'تسجيل الخروج' : 'Logout',
              style: const TextStyle(
                color: Colors.red,
              ),
            ),
            onTap: () async {
              await authService.logout();
              if (mounted) {
                Navigator.pushReplacementNamed(context, '/login');
              }
            },
          ),
          
          const SizedBox(height: 32),
          
          // App info
          Center(
            child: Column(
              children: [
                const Text(
                  'Saneea',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF6A3DE8),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  isArabic ? 'منصة إدارة الأحداث الذكية' : 'Smart Event Management Platform',
                  style: TextStyle(
                    color: Colors.grey.shade600,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Version 1.0.0',
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey.shade600,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
