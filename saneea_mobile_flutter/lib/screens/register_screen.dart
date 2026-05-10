import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:saneea_mobile_flutter/services/auth_service.dart';
import 'package:saneea_mobile_flutter/l10n/language_provider.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _nameController = TextEditingController();
  final _usernameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  String _selectedUserType = 'client';
  bool _isLoading = false;
  final _formKey = GlobalKey<FormState>();

  @override
  void dispose() {
    _nameController.dispose();
    _usernameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _register() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    if (_passwordController.text != _confirmPasswordController.text) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Passwords do not match'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {
      final authService = Provider.of<AuthService>(context, listen: false);
      final success = await authService.register(
        _usernameController.text.trim(), // username
        _emailController.text.trim(),    // email
        _passwordController.text,        // password
        _nameController.text.trim(),     // fullName
        _selectedUserType,               // userType
      );

      if (success) {
        Navigator.pushReplacementNamed(context, '/home');
      } else {
        _showErrorSnackbar(authService.error ?? 'Registration failed');
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
  Widget build(BuildContext context) {
    final languageProvider = Provider.of<LanguageProvider>(context);
    bool isArabic = languageProvider.locale.languageCode == 'ar';

    return Scaffold(
      appBar: AppBar(
        title: Text(
          isArabic ? 'إنشاء حساب' : 'Create Account',
          style: const TextStyle(color: Colors.white),
        ),
        backgroundColor: const Color(0xFF6A3DE8),
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  isArabic ? 'مرحبًا بك في سنيع!' : 'Welcome to Saneea!',
                  style: const TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF6A3DE8),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  isArabic
                      ? 'أنشئ حسابك للبدء في حجز المناسبات أو تقديم الخدمات'
                      : 'Create your account to start booking events or providing services',
                  style: TextStyle(
                    color: Colors.grey.shade700,
                  ),
                ),
                const SizedBox(height: 24),

                // Name field
                TextFormField(
                  controller: _nameController,
                  decoration: InputDecoration(
                    labelText: isArabic ? 'الاسم' : 'Name',
                    hintText: isArabic ? 'أدخل اسمك الكامل' : 'Enter your full name',
                    prefixIcon: const Icon(Icons.person),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return isArabic ? 'يرجى إدخال اسمك' : 'Please enter your name';
                    }
                    return null;
                  },
                  textInputAction: TextInputAction.next,
                ),
                const SizedBox(height: 16),

                // Username field
                TextFormField(
                  controller: _usernameController,
                  decoration: InputDecoration(
                    labelText: isArabic ? 'اسم المستخدم' : 'Username',
                    hintText: isArabic ? 'أدخل اسم المستخدم' : 'Enter your username',
                    prefixIcon: const Icon(Icons.account_circle),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return isArabic ? 'يرجى إدخال اسم المستخدم' : 'Please enter your username';
                    }
                    if (value.length < 3) {
                      return isArabic ? 'اسم المستخدم قصير جداً' : 'Username too short';
                    }
                    return null;
                  },
                  textInputAction: TextInputAction.next,
                ),
                const SizedBox(height: 16),

                // Email field
                TextFormField(
                  controller: _emailController,
                  decoration: InputDecoration(
                    labelText: isArabic ? 'البريد الإلكتروني' : 'Email',
                    hintText: isArabic ? 'أدخل بريدك الإلكتروني' : 'Enter your email',
                    prefixIcon: const Icon(Icons.email),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return isArabic ? 'يرجى إدخال بريدك الإلكتروني' : 'Please enter your email';
                    }
                    if (!value.contains('@')) {
                      return isArabic ? 'يرجى إدخال بريد إلكتروني صالح' : 'Please enter a valid email';
                    }
                    return null;
                  },
                  keyboardType: TextInputType.emailAddress,
                  textInputAction: TextInputAction.next,
                ),
                const SizedBox(height: 16),

                // Password field
                TextFormField(
                  controller: _passwordController,
                  decoration: InputDecoration(
                    labelText: isArabic ? 'كلمة المرور' : 'Password',
                    hintText: isArabic ? 'أدخل كلمة المرور' : 'Enter your password',
                    prefixIcon: const Icon(Icons.lock),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return isArabic ? 'يرجى إدخال كلمة المرور' : 'Please enter your password';
                    }
                    if (value.length < 6) {
                      return isArabic ? 'كلمة المرور قصيرة جدًا (٦ أحرف على الأقل)' : 'Password is too short (min 6 characters)';
                    }
                    return null;
                  },
                  obscureText: true,
                  textInputAction: TextInputAction.next,
                ),
                const SizedBox(height: 16),

                // Confirm Password field
                TextFormField(
                  controller: _confirmPasswordController,
                  decoration: InputDecoration(
                    labelText: isArabic ? 'تأكيد كلمة المرور' : 'Confirm Password',
                    hintText: isArabic ? 'أعد إدخال كلمة المرور' : 'Re-enter your password',
                    prefixIcon: const Icon(Icons.lock_outline),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return isArabic ? 'يرجى تأكيد كلمة المرور' : 'Please confirm your password';
                    }
                    if (value != _passwordController.text) {
                      return isArabic ? 'كلمات المرور غير متطابقة' : 'Passwords do not match';
                    }
                    return null;
                  },
                  obscureText: true,
                  textInputAction: TextInputAction.done,
                ),
                const SizedBox(height: 24),

                // User type selection
                Text(
                  isArabic ? 'نوع الحساب' : 'Account Type',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: RadioListTile<String>(
                        title: Text(isArabic ? 'عميل' : 'Client'),
                        value: 'client',
                        groupValue: _selectedUserType,
                        onChanged: (value) {
                          setState(() {
                            _selectedUserType = value!;
                          });
                        },
                        activeColor: const Color(0xFF6A3DE8),
                      ),
                    ),
                    Expanded(
                      child: RadioListTile<String>(
                        title: Text(isArabic ? 'مزود خدمة' : 'Vendor'),
                        value: 'vendor',
                        groupValue: _selectedUserType,
                        onChanged: (value) {
                          setState(() {
                            _selectedUserType = value!;
                          });
                        },
                        activeColor: const Color(0xFF6A3DE8),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),

                // Register button
                ElevatedButton(
                  onPressed: _isLoading ? null : _register,
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
                          isArabic ? 'إنشاء حساب' : 'Create Account',
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                ),
                const SizedBox(height: 16),

                // Login link
                TextButton(
                  onPressed: () {
                    Navigator.pop(context);
                  },
                  child: Text(
                    isArabic
                        ? 'لديك حساب بالفعل؟ تسجيل الدخول'
                        : 'Already have an account? Login',
                    style: const TextStyle(color: Color(0xFF6A3DE8)),
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
