import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:saneea_mobile_flutter/screens/splash_screen.dart';
import 'package:saneea_mobile_flutter/screens/login_screen.dart';
import 'package:saneea_mobile_flutter/screens/home_screen.dart';
import 'package:saneea_mobile_flutter/screens/register_screen.dart';
import 'package:saneea_mobile_flutter/screens/categories_screen.dart';
import 'package:saneea_mobile_flutter/screens/custom_event_screen.dart';
import 'package:saneea_mobile_flutter/screens/event_questionnaire_screen.dart';

import 'package:saneea_mobile_flutter/screens/main_screen.dart';
import 'package:saneea_mobile_flutter/screens/profile_screen.dart';
import 'package:saneea_mobile_flutter/screens/chat_list_screen.dart';
import 'package:saneea_mobile_flutter/services/auth_service.dart';
import 'package:saneea_mobile_flutter/services/booking_service.dart';
import 'package:saneea_mobile_flutter/services/message_service.dart';
import 'package:saneea_mobile_flutter/l10n/language_provider.dart';
import 'package:saneea_mobile_flutter/providers/event_provider.dart';
import 'package:saneea_mobile_flutter/models/event_type.dart';
import 'package:saneea_mobile_flutter/l10n/app_localizations.dart';

void main() {
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthService()),
        ChangeNotifierProvider(create: (_) => LanguageProvider()),
        ChangeNotifierProvider(create: (_) => EventProvider()),
        ChangeNotifierProxyProvider<AuthService, BookingService>(
          create: (context) => BookingService(context.read<AuthService>()),
          update: (context, auth, previous) => previous ?? BookingService(auth),
        ),
        ChangeNotifierProxyProvider<AuthService, MessageService>(
          create: (context) => MessageService(context.read<AuthService>()),
          update: (context, auth, previous) => previous ?? MessageService(auth),
        ),
      ],
      child: const MyApp(),
    ),
  );
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    final languageProvider = Provider.of<LanguageProvider>(context);
    
    return MaterialApp(
      title: 'Saneea',
      debugShowCheckedModeBanner: false,
      locale: languageProvider.locale,
      supportedLocales: const [
        Locale('en', ''),
        Locale('ar', ''),
      ],
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      theme: ThemeData(
        fontFamily: 'Roboto',
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF6A3DE8),
          primary: const Color(0xFF6A3DE8),
          secondary: const Color(0xFF5735B5),
        ),
        textTheme: const TextTheme(
          displayLarge: TextStyle(color: Color(0xFF333333)),
          displayMedium: TextStyle(color: Color(0xFF333333)),
          displaySmall: TextStyle(color: Color(0xFF333333)),
          headlineMedium: TextStyle(color: Color(0xFF333333)),
          headlineSmall: TextStyle(color: Color(0xFF333333)),
          titleLarge: TextStyle(color: Color(0xFF333333)),
          titleMedium: TextStyle(color: Color(0xFF333333)),
          titleSmall: TextStyle(color: Color(0xFF333333)),
          bodyLarge: TextStyle(color: Color(0xFF333333)),
          bodyMedium: TextStyle(color: Color(0xFF333333)),
          bodySmall: TextStyle(color: Color(0xFF666666)),
          labelLarge: TextStyle(color: Color(0xFF333333)),
          labelSmall: TextStyle(color: Color(0xFF666666)),
        ),
        useMaterial3: true,
      ),
      initialRoute: '/',
      routes: {
        '/': (context) => const SplashScreen(),
        '/login': (context) => const LoginScreen(),
        '/home': (context) => const MainScreen(),
        '/old-home': (context) => const HomeScreen(), // Keep for backwards compatibility
        '/register': (context) => const RegisterScreen(),
        '/categories': (context) => const CategoriesScreen(),
        '/custom-event': (context) => const CustomEventScreen(),
        '/event-questionnaire': (context) => EventQuestionnaireScreen(eventType: ModalRoute.of(context)!.settings.arguments as EventType),
        '/profile': (context) => const ProfileScreen(),
        '/chat-list': (context) => const ChatListScreen(),
      },
    );
  }
}
