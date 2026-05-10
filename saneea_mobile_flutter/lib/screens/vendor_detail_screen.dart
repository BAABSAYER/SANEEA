import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:saneea_mobile_flutter/services/vendor_service.dart';
import 'package:saneea_mobile_flutter/l10n/language_provider.dart';
import 'package:saneea_mobile_flutter/screens/booking_form.dart';
import 'package:saneea_mobile_flutter/models/vendor.dart';

class VendorDetailScreen extends StatelessWidget {
  final Vendor vendor;
  
  const VendorDetailScreen({
    super.key,
    required this.vendor,
  });

  @override
  Widget build(BuildContext context) {
    final languageProvider = Provider.of<LanguageProvider>(context);
    final bool isArabic = languageProvider.locale.languageCode == 'ar';
    
    return Scaffold(
      appBar: AppBar(
        title: Text(
          vendor.name,
          style: const TextStyle(color: Colors.white),
        ),
        backgroundColor: const Color(0xFF6A3DE8),
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Cover image or header
            Container(
              height: 200,
              width: double.infinity,
              color: const Color(0xFF6A3DE8).withValues(alpha: 0.8),
              child: vendor.imageUrl != null
                  ? Image.network(
                      vendor.imageUrl!,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => const Icon(
                        Icons.business,
                        size: 80,
                        color: Colors.white,
                      ),
                    )
                  : const Center(
                      child: Icon(
                        Icons.business,
                        size: 80,
                        color: Colors.white,
                      ),
                    ),
            ),
            
            // Vendor info
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
                            fontSize: 24,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.amber.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Row(
                          children: [
                            const Icon(
                              Icons.star,
                              color: Colors.amber,
                              size: 16,
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
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  
                  // Verified badge if applicable
                  if (vendor.isVerified)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.green.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.verified,
                            color: Colors.green,
                            size: 16,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            isArabic ? 'مزود خدمة معتمد' : 'Verified Vendor',
                            style: const TextStyle(
                              color: Colors.green,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                  const SizedBox(height: 16),
                  
                  // Description
                  Text(
                    vendor.description,
                    style: TextStyle(
                      fontSize: 16,
                      color: Colors.grey.shade700,
                    ),
                  ),
                  const SizedBox(height: 24),
                  
                  // Services offered
                  Text(
                    isArabic ? 'الخدمات المقدمة' : 'Services Offered',
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: vendor.services.map((service) {
                      return Chip(
                        label: Text(service),
                        backgroundColor: const Color(0xFF6A3DE8).withValues(alpha: 0.1),
                        labelStyle: const TextStyle(
                          color: Color(0xFF6A3DE8),
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 24),
                  
                  // Pricing
                  Text(
                    isArabic ? 'الأسعار' : 'Pricing',
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 12),
                  
                  // Pricing table
                  Table(
                    border: TableBorder.all(
                      color: Colors.grey.shade300,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    children: [
                      TableRow(
                        decoration: BoxDecoration(
                          color: const Color(0xFF6A3DE8).withValues(alpha: 0.1),
                        ),
                        children: [
                          _buildTableCell(
                            isArabic ? 'الباقة' : 'Package',
                            isHeader: true,
                          ),
                          _buildTableCell(
                            isArabic ? 'السعر' : 'Price',
                            isHeader: true,
                          ),
                        ],
                      ),
                      TableRow(
                        children: [
                          _buildTableCell(isArabic ? 'أساسي' : 'Basic'),
                          _buildTableCell(
                            '\$${vendor.basePrice.toStringAsFixed(2)}',
                          ),
                        ],
                      ),
                      TableRow(
                        children: [
                          _buildTableCell(isArabic ? 'قياسي' : 'Standard'),
                          _buildTableCell(
                            '\$${(vendor.basePrice * 1.75).toStringAsFixed(2)}',
                          ),
                        ],
                      ),
                      TableRow(
                        children: [
                          _buildTableCell(isArabic ? 'متميز' : 'Premium'),
                          _buildTableCell(
                            '\$${(vendor.basePrice * 2.5).toStringAsFixed(2)}',
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 32),
                  
                  // Book now button
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () {
                        // Mark this vendor as selected
                        final vendorService = Provider.of<VendorService>(context, listen: false);
                        if (!vendor.isSelected) {
                          vendorService.toggleVendorSelection(vendor.id);
                        }
                        
                        // Navigate to booking form
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (context) => BookingFormScreen(
                              primaryVendor: vendor,
                            ),
                          ),
                        );
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF6A3DE8),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                      ),
                      child: Text(
                        isArabic ? 'احجز الآن' : 'Book Now',
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
          ],
        ),
      ),
    );
  }
  
  Widget _buildTableCell(String text, {bool isHeader = false}) {
    return Padding(
      padding: const EdgeInsets.all(12.0),
      child: Text(
        text,
        textAlign: TextAlign.center,
        style: TextStyle(
          fontWeight: isHeader ? FontWeight.bold : FontWeight.normal,
        ),
      ),
    );
  }
}
