import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:saneea_mobile_flutter/services/auth_service.dart';
import 'package:saneea_mobile_flutter/l10n/language_provider.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final authService = Provider.of<AuthService>(context);
    final languageProvider = Provider.of<LanguageProvider>(context);
    final bool isArabic = languageProvider.locale.languageCode == 'ar';
    final user = authService.user;

    if (user == null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              isArabic ? 'لم يتم تسجيل الدخول' : 'Not logged in',
              style: const TextStyle(fontSize: 18),
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF6A3DE8),
                foregroundColor: Colors.white,
              ),
              onPressed: () {
                Navigator.pushReplacementNamed(context, '/login');
              },
              child: Text(isArabic ? 'تسجيل الدخول' : 'Login'),
            ),
          ],
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
          // Profile header
          Center(
            child: Column(
              children: [
                const SizedBox(height: 20),
                CircleAvatar(
                  radius: 50,
                  backgroundColor: const Color(0xFF6A3DE8).withValues(alpha: 0.1),
                  child: Text(
                    (user.name != null && user.name!.isNotEmpty) ? user.name![0].toUpperCase() : 'U',
                    style: const TextStyle(
                      fontSize: 36,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF6A3DE8),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  user.name ?? user.username ?? 'User',
                  style: const TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  user.email ?? '',
                  style: TextStyle(
                    fontSize: 16,
                    color: Colors.grey.shade600,
                  ),
                ),
                if (user.phone != null && user.phone!.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      user.phone!,
                      style: TextStyle(
                        fontSize: 16,
                        color: Colors.grey.shade600,
                      ),
                    ),
                  ),
                const SizedBox(height: 20),
              ],
            ),
          ),

          const Divider(),

          // Account settings section
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 12.0),
            child: Text(
              isArabic ? 'إعدادات الحساب' : 'Account Settings',
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Color(0xFF6A3DE8),
              ),
            ),
          ),

          _buildSettingsItem(
            icon: Icons.person_outline,
            title: isArabic ? 'تحرير الملف الشخصي' : 'Edit Profile',
            onTap: () {
              // Navigate to edit profile screen
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(
                    isArabic ? 'قريبًا' : 'Coming soon',
                  ),
                  duration: const Duration(seconds: 2),
                ),
              );
            },
          ),

          _buildSettingsItem(
            icon: Icons.notifications_outlined,
            title: isArabic ? 'الإشعارات' : 'Notifications',
            onTap: () {
              // Navigate to notifications settings
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(
                    isArabic ? 'قريبًا' : 'Coming soon',
                  ),
                  duration: const Duration(seconds: 2),
                ),
              );
            },
          ),

          _buildSettingsItem(
            icon: Icons.language,
            title: isArabic ? 'اللغة' : 'Language',
            onTap: () {
              // Toggle language
              languageProvider.setLocale(
                isArabic ? const Locale('en', '') : const Locale('ar', '')
              );
            },
            trailing: Text(
              isArabic ? 'العربية' : 'English',
              style: TextStyle(
                color: Colors.grey.shade600,
              ),
            ),
          ),

          const Divider(),

          // Support section
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 12.0),
            child: Text(
              isArabic ? 'الدعم' : 'Support',
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Color(0xFF6A3DE8),
              ),
            ),
          ),

          _buildSettingsItem(
            icon: Icons.help_outline,
            title: isArabic ? 'المساعدة والدعم' : 'Help & Support',
            onTap: () {
              // Navigate to help & support
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(
                    isArabic ? 'قريبًا' : 'Coming soon',
                  ),
                  duration: const Duration(seconds: 2),
                ),
              );
            },
          ),

          _buildSettingsItem(
            icon: Icons.info_outline,
            title: isArabic ? 'حول التطبيق' : 'About',
            onTap: () {
              // Show about dialog
              showAboutDialog(
                context: context,
                applicationName: 'Saneea',
                applicationVersion: '1.0.0',
                applicationIcon: Image.asset(
                  'assets/images/logo.jpg',
                  width: 50,
                  height: 50,
                ),
                applicationLegalese: '© 2023 Saneea. All rights reserved.',
                children: [
                  const SizedBox(height: 16),
                  Text(
                    isArabic 
                      ? 'سنيع هو منصة شاملة لإدارة الأحداث تتيح للعملاء التواصل مع منظمي الأحداث والحصول على اقتباسات.'
                      : 'Saneea is a comprehensive event management platform that allows clients to connect with event organizers and get quotations.',
                  ),
                ],
              );
            },
          ),

          const SizedBox(height: 40),

          // Logout button
          Padding(
            padding: const EdgeInsets.only(bottom: 24.0),
            child: SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.red.shade100,
                  foregroundColor: Colors.red.shade800,
                  padding: const EdgeInsets.symmetric(vertical: 15),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                onPressed: () async {
                  // Show confirmation dialog
                  bool confirm = await showDialog(
                    context: context,
                    builder: (context) => AlertDialog(
                      title: Text(
                        isArabic ? 'تسجيل الخروج' : 'Logout',
                      ),
                      content: Text(
                        isArabic 
                          ? 'هل أنت متأكد أنك تريد تسجيل الخروج؟'
                          : 'Are you sure you want to logout?',
                      ),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.pop(context, false),
                          child: Text(
                            isArabic ? 'إلغاء' : 'Cancel',
                          ),
                        ),
                        TextButton(
                          onPressed: () => Navigator.pop(context, true),
                          child: Text(
                            isArabic ? 'تسجيل الخروج' : 'Logout',
                            style: TextStyle(
                              color: Colors.red.shade800,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ) ?? false;

                  if (confirm) {
                    await authService.logout();
                    if (context.mounted) {
                      Navigator.pushReplacementNamed(context, '/login');
                    }
                  }
                },
                child: Text(
                  isArabic ? 'تسجيل الخروج' : 'Logout',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
      ),
    );
  }

  Widget _buildSettingsItem({
    required IconData icon,
    required String title,
    required VoidCallback onTap,
    Widget? trailing,
  }) {
    return ListTile(
      leading: Icon(
        icon,
        color: const Color(0xFF6A3DE8),
      ),
      title: Text(
        title,
        style: const TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.w500,
        ),
      ),
      trailing: trailing ?? const Icon(Icons.arrow_forward_ios, size: 16),
      onTap: onTap,
      contentPadding: EdgeInsets.zero,
    );
  }
}