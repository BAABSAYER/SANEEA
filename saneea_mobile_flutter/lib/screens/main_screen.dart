import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:saneea_mobile_flutter/screens/home_tab.dart';
import 'package:saneea_mobile_flutter/screens/bookings_screen.dart';
import 'package:saneea_mobile_flutter/screens/chat_list_screen.dart';
import 'package:saneea_mobile_flutter/screens/profile_screen.dart';
import 'package:saneea_mobile_flutter/services/auth_service.dart';
import 'package:saneea_mobile_flutter/services/message_service.dart';
import 'package:saneea_mobile_flutter/l10n/language_provider.dart';
import 'package:saneea_mobile_flutter/providers/event_provider.dart';

class MainScreen extends StatefulWidget {
  const MainScreen({super.key});

  @override
  State<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> {
  int _selectedIndex = 0;
  
  // Method to allow other widgets to change the active tab
  void setActiveTab(int index) {
    if (index >= 0 && index < 4) {
      setState(() {
        _selectedIndex = index;
      });
    }
  }

  @override
  void initState() {
    super.initState();
    // Load data when the main screen is created
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final authService = Provider.of<AuthService>(context, listen: false);
      final messageService = Provider.of<MessageService>(context, listen: false);
      final eventProvider = Provider.of<EventProvider>(context, listen: false);
      
      // Load event types and categories
      eventProvider.loadEventTypes(authService);
      
      // Initialize message service
      await messageService.initialize();
    });
  }

  @override
  Widget build(BuildContext context) {
    final languageProvider = Provider.of<LanguageProvider>(context);
    bool isArabic = languageProvider.locale.languageCode == 'ar';
    
    // The main tabs of the application
    final List<Widget> pages = [
      const HomeTab(), // Home tab content
      const BookingsScreen(), // Event requests tab
      const ChatListScreen(), // Messages tab
      const ProfileScreen(), // Profile tab
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
}