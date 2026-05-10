import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:saneea_mobile_flutter/services/auth_service.dart';
import 'package:saneea_mobile_flutter/l10n/language_provider.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
  }

  Future<void> _login() async {
    setState(() {
      _isLoading = true;
    });

    try {
      final authService = Provider.of<AuthService>(context, listen: false);
      final success = await authService.login(
        _usernameController.text.trim(),
        _passwordController.text,
      );

      if (success) {
        Navigator.pushReplacementNamed(context, '/home');
      } else {
        _showErrorSnackbar(authService.error ?? 'Login failed');
      }
    } catch (e) {
      _showErrorSnackbar(e.toString());
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  void _showErrorSnackbar(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.red,
      ),
    );
  }

  @override
  void dispose() {
    _usernameController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final authService = Provider.of<AuthService>(context);
    final languageProvider = Provider.of<LanguageProvider>(context);
    bool isArabic = languageProvider.locale.languageCode == 'ar';
    
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Logo
                Center(
                  child: Container(
                    width: 120,
                    height: 120,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.1),
                          blurRadius: 10,
                          spreadRadius: 1,
                        ),
                      ],
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(16),
                      child: Image.asset(
                        'assets/images/logo.jpg',
                        fit: BoxFit.cover,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                Text(
                  "Saneea",
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF6A3DE8),
                  ),
                ),
                const SizedBox(height: 40),
                
                // Username field
                TextField(
                  controller: _usernameController,
                  decoration: InputDecoration(
                    labelText: isArabic ? 'اسم المستخدم' : 'Username',
                    hintText: isArabic ? 'أدخل اسم المستخدم' : 'Enter your username',
                    prefixIcon: const Icon(Icons.person),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  textInputAction: TextInputAction.next,
                ),
                const SizedBox(height: 16),
                
                // Password field
                TextField(
                  controller: _passwordController,
                  decoration: InputDecoration(
                    labelText: isArabic ? 'كلمة المرور' : 'Password',
                    hintText: isArabic ? 'أدخل كلمة المرور' : 'Enter your password',
                    prefixIcon: const Icon(Icons.lock),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  obscureText: true,
                  textInputAction: TextInputAction.done,
                  onSubmitted: (_) => _login(),
                ),
                const SizedBox(height: 8),
                
                // Forgot password
                Row(
                  mainAxisAlignment: MainAxisAlignment.start,
                  children: [
                    TextButton(
                      onPressed: () {
                        // Handle forgot password
                      },
                      child: Text(
                        isArabic ? 'نسيت كلمة المرور؟' : 'Forgot Password?',
                        style: const TextStyle(color: Color(0xFF6A3DE8)),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                
                // Login button
                ElevatedButton(
                  onPressed: _isLoading ? null : _login,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF6A3DE8),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  child: _isLoading
                      ? const CircularProgressIndicator(color: Colors.white)
                      : Text(
                          isArabic ? 'تسجيل الدخول' : 'Login',
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                ),
                

                const SizedBox(height: 16),
                
                // Register link
                TextButton(
                  onPressed: () {
                    Navigator.pushNamed(context, '/register');
                  },
                  child: Text(
                    isArabic 
                      ? 'ليس لديك حساب؟ سجل الآن'
                      : 'Don\'t have an account? Register',
                    style: const TextStyle(color: Color(0xFF6A3DE8)),
                  ),
                ),
                
                // Debug info for test accounts
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.grey[100],
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Column(
                    children: [
                      Text(
                        "Test Accounts:",
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 12,
                          color: Colors.grey[600],
                        ),
                      ),
                      Text(
                        "Username: testuser, Password: password",
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey[600],
                        ),
                      ),
                      Text(
                        "Username: admin, Password: password",
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey[600],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
