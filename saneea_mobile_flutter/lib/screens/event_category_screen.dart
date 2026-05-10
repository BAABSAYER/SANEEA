import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:saneea_mobile_flutter/providers/event_provider.dart';
import 'package:saneea_mobile_flutter/models/event_category.dart';
import 'package:saneea_mobile_flutter/l10n/language_provider.dart';

class EventCategoryScreen extends StatelessWidget {
  const EventCategoryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final languageProvider = Provider.of<LanguageProvider>(context);
    final eventProvider = Provider.of<EventProvider>(context);
    final categories = eventProvider.categories;
    final bool isArabic = languageProvider.locale.languageCode == 'ar';

    return Scaffold(
      backgroundColor: Color(0xFFF8F9FA),
      appBar: AppBar(
        title: Text(
          isArabic ? 'اختر فئة المناسبة' : 'Select Event Category',
          style: const TextStyle(
            fontWeight: FontWeight.bold,
            color: Colors.white,
            fontSize: 20,
          ),
        ),
        backgroundColor: const Color(0xFF6A3DE8),
        iconTheme: const IconThemeData(color: Colors.white),
        elevation: 0,
        centerTitle: true,
      ),
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              Color(0xFF6A3DE8).withValues(alpha: 0.1),
              Color(0xFFF8F9FA),
            ],
            stops: [0.0, 0.3],
          ),
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(20.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.05),
                        blurRadius: 20,
                        offset: Offset(0, 10),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Color(0xFF6A3DE8).withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Icon(
                              Icons.event,
                              color: Color(0xFF6A3DE8),
                              size: 24,
                            ),
                          ),
                          SizedBox(width: 16),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  isArabic 
                                    ? 'ما نوع المناسبة التي تخطط لها؟'
                                    : 'What type of event are you planning?',
                                  style: const TextStyle(
                                    fontSize: 18,
                                    fontWeight: FontWeight.bold,
                                    color: Color(0xFF2D3748),
                                  ),
                                ),
                                SizedBox(height: 4),
                                Text(
                                  isArabic 
                                    ? 'اختر من الفئات المتاحة أدناه'
                                    : 'Choose from the categories below',
                                  style: TextStyle(
                                    fontSize: 14,
                                    color: Colors.grey.shade600,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
                Expanded(
                  child: GridView.builder(
                    physics: BouncingScrollPhysics(),
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      childAspectRatio: 0.9,
                      crossAxisSpacing: 16,
                      mainAxisSpacing: 16,
                    ),
                    itemCount: categories.length,
                    itemBuilder: (context, index) {
                      final category = categories[index];
                      return _buildEnhancedCategoryCard(
                        context,
                        category,
                        isArabic,
                        onTap: () {
                          eventProvider.selectCategory(category.id);
                          Navigator.pushNamed(
                            context,
                            '/vendors',
                            arguments: category.id,
                          );
                        },
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildEnhancedCategoryCard(
    BuildContext context,
    EventCategory category,
    bool isArabic, {
    required VoidCallback onTap,
  }) {
    // Define gradient colors based on category
    List<Color> gradientColors = _getCategoryGradient(category.name);
    
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: gradientColors,
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: gradientColors.first.withValues(alpha: 0.3),
              blurRadius: 15,
              offset: Offset(0, 8),
            ),
          ],
        ),
        child: Padding(
          padding: EdgeInsets.all(20),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                padding: EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.25),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(
                  _getCategoryIcon(category.name),
                  color: Colors.white,
                  size: 32,
                ),
              ),
              SizedBox(height: 16),
              Text(
                category.name,
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                ),
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              if (category.description != null && category.description!.isNotEmpty) ...[
                SizedBox(height: 8),
                Text(
                  category.description!,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.8),
                    fontSize: 12,
                  ),
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  List<Color> _getCategoryGradient(String categoryName) {
    final name = categoryName.toLowerCase();
    if (name.contains('wedding') || name.contains('زفاف')) {
      return [Color(0xFFFFB6C1), Color(0xFFFF69B4)];
    } else if (name.contains('corporate') || name.contains('شركات')) {
      return [Color(0xFF87CEEB), Color(0xFF4682B4)];
    } else if (name.contains('birthday') || name.contains('ميلاد')) {
      return [Color(0xFFFFE4B5), Color(0xFFFF8C00)];
    } else if (name.contains('graduation') || name.contains('تخرج')) {
      return [Color(0xFF98FB98), Color(0xFF32CD32)];
    } else if (name.contains('anniversary') || name.contains('ذكرى')) {
      return [Color(0xFFDDA0DD), Color(0xFF9370DB)];
    } else {
      return [Color(0xFF6A3DE8), Color(0xFF8B5CF6)];
    }
  }

  IconData _getCategoryIcon(String categoryName) {
    final name = categoryName.toLowerCase();
    if (name.contains('wedding') || name.contains('زفاف')) {
      return Icons.favorite;
    } else if (name.contains('corporate') || name.contains('شركات')) {
      return Icons.business;
    } else if (name.contains('birthday') || name.contains('ميلاد')) {
      return Icons.cake;
    } else if (name.contains('graduation') || name.contains('تخرج')) {
      return Icons.school;
    } else if (name.contains('anniversary') || name.contains('ذكرى')) {
      return Icons.celebration;
    } else {
      return Icons.event;
    }
  }

  Widget _buildCategoryCard(
    BuildContext context,
    EventCategory category,
    bool isArabic, {
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Card(
        elevation: 4,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: double.infinity,
              height: 100,
              decoration: BoxDecoration(
                color: const Color(0xFF6A3DE8).withValues(alpha: 0.8),
                borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(16),
                  topRight: Radius.circular(16),
                ),
              ),
              child: Center(
                child: Text(
                  category.icon ?? '📅',
                  style: const TextStyle(fontSize: 36),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(12.0),
              child: Column(
                children: [
                  Text(
                    category.name,
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    category.description ?? '',
                    style: const TextStyle(
                      fontSize: 12,
                      color: Colors.grey,
                    ),
                    textAlign: TextAlign.center,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
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
