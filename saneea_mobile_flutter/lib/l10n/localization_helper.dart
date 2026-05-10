import 'package:flutter/material.dart';
import 'package:saneea_mobile_flutter/l10n/app_localizations.dart';

class LocalizationHelper {
  static AppLocalizations of(BuildContext context) {
    return AppLocalizations.of(context)!;
  }
  
  static String getString(BuildContext context, String key) {
    final localizations = AppLocalizations.of(context);
    if (localizations == null) return key;
    
    // Use reflection-like approach to get translations by key
    switch (key) {
      case 'appName': return localizations.appName;
      case 'login': return localizations.login;
      case 'register': return localizations.register;
      case 'email': return localizations.email;
      case 'password': return localizations.password;
      case 'forgotPassword': return localizations.forgotPassword;
      case 'dontHaveAccount': return localizations.dontHaveAccount;
      case 'alreadyHaveAccount': return localizations.alreadyHaveAccount;
      case 'name': return localizations.name;
      case 'confirmPassword': return localizations.confirmPassword;
      case 'createAccount': return localizations.createAccount;
      case 'welcomeToSaneea': return localizations.welcomeToSaneea;
      case 'accountTypeInfo': return localizations.accountTypeInfo;
      case 'accountType': return localizations.accountType;
      case 'client': return localizations.client;
      case 'vendor': return localizations.vendor;
      case 'home': return localizations.home;
      case 'bookings': return localizations.bookings;
      case 'messages': return localizations.messages;
      case 'profile': return localizations.profile;
      case 'welcome': return localizations.welcome;
      case 'whatPlanning': return localizations.whatPlanning;
      case 'categories': return localizations.categories;
      case 'viewAll': return localizations.viewAll;
      case 'wedding': return localizations.wedding;
      case 'corporate': return localizations.corporate;
      case 'birthday': return localizations.birthday;
      case 'customEvent': return localizations.customEvent;
      case 'recentBookings': return localizations.recentBookings;
      case 'noBookingsYet': return localizations.noBookingsYet;
      case 'settings': return localizations.settings;
      case 'language': return localizations.language;
      case 'logout': return localizations.logout;
      case 'smartEventPlatform': return localizations.smartEventPlatform;
      case 'eventCategories': return localizations.eventCategories;
      case 'whatTypeEvent': return localizations.whatTypeEvent;
      case 'pending': return localizations.pending;
      case 'confirmed': return localizations.confirmed;
      case 'completed': return localizations.completed;
      case 'cancelled': return localizations.cancelled;
      case 'noBookingsCategory': return localizations.noBookingsCategory;
      case 'messageAdmin': return localizations.messageAdmin;
      case 'startMessage': return localizations.startMessage;
      case 'noMessagesYet': return localizations.noMessagesYet;
      case 'typeMessage': return localizations.typeMessage;
      case 'send': return localizations.send;
      case 'submit': return localizations.submit;
      case 'cancel': return localizations.cancel;
      case 'save': return localizations.save;
      case 'delete': return localizations.delete;
      case 'edit': return localizations.edit;
      case 'loading': return localizations.loading;
      case 'error': return localizations.error;
      case 'success': return localizations.success;
      case 'required': return localizations.required;
      case 'optional': return localizations.optional;
      default: return key;
    }
  }
}

// Extension method for easier access
extension LocalizationContext on BuildContext {
  AppLocalizations get l10n => AppLocalizations.of(this)!;
  String t(String key) => LocalizationHelper.getString(this, key);
}
