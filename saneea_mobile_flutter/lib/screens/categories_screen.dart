import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:saneea_mobile_flutter/providers/event_provider.dart';
import 'package:saneea_mobile_flutter/l10n/language_provider.dart';
import 'package:saneea_mobile_flutter/models/event_category.dart';

class CategoriesScreen extends StatelessWidget {
  const CategoriesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final languageProvider = Provider.of<LanguageProvider>(context);
    final eventProvider = Provider.of<EventProvider>(context);
    final categories = eventProvider.categories;
    final bool isArabic = languageProvider.locale.languageCode == 'ar';

    return Scaffold(
      appBar: AppBar(
        title: Text(
          isArabic ? 'فئات المناسبات' : 'Event Categories',
          style: const TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.bold,
          ),
        ),
        backgroundColor: const Color(0xFF6A3DE8),
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              isArabic 
                ? 'ما نوع المناسبة التي تخطط لها؟'
                : 'What type of event are you planning?',
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 24),
            Expanded(
              child: GridView.builder(
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  childAspectRatio: 0.85,
                  crossAxisSpacing: 16,
                  mainAxisSpacing: 16,
                ),
                itemCount: categories.length,
                itemBuilder: (context, index) {
                  final category = categories[index];
                  return _buildCategoryCard(
                    context,
                    category,
                    isArabic,
                    onTap: () {
                      eventProvider.selectCategory(category.id);
                      if (category.id == 'custom') {
                        Navigator.pushNamed(context, '/custom-event');
                      } else {
                        Navigator.pushNamed(
                          context,
                          '/event-questionnaire',
                          arguments: category.id,
                        );
                      }
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
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
