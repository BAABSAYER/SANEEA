import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class LanguageProvider extends ChangeNotifier {
  static const String _languageStorageKey = 'saneea_language_code';

  Locale _locale = const Locale('ar', ''); // Default to Arabic
  bool _isLoading = false;

  Locale get locale => _locale;
  bool get isLoading => _isLoading;

  LanguageProvider() {
    _loadSavedLanguage();
  }

  Future<void> _loadSavedLanguage() async {
    _isLoading = true;
    notifyListeners();
    
    try {
      final prefs = await SharedPreferences.getInstance();
      final savedLanguage = prefs.getString(_languageStorageKey);
      if (savedLanguage != null) {
        _locale = Locale(savedLanguage, '');
      }
    } catch (e) {
      print('Error loading saved language: $e');
    }
    
    _isLoading = false;
    notifyListeners();
  }

  Future<void> setLocale(Locale locale) async {
    if (_locale.languageCode == locale.languageCode) return;
    
    _locale = locale;
    
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_languageStorageKey, locale.languageCode);
    } catch (e) {
      print('Error saving language preference: $e');
    }
    
    notifyListeners();
  }

  // Support for older screens that still use the translate method
  String translate(String key) {
    // This method is kept for backward compatibility
    // New screens should use context.l10n directly
    return key;
  }
}
