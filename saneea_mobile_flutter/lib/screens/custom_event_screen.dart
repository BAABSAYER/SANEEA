import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:saneea_mobile_flutter/l10n/language_provider.dart';

class CustomEventScreen extends StatefulWidget {
  const CustomEventScreen({super.key});

  @override
  State<CustomEventScreen> createState() => _CustomEventScreenState();
}

class _CustomEventScreenState extends State<CustomEventScreen> {
  final _eventNameController = TextEditingController();
  final _descriptionController = TextEditingController();
  DateTime _eventDate = DateTime.now().add(const Duration(days: 14));
  int _guestCount = 50;
  final List<String> _selectedServices = [];
  final _formKey = GlobalKey<FormState>();
  
  final List<Map<String, dynamic>> _availableServices = [
    {'id': 'venue', 'name': 'Venue', 'nameAr': 'مكان المناسبة'},
    {'id': 'catering', 'name': 'Catering', 'nameAr': 'طعام'},
    {'id': 'photography', 'name': 'Photography', 'nameAr': 'تصوير'},
    {'id': 'decoration', 'name': 'Decoration', 'nameAr': 'ديكور'},
    {'id': 'entertainment', 'name': 'Entertainment', 'nameAr': 'ترفيه'},
    {'id': 'invitations', 'name': 'Invitations', 'nameAr': 'دعوات'},
  ];

  @override
  void dispose() {
    _eventNameController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _selectDate(BuildContext context) async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: _eventDate,
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365 * 2)),
    );
    
    if (picked != null && picked != _eventDate) {
      setState(() {
        _eventDate = picked;
      });
    }
  }
  
  void _toggleService(String serviceId) {
    setState(() {
      if (_selectedServices.contains(serviceId)) {
        _selectedServices.remove(serviceId);
      } else {
        _selectedServices.add(serviceId);
      }
    });
  }
  
  void _submitCustomEvent() {
    if (!_formKey.currentState!.validate()) {
      return;
    }
    
    // This would normally send the custom event data to the server or local storage
    // For now, just show a success message and navigate back
    
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          Provider.of<LanguageProvider>(context, listen: false).locale.languageCode == 'ar'
              ? 'تم إنشاء المناسبة المخصصة بنجاح'
              : 'Custom event created successfully',
        ),
        backgroundColor: Colors.green,
      ),
    );
    
    // Navigate back after a brief delay
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) {
        Navigator.pop(context);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final languageProvider = Provider.of<LanguageProvider>(context);
    bool isArabic = languageProvider.locale.languageCode == 'ar';
    
    return Scaffold(
      appBar: AppBar(
        title: Text(
          isArabic ? 'مناسبة مخصصة' : 'Custom Event',
          style: const TextStyle(color: Colors.white),
        ),
        backgroundColor: const Color(0xFF6A3DE8),
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(16.0),
            children: [
              Text(
                isArabic ? 'أنشئ مناسبتك الخاصة' : 'Create Your Custom Event',
                style: const TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF6A3DE8),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                isArabic
                    ? 'خصص مناسبتك بالضبط كما تريدها'
                    : 'Customize your event exactly how you want it',
                style: TextStyle(
                  color: Colors.grey.shade700,
                ),
              ),
              const SizedBox(height: 24),
              
              // Event name field
              TextFormField(
                controller: _eventNameController,
                decoration: InputDecoration(
                  labelText: isArabic ? 'اسم المناسبة' : 'Event Name',
                  hintText: isArabic ? 'أدخل اسم المناسبة' : 'Enter event name',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return isArabic ? 'يرجى إدخال اسم المناسبة' : 'Please enter an event name';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),
              
              // Event date picker
              InkWell(
                onTap: () => _selectDate(context),
                child: InputDecorator(
                  decoration: InputDecoration(
                    labelText: isArabic ? 'تاريخ المناسبة' : 'Event Date',
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                    suffixIcon: const Icon(Icons.calendar_today),
                  ),
                  child: Text(
                    '${_eventDate.day}/${_eventDate.month}/${_eventDate.year}',
                  ),
                ),
              ),
              const SizedBox(height: 16),
              
              // Number of guests
              Text(
                isArabic ? 'عدد الضيوف: $_guestCount' : 'Number of Guests: $_guestCount',
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                ),
              ),
              Slider(
                value: _guestCount.toDouble(),
                min: 10,
                max: 500,
                divisions: 49,
                label: _guestCount.toString(),
                onChanged: (value) {
                  setState(() {
                    _guestCount = value.toInt();
                  });
                },
                activeColor: const Color(0xFF6A3DE8),
              ),
              const SizedBox(height: 16),
              
              // Description
              TextFormField(
                controller: _descriptionController,
                decoration: InputDecoration(
                  labelText: isArabic ? 'وصف المناسبة' : 'Event Description',
                  hintText: isArabic ? 'اذكر تفاصيل إضافية عن مناسبتك' : 'Add additional details about your event',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                  alignLabelWithHint: true,
                ),
                maxLines: 3,
              ),
              const SizedBox(height: 24),
              
              // Services
              Text(
                isArabic ? 'الخدمات المطلوبة' : 'Required Services',
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              
              // Services checkboxes
              ...List.generate(
                _availableServices.length,
                (index) => CheckboxListTile(
                  title: Text(
                    isArabic ? _availableServices[index]['nameAr'] : _availableServices[index]['name'],
                  ),
                  value: _selectedServices.contains(_availableServices[index]['id']),
                  onChanged: (_) => _toggleService(_availableServices[index]['id']),
                  activeColor: const Color(0xFF6A3DE8),
                ),
              ),
              
              const SizedBox(height: 24),
              
              // Submit button
              ElevatedButton(
                onPressed: _submitCustomEvent,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF6A3DE8),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                child: Text(
                  isArabic ? 'إنشاء المناسبة' : 'Create Event',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
