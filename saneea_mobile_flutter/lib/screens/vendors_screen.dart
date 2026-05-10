import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:saneea_mobile_flutter/l10n/language_provider.dart';
import 'package:saneea_mobile_flutter/providers/event_provider.dart';
import 'package:saneea_mobile_flutter/services/vendor_service.dart';
import 'package:saneea_mobile_flutter/services/auth_service.dart';
import 'package:saneea_mobile_flutter/screens/vendor_detail_screen.dart';
import 'package:saneea_mobile_flutter/models/vendor.dart';

class VendorsScreen extends StatefulWidget {
  final String categoryId;
  
  const VendorsScreen({super.key, required this.categoryId});

  @override
  State<VendorsScreen> createState() => _VendorsScreenState();
}

class _VendorsScreenState extends State<VendorsScreen> {
  final _searchController = TextEditingController();
  bool _isLoading = true;
  
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
    
    await vendorService.loadVendors(authService, category: widget.categoryId);
    
    if (mounted) {
      setState(() {
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final languageProvider = Provider.of<LanguageProvider>(context);
    final eventProvider = Provider.of<EventProvider>(context);
    final vendorService = Provider.of<VendorService>(context);
    final category = eventProvider.getCategoryById(widget.categoryId);
    final bool isArabic = languageProvider.locale.languageCode == 'ar';

    return Scaffold(
      appBar: AppBar(
        title: Text(
          category != null 
              ? category.name
              : isArabic
                  ? 'مزودي الخدمات'
                  : 'Vendors',
          style: const TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.bold,
          ),
        ),
        backgroundColor: const Color(0xFF6A3DE8),
        iconTheme: const IconThemeData(color: Colors.white),
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
          
          // Vendor listings
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : vendorService.vendors.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.search_off,
                              size: 64,
                              color: Colors.grey.shade400,
                            ),
                            const SizedBox(height: 16),
                            Text(
                              isArabic
                                  ? 'لا توجد نتائج'
                                  : 'No results found',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                                color: Colors.grey.shade600,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              isArabic
                                  ? 'حاول البحث بكلمات مختلفة'
                                  : 'Try searching with different terms',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                color: Colors.grey.shade600,
                              ),
                            ),
                          ],
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        itemCount: vendorService.vendors.length,
                        itemBuilder: (context, index) {
                          final vendor = vendorService.vendors[index];
                          
                          return _buildVendorCard(context, vendor, isArabic);
                        },
                      ),
          ),
        ],
      ),
    );
  }
  
  Widget _buildVendorCard(BuildContext context, Vendor vendor, bool isArabic) {
    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
      ),
      elevation: 3,
      child: InkWell(
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => VendorDetailScreen(vendor: vendor),
            ),
          );
        },
        borderRadius: BorderRadius.circular(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Vendor image area
            Container(
              height: 120,
              width: double.infinity,
              decoration: BoxDecoration(
                color: const Color(0xFF6A3DE8).withValues(alpha: 0.2),
                borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(12),
                  topRight: Radius.circular(12),
                ),
              ),
              child: vendor.imageUrl != null
                  ? ClipRRect(
                      borderRadius: const BorderRadius.only(
                        topLeft: Radius.circular(12),
                        topRight: Radius.circular(12),
                      ),
                      child: Image.network(
                        vendor.imageUrl!,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => const Icon(
                          Icons.business,
                          size: 60,
                          color: Color(0xFF6A3DE8),
                        ),
                      ),
                    )
                  : const Center(
                      child: Icon(
                        Icons.business,
                        size: 60,
                        color: Color(0xFF6A3DE8),
                      ),
                    ),
            ),
            
            // Vendor details
            Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Name and rating
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          vendor.name,
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      Row(
                        children: [
                          const Icon(
                            Icons.star,
                            color: Colors.amber,
                            size: 18,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            vendor.rating.toString(),
                            style: const TextStyle(
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  
                  // Description
                  Text(
                    vendor.description,
                    style: TextStyle(
                      color: Colors.grey.shade700,
                      fontSize: 14,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 16),
                  
                  // Services chips
                  SizedBox(
                    height: 32,
                    child: ListView.builder(
                      scrollDirection: Axis.horizontal,
                      itemCount: vendor.services.length > 3 
                          ? 3 
                          : vendor.services.length,
                      itemBuilder: (context, index) {
                        return Container(
                          margin: const EdgeInsets.only(right: 8),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8, 
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFF6A3DE8).withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: Text(
                            vendor.services[index],
                            style: const TextStyle(
                              fontSize: 12,
                              color: Color(0xFF6A3DE8),
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                  const SizedBox(height: 16),
                  
                  // Price and booking
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        '${isArabic ? 'يبدأ من' : 'Starting at'} \$${vendor.basePrice.toStringAsFixed(2)}',
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF6A3DE8),
                        ),
                      ),
                      ElevatedButton(
                        onPressed: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (context) => VendorDetailScreen(vendor: vendor),
                            ),
                          );
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF6A3DE8),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                        ),
                        child: Text(
                          isArabic ? 'احجز الآن' : 'Book Now',
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
