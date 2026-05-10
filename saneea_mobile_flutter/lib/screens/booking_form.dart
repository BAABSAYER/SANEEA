import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:saneea_mobile_flutter/services/auth_service.dart';
import 'package:saneea_mobile_flutter/services/booking_service.dart';
import 'package:saneea_mobile_flutter/services/vendor_service.dart';
import 'package:saneea_mobile_flutter/l10n/language_provider.dart';
import 'package:saneea_mobile_flutter/models/vendor.dart';
import 'package:saneea_mobile_flutter/models/booking.dart';

class BookingFormScreen extends StatefulWidget {
  final Vendor primaryVendor;
  
  const BookingFormScreen({
    super.key, 
    required this.primaryVendor,
  });

  @override
  State<BookingFormScreen> createState() => _BookingFormScreenState();
}

class _BookingFormScreenState extends State<BookingFormScreen> {
  final _notesController = TextEditingController();
  DateTime _eventDate = DateTime.now().add(const Duration(days: 14));
  String _packageType = 'Standard';
  bool _isLoading = false;
  double _totalPrice = 0;
  
  @override
  void initState() {
    super.initState();
    _calculateTotalPrice();
  }
  
  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }
  
  void _calculateTotalPrice() {
    // Base price from primary vendor
    double basePrice = widget.primaryVendor.basePrice;
    
    // Apply multiplier based on package type
    double packageMultiplier = 1.0;
    switch (_packageType) {
      case 'Basic':
        packageMultiplier = 1.0;
        break;
      case 'Standard':
        packageMultiplier = 1.75;
        break;
      case 'Premium':
        packageMultiplier = 2.5;
        break;
    }
    
    // Get selected additional vendors
    final vendorService = Provider.of<VendorService>(context, listen: false);
    double additionalVendorsCost = 0;
    for (final vendor in vendorService.selectedVendors) {
      if (vendor.id != widget.primaryVendor.id) {
        additionalVendorsCost += vendor.basePrice * 0.8; // 80% of their base price
      }
    }
    
    _totalPrice = (basePrice * packageMultiplier) + additionalVendorsCost;
    setState(() {});
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
  
  Future<void> _submitBooking() async {
    setState(() {
      _isLoading = true;
    });
    
    try {
      final authService = Provider.of<AuthService>(context, listen: false);
      final bookingService = Provider.of<BookingService>(context, listen: false);
      final vendorService = Provider.of<VendorService>(context, listen: false);
      
      // Get additional vendors (excluding primary)
      final additionalVendors = vendorService.selectedVendors
          .where((v) => v.id != widget.primaryVendor.id)
          .toList();
      
      final booking = Booking(
        id: 0, // Will be assigned by the service
        clientId: authService.user?.id ?? 1,
        vendorId: widget.primaryVendor.id,
        vendorName: widget.primaryVendor.name,
        eventDate: _eventDate,
        eventType: widget.primaryVendor.category,
        packageType: _packageType,
        totalPrice: _totalPrice,
        status: 'pending',
        notes: _notesController.text,
        additionalVendorIds: additionalVendors.map((v) => v.id).toList(),
        additionalVendorNames: additionalVendors.map((v) => v.name).toList(),
      );
      

      final success = await bookingService.createBooking(booking.toJson(), authService);
      
      if (success) {
        // Clear selected vendors after successful booking
        vendorService.clearSelectedVendors();
        
        // Show success message and navigate back
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(Provider.of<LanguageProvider>(context, listen: false)
                             .locale.languageCode == 'ar'
                  ? 'تم إنشاء الحجز بنجاح'
                  : 'Booking created successfully'
              ),
              backgroundColor: Colors.green,
            ),
          );
          Navigator.popUntil(context, (route) => route.isFirst);
        }
      } else {
        // Show error message
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(bookingService.error ?? 'Failed to create booking'),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: ${e.toString()}'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final languageProvider = Provider.of<LanguageProvider>(context);
    final vendorService = Provider.of<VendorService>(context);
    final bool isArabic = languageProvider.locale.languageCode == 'ar';
    
    return Scaffold(
      appBar: AppBar(
        title: Text(
          isArabic ? 'إنشاء حجز' : 'Create Booking',
          style: const TextStyle(color: Colors.white),
        ),
        backgroundColor: const Color(0xFF6A3DE8),
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Primary vendor card
            Card(
              elevation: 4,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      isArabic ? 'مزود الخدمة الرئيسي' : 'Primary Vendor',
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF6A3DE8),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 60,
                          height: 60,
                          decoration: BoxDecoration(
                            color: const Color(0xFF6A3DE8).withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Icon(
                            Icons.business,
                            color: Color(0xFF6A3DE8),
                            size: 32,
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                widget.primaryVendor.name,
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 18,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                widget.primaryVendor.description,
                                style: TextStyle(
                                  color: Colors.grey.shade700,
                                  fontSize: 14,
                                ),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 8),
                              Row(
                                children: [
                                  const Icon(
                                    Icons.star,
                                    color: Colors.amber,
                                    size: 16,
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    widget.primaryVendor.rating.toString(),
                                    style: const TextStyle(
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                  const SizedBox(width: 16),
                                  Text(
                                    '\$${widget.primaryVendor.basePrice.toStringAsFixed(2)}',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),
            
            // Event date picker
            Text(
              isArabic ? 'تاريخ المناسبة' : 'Event Date',
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            InkWell(
              onTap: () => _selectDate(context),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.grey.shade300),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.calendar_today, color: Color(0xFF6A3DE8)),
                    const SizedBox(width: 16),
                    Text(
                      '${_eventDate.day}/${_eventDate.month}/${_eventDate.year}',
                      style: const TextStyle(fontSize: 16),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),
            
            // Package type selector
            Text(
              isArabic ? 'نوع الباقة' : 'Package Type',
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 12,
              children: [
                _buildPackageChip('Basic', isArabic ? 'أساسي' : 'Basic'),
                _buildPackageChip('Standard', isArabic ? 'قياسي' : 'Standard'),
                _buildPackageChip('Premium', isArabic ? 'متميز' : 'Premium'),
              ],
            ),
            const SizedBox(height: 24),
            
            // Additional vendors
            Text(
              isArabic ? 'مزودو الخدمة الإضافيون' : 'Additional Vendors',
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            // Show selected vendors
            if (vendorService.selectedVendors.isNotEmpty &&
                vendorService.selectedVendors.any((v) => v.id != widget.primaryVendor.id))
              Column(
                children: vendorService.selectedVendors
                    .where((v) => v.id != widget.primaryVendor.id)
                    .map((vendor) => Card(
                          margin: const EdgeInsets.only(bottom: 12),
                          child: ListTile(
                            leading: Container(
                              width: 40,
                              height: 40,
                              decoration: BoxDecoration(
                                color: const Color(0xFF6A3DE8).withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Icon(
                                Icons.business,
                                color: Color(0xFF6A3DE8),
                              ),
                            ),
                            title: Text(vendor.name),
                            subtitle: Text('\$${vendor.basePrice.toStringAsFixed(2)}'),
                            trailing: IconButton(
                              icon: const Icon(Icons.close, color: Colors.red),
                              onPressed: () {
                                vendorService.toggleVendorSelection(vendor.id);
                                _calculateTotalPrice();
                              },
                            ),
                          ),
                        ))
                    .toList(),
              )
            else
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.grey.shade100,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  isArabic 
                      ? 'لم يتم تحديد مزودي خدمة إضافيين. انقر أدناه لإضافة المزيد.'
                      : 'No additional vendors selected. Tap below to add more.',
                  style: TextStyle(
                    color: Colors.grey.shade700,
                  ),
                ),
              ),
            const SizedBox(height: 12),
            // Button to select more vendors
            ElevatedButton.icon(
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => VendorSelectionScreen(
                      categoryFilter: widget.primaryVendor.category,
                      excludeVendorId: widget.primaryVendor.id,
                    ),
                  ),
                ).then((_) => _calculateTotalPrice());
              },
              icon: const Icon(Icons.add),
              label: Text(isArabic ? 'إضافة مزود خدمة' : 'Add Vendor'),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: const Color(0xFF6A3DE8),
                elevation: 0,
                side: const BorderSide(color: Color(0xFF6A3DE8)),
              ),
            ),
            const SizedBox(height: 24),
            
            // Notes field
            Text(
              isArabic ? 'ملاحظات' : 'Notes',
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _notesController,
              decoration: InputDecoration(
                hintText: isArabic 
                    ? 'أضف أي تفاصيل خاصة أو طلبات لمزود الخدمة'
                    : 'Add any special details or requests for the vendor',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              maxLines: 3,
            ),
            const SizedBox(height: 24),
            
            // Price summary
            Card(
              elevation: 4,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      isArabic ? 'ملخص السعر' : 'Price Summary',
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          isArabic ? 'مزود الخدمة الرئيسي' : 'Primary Vendor',
                          style: TextStyle(
                            color: Colors.grey.shade700,
                          ),
                        ),
                        Text('\$${widget.primaryVendor.basePrice.toStringAsFixed(2)}'),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          isArabic ? 'نوع الباقة' : 'Package Type',
                          style: TextStyle(
                            color: Colors.grey.shade700,
                          ),
                        ),
                        Text(_packageType),
                      ],
                    ),
                    if (vendorService.selectedVendors.any((v) => v.id != widget.primaryVendor.id)) ...[
                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            isArabic ? 'مزودو الخدمة الإضافيون' : 'Additional Vendors',
                            style: TextStyle(
                              color: Colors.grey.shade700,
                            ),
                          ),
                          Text(
                            '+\$${vendorService.selectedVendors
                                .where((v) => v.id != widget.primaryVendor.id)
                                .fold(0.0, (sum, v) => sum + v.basePrice * 0.8)
                                .toStringAsFixed(2)}',
                          ),
                        ],
                      ),
                    ],
                    const Divider(height: 24),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          isArabic ? 'الإجمالي' : 'Total',
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 18,
                          ),
                        ),
                        Text(
                          '\$${_totalPrice.toStringAsFixed(2)}',
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 18,
                            color: Color(0xFF6A3DE8),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 32),
            
            // Submit button
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _isLoading ? null : _submitBooking,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF6A3DE8),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                  disabledBackgroundColor: Colors.grey,
                ),
                child: _isLoading
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : Text(
                        isArabic ? 'تأكيد الحجز' : 'Confirm Booking',
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
  
  Widget _buildPackageChip(String value, String label) {
    final bool isSelected = _packageType == value;
    
    return ChoiceChip(
      label: Text(label),
      selected: isSelected,
      onSelected: (selected) {
        if (selected) {
          setState(() {
            _packageType = value;
          });
          _calculateTotalPrice();
        }
      },
      backgroundColor: Colors.grey.shade200,
      selectedColor: const Color(0xFF6A3DE8).withValues(alpha: 0.2),
      labelStyle: TextStyle(
        color: isSelected ? const Color(0xFF6A3DE8) : Colors.black,
        fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
      ),
    );
  }
}

// Screen for selecting additional vendors
class VendorSelectionScreen extends StatefulWidget {
  final String categoryFilter;
  final int excludeVendorId;
  
  const VendorSelectionScreen({
    super.key,
    required this.categoryFilter,
    required this.excludeVendorId,
  });

  @override
  State<VendorSelectionScreen> createState() => _VendorSelectionScreenState();
}

class _VendorSelectionScreenState extends State<VendorSelectionScreen> {
  final _searchController = TextEditingController();
  
  @override
  void initState() {
    super.initState();
    _loadVendors();
  }
  
  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }
  
  Future<void> _loadVendors() async {
    final vendorService = Provider.of<VendorService>(context, listen: false);
    final authService = Provider.of<AuthService>(context, listen: false);
    
    await vendorService.loadVendors(authService, category: widget.categoryFilter);
  }

  @override
  Widget build(BuildContext context) {
    final languageProvider = Provider.of<LanguageProvider>(context);
    final vendorService = Provider.of<VendorService>(context);
    final bool isArabic = languageProvider.locale.languageCode == 'ar';
    
    return Scaffold(
      appBar: AppBar(
        title: Text(
          isArabic ? 'اختيار مزودي الخدمة' : 'Select Vendors',
          style: const TextStyle(color: Colors.white),
        ),
        backgroundColor: const Color(0xFF6A3DE8),
        iconTheme: const IconThemeData(color: Colors.white),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(context);
            },
            child: Text(
              isArabic ? 'تم' : 'Done',
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          // Search bar
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: isArabic ? 'البحث عن مزودي الخدمة' : 'Search vendors',
                prefixIcon: const Icon(Icons.search),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
                contentPadding: const EdgeInsets.symmetric(vertical: 12),
              ),
              onChanged: (value) {
                vendorService.setSearchQuery(value);
              },
            ),
          ),
          
          // Vendor list
          Expanded(
            child: vendorService.isLoading
                ? const Center(child: CircularProgressIndicator())
                : vendorService.vendors.isEmpty
                    ? Center(
                        child: Text(
                          isArabic 
                              ? 'لا توجد نتائج'
                              : 'No results found',
                          style: TextStyle(
                            color: Colors.grey.shade600,
                          ),
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        itemCount: vendorService.vendors.length,
                        itemBuilder: (context, index) {
                          final vendor = vendorService.vendors[index];
                          
                          // Skip the excluded vendor
                          if (vendor.id == widget.excludeVendorId) {
                            return const SizedBox.shrink();
                          }
                          
                          return Card(
                            margin: const EdgeInsets.only(bottom: 12),
                            child: ListTile(
                              leading: Container(
                                width: 48,
                                height: 48,
                                decoration: BoxDecoration(
                                  color: const Color(0xFF6A3DE8).withValues(alpha: 0.1),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: const Icon(
                                  Icons.business,
                                  color: Color(0xFF6A3DE8),
                                ),
                              ),
                              title: Text(vendor.name),
                              subtitle: Text(
                                '${isArabic ? 'التقييم' : 'Rating'}: ${vendor.rating} ⭐ • \$${vendor.basePrice.toStringAsFixed(2)}',
                              ),
                              trailing: Checkbox(
                                value: vendor.isSelected,
                                onChanged: (value) {
                                  vendorService.toggleVendorSelection(vendor.id);
                                },
                                activeColor: const Color(0xFF6A3DE8),
                              ),
                            ),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }
}
