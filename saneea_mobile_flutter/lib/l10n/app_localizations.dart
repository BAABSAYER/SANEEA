import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_ar.dart';
import 'app_localizations_en.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
      : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations? of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations);
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
    delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
  ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('ar'),
    Locale('en')
  ];

  /// The application name
  ///
  /// In en, this message translates to:
  /// **'Saneea'**
  String get appName;

  /// Login button text
  ///
  /// In en, this message translates to:
  /// **'Login'**
  String get login;

  /// Register button text
  ///
  /// In en, this message translates to:
  /// **'Register'**
  String get register;

  /// Email field label
  ///
  /// In en, this message translates to:
  /// **'Email'**
  String get email;

  /// Password field label
  ///
  /// In en, this message translates to:
  /// **'Password'**
  String get password;

  /// Forgot password link text
  ///
  /// In en, this message translates to:
  /// **'Forgot Password?'**
  String get forgotPassword;

  /// Registration prompt text
  ///
  /// In en, this message translates to:
  /// **'Don\'t have an account? Register'**
  String get dontHaveAccount;

  /// Login prompt text
  ///
  /// In en, this message translates to:
  /// **'Already have an account? Login'**
  String get alreadyHaveAccount;

  /// Name field label
  ///
  /// In en, this message translates to:
  /// **'Name'**
  String get name;

  /// Confirm password field label
  ///
  /// In en, this message translates to:
  /// **'Confirm Password'**
  String get confirmPassword;

  /// Create account button text
  ///
  /// In en, this message translates to:
  /// **'Create Account'**
  String get createAccount;

  /// Welcome message
  ///
  /// In en, this message translates to:
  /// **'Welcome to Saneea!'**
  String get welcomeToSaneea;

  /// Account type information text
  ///
  /// In en, this message translates to:
  /// **'Create your account to start booking events or providing services'**
  String get accountTypeInfo;

  /// Account type field label
  ///
  /// In en, this message translates to:
  /// **'Account Type'**
  String get accountType;

  /// Client account type
  ///
  /// In en, this message translates to:
  /// **'Client'**
  String get client;

  /// Vendor account type
  ///
  /// In en, this message translates to:
  /// **'Vendor'**
  String get vendor;

  /// Home tab label
  ///
  /// In en, this message translates to:
  /// **'Home'**
  String get home;

  /// Bookings tab label
  ///
  /// In en, this message translates to:
  /// **'Bookings'**
  String get bookings;

  /// Messages tab label
  ///
  /// In en, this message translates to:
  /// **'Messages'**
  String get messages;

  /// Profile tab label
  ///
  /// In en, this message translates to:
  /// **'Profile'**
  String get profile;

  /// Welcome greeting
  ///
  /// In en, this message translates to:
  /// **'Welcome'**
  String get welcome;

  /// Home screen question
  ///
  /// In en, this message translates to:
  /// **'What are you planning today?'**
  String get whatPlanning;

  /// Categories section title
  ///
  /// In en, this message translates to:
  /// **'Categories'**
  String get categories;

  /// View all button text
  ///
  /// In en, this message translates to:
  /// **'View All'**
  String get viewAll;

  /// Wedding event type
  ///
  /// In en, this message translates to:
  /// **'Wedding'**
  String get wedding;

  /// Corporate event type
  ///
  /// In en, this message translates to:
  /// **'Corporate'**
  String get corporate;

  /// Birthday event type
  ///
  /// In en, this message translates to:
  /// **'Birthday'**
  String get birthday;

  /// Custom event type
  ///
  /// In en, this message translates to:
  /// **'Custom Event'**
  String get customEvent;

  /// Recent bookings section title
  ///
  /// In en, this message translates to:
  /// **'Recent Bookings'**
  String get recentBookings;

  /// Empty bookings message
  ///
  /// In en, this message translates to:
  /// **'No bookings yet'**
  String get noBookingsYet;

  /// Settings menu item
  ///
  /// In en, this message translates to:
  /// **'Settings'**
  String get settings;

  /// Language setting
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get language;

  /// Logout menu item
  ///
  /// In en, this message translates to:
  /// **'Logout'**
  String get logout;

  /// App tagline
  ///
  /// In en, this message translates to:
  /// **'Smart Event Management Platform'**
  String get smartEventPlatform;

  /// Event categories title
  ///
  /// In en, this message translates to:
  /// **'Event Categories'**
  String get eventCategories;

  /// Event type selection question
  ///
  /// In en, this message translates to:
  /// **'What type of event are you planning?'**
  String get whatTypeEvent;

  /// Pending status
  ///
  /// In en, this message translates to:
  /// **'Pending'**
  String get pending;

  /// Confirmed status
  ///
  /// In en, this message translates to:
  /// **'Confirmed'**
  String get confirmed;

  /// Completed status
  ///
  /// In en, this message translates to:
  /// **'Completed'**
  String get completed;

  /// Cancelled status
  ///
  /// In en, this message translates to:
  /// **'Cancelled'**
  String get cancelled;

  /// Empty category message
  ///
  /// In en, this message translates to:
  /// **'No bookings in this category'**
  String get noBookingsCategory;

  /// Message admin button
  ///
  /// In en, this message translates to:
  /// **'Message Admin'**
  String get messageAdmin;

  /// Start message button
  ///
  /// In en, this message translates to:
  /// **'Start Message'**
  String get startMessage;

  /// Empty messages state
  ///
  /// In en, this message translates to:
  /// **'No messages yet'**
  String get noMessagesYet;

  /// Message input placeholder
  ///
  /// In en, this message translates to:
  /// **'Type a message...'**
  String get typeMessage;

  /// Send button
  ///
  /// In en, this message translates to:
  /// **'Send'**
  String get send;

  /// Submit button
  ///
  /// In en, this message translates to:
  /// **'Submit'**
  String get submit;

  /// Cancel button
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get cancel;

  /// Save button
  ///
  /// In en, this message translates to:
  /// **'Save'**
  String get save;

  /// Delete button
  ///
  /// In en, this message translates to:
  /// **'Delete'**
  String get delete;

  /// Edit button
  ///
  /// In en, this message translates to:
  /// **'Edit'**
  String get edit;

  /// Loading state text
  ///
  /// In en, this message translates to:
  /// **'Loading...'**
  String get loading;

  /// Error message
  ///
  /// In en, this message translates to:
  /// **'Error'**
  String get error;

  /// Success message
  ///
  /// In en, this message translates to:
  /// **'Success'**
  String get success;

  /// Required field indicator
  ///
  /// In en, this message translates to:
  /// **'Required'**
  String get required;

  /// Optional field indicator
  ///
  /// In en, this message translates to:
  /// **'Optional'**
  String get optional;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['ar', 'en'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'ar':
      return AppLocalizationsAr();
    case 'en':
      return AppLocalizationsEn();
  }

  throw FlutterError(
      'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
      'an issue with the localizations generation tool. Please file an issue '
      'on GitHub with a reproducible sample app and the gen-l10n configuration '
      'that was used.');
}
