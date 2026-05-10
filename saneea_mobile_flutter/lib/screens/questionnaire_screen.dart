import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../models/event_type.dart';
import '../models/questionnaire_item.dart';
import '../config/api_config.dart';
import '../services/auth_service.dart';
import '../services/booking_service.dart';
// Removed old import - now using unified booking system
import 'package:http/http.dart' as http;
import 'dart:convert';

class QuestionnaireScreen extends StatefulWidget {
  final EventType eventType;

  const QuestionnaireScreen({Key? key, required this.eventType}) : super(key: key);

  @override
  _QuestionnaireScreenState createState() => _QuestionnaireScreenState();
}

class _QuestionnaireScreenState extends State<QuestionnaireScreen> {
  List<QuestionnaireItem> _questions = [];
  bool _isLoading = true;
  String? _error;
  
  // Store responses
  final Map<int, dynamic> _responses = {};
  DateTime? _eventDate;
  double? _budget;
  final TextEditingController _specialRequestsController = TextEditingController();
  
  final PageController _pageController = PageController();
  int _currentPage = 0;
  
  @override
  void initState() {
    super.initState();
    _fetchQuestionnaireItems();
  }
  
  @override
  void dispose() {
    _pageController.dispose();
    _specialRequestsController.dispose();
    super.dispose();
  }
  
  Future<void> _fetchQuestionnaireItems() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    
    try {
      final authService = Provider.of<AuthService>(context, listen: false);
      
      final response = await authService.apiService.get(
        '${ApiConfig.baseUrl}/api/event-types/${widget.eventType.id}/questionnaire-items'
      );
      
      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body);
        final questions = data.map((item) => QuestionnaireItem.fromJson(item)).toList();
        
        setState(() {
          _questions = questions;
          _isLoading = false;
        });
      } else {
        setState(() {
          _error = 'Failed to load questionnaire: ${response.statusCode}';
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _error = 'Network error: $e';
        _isLoading = false;
      });
    }
  }
  
  Future<void> _submitEventRequest() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    
    try {
      final authService = Provider.of<AuthService>(context, listen: false);
      
      if (!authService.isLoggedIn) {
        setState(() {
          _error = 'You must be logged in to submit an event request.';
          _isLoading = false;
        });
        return;
      }
      
      // Validate required fields
      for (final question in _questions) {
        if (question.required) {
          final response = _responses[question.id];
          if (response == null || 
              (response is String && response.trim().isEmpty) ||
              (response is List && response.isEmpty)) {
            setState(() {
              _error = 'Please answer all required questions: ${question.questionText}';
              _isLoading = false;
            });
            return;
          }
        }
      }
      
      // Convert responses to proper JSON strings to avoid encoding issues
      final Map<String, dynamic> cleanResponses = {};
      _responses.forEach((key, value) {
        if (value is List) {
          cleanResponses[key.toString()] = value.map((e) => e.toString()).toList();
        } else {
          cleanResponses[key.toString()] = value?.toString() ?? '';
        }
      });

      // Prepare booking data to match server expectations
      final requestData = {
        'eventTypeId': widget.eventType.id,
        'eventDate': _eventDate?.toIso8601String() ?? DateTime.now().add(Duration(days: 7)).toIso8601String(),
        'eventTime': '12:00',
        'estimatedGuests': (_budget ?? 50).toInt(),
        'specialRequests': _specialRequestsController.text,
        'questionnaireResponses': cleanResponses,
        'totalPrice': 0,
        'vendorId': null,
        'serviceId': null,
      };
      
      final bookingService = Provider.of<BookingService>(context, listen: false);
      
      await bookingService.createBooking(requestData, authService);
      
      if (mounted) {
        Navigator.of(context).popUntil((route) => route.isFirst);
      }
    } catch (e) {
      setState(() {
        _error = 'Network error: $e';
        _isLoading = false;
      });
    }
  }
  
  void _nextPage() {
    // Since we're using simplified flow without questionnaire items,
    // go directly to additional info page, then submit
    if (_currentPage < 1) { // Only additional info page
      _pageController.nextPage(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
    } else {
      _submitEventRequest();
    }
  }
  
  void _previousPage() {
    if (_currentPage > 0) {
      _pageController.previousPage(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
    }
  }
  
  Widget _buildQuestionWidget(QuestionnaireItem question) {
    print('Building question type: ${question.questionType}'); // Debug log
    
    switch (question.questionType.toLowerCase().trim()) {
      case 'text':
      case 'textarea':
        return _buildTextQuestion(question);
      case 'single_choice':
      case 'dropdown':
      case 'select':
        return _buildSingleChoiceQuestion(question);
      case 'multiple_choice':
      case 'checkbox':
      case 'checkboxes':
        return _buildMultipleChoiceQuestion(question);
      case 'number':
      case 'numeric':
        return _buildNumberQuestion(question);
      case 'date':
      case 'datetime':
        return _buildDateQuestion(question);
      case 'boolean':
      case 'bool':
      case 'yes_no':
        return _buildBooleanQuestion(question);
      default:
        print('Unsupported question type: ${question.questionType}, defaulting to text');
        return _buildTextQuestion(question); // Default to text input for unknown types
    }
  }
  
  Widget _buildTextQuestion(QuestionnaireItem question) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          question.questionText,
          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 12),
        TextFormField(
          initialValue: _responses[question.id] as String?,
          decoration: const InputDecoration(
            border: OutlineInputBorder(),
            hintText: 'Enter your answer',
          ),
          maxLines: 3,
          onChanged: (value) {
            setState(() {
              _responses[question.id] = value;
            });
          },
        ),
      ],
    );
  }
  
  Widget _buildSingleChoiceQuestion(QuestionnaireItem question) {
    final options = question.options as List<dynamic>? ?? [];
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          question.questionText,
          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 12),
        ...options.map((option) {
          return RadioListTile<String>(
            title: Text(option),
            value: option,
            groupValue: _responses[question.id] as String?,
            onChanged: (value) {
              setState(() {
                _responses[question.id] = value;
              });
            },
          );
        }).toList(),
      ],
    );
  }
  
  Widget _buildMultipleChoiceQuestion(QuestionnaireItem question) {
    final options = question.options as List<dynamic>? ?? [];
    
    // Initialize response as list if not already
    if (!_responses.containsKey(question.id)) {
      _responses[question.id] = <String>[];
    }
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          question.questionText,
          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 12),
        ...options.map((option) {
          final selected = (_responses[question.id] as List<dynamic>).contains(option);
          
          return CheckboxListTile(
            title: Text(option),
            value: selected,
            onChanged: (checked) {
              setState(() {
                final list = List<String>.from(_responses[question.id] as List<dynamic>);
                if (checked == true) {
                  list.add(option);
                } else {
                  list.remove(option);
                }
                _responses[question.id] = list;
              });
            },
          );
        }).toList(),
      ],
    );
  }
  
  Widget _buildNumberQuestion(QuestionnaireItem question) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          question.questionText,
          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 12),
        TextFormField(
          initialValue: _responses[question.id]?.toString(),
          decoration: const InputDecoration(
            border: OutlineInputBorder(),
            hintText: 'Enter a number',
          ),
          keyboardType: TextInputType.number,
          onChanged: (value) {
            setState(() {
              _responses[question.id] = int.tryParse(value) ?? value;
            });
          },
        ),
      ],
    );
  }
  
  Widget _buildDateQuestion(QuestionnaireItem question) {
    final dateFormat = DateFormat('yyyy-MM-dd');
    final selectedDate = _responses[question.id] != null 
        ? dateFormat.format(DateTime.parse(_responses[question.id]))
        : 'Select a date';
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          question.questionText,
          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 12),
        ListTile(
          title: Text(selectedDate),
          trailing: const Icon(Icons.calendar_today),
          onTap: () async {
            final DateTime? picked = await showDatePicker(
              context: context,
              initialDate: DateTime.now().add(const Duration(days: 1)),
              firstDate: DateTime.now(),
              lastDate: DateTime.now().add(const Duration(days: 365 * 2)),
            );
            
            if (picked != null) {
              setState(() {
                _responses[question.id] = picked.toIso8601String();
              });
            }
          },
        ),
      ],
    );
  }
  
  Widget _buildBooleanQuestion(QuestionnaireItem question) {
    final bool currentValue = _responses[question.id] == 'true' || _responses[question.id] == true;
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          question.question,
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500),
        ),
        if (question.required)
          const Text(
            ' *',
            style: TextStyle(color: Colors.red, fontSize: 16),
          ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: RadioListTile<bool>(
                title: const Text('Yes'),
                value: true,
                groupValue: currentValue,
                onChanged: (bool? value) {
                  setState(() {
                    _responses[question.id] = value.toString();
                  });
                },
              ),
            ),
            Expanded(
              child: RadioListTile<bool>(
                title: const Text('No'),
                value: false,
                groupValue: currentValue,
                onChanged: (bool? value) {
                  setState(() {
                    _responses[question.id] = value.toString();
                  });
                },
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildAdditionalInfoPage() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Additional Information',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 24),
          
          // Event Date
          const Text(
            'Event Date',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          ListTile(
            title: Text(_eventDate != null 
                ? DateFormat('yyyy-MM-dd').format(_eventDate!) 
                : 'Select event date'),
            trailing: const Icon(Icons.calendar_today),
            onTap: () async {
              final DateTime? picked = await showDatePicker(
                context: context,
                initialDate: DateTime.now().add(const Duration(days: 1)),
                firstDate: DateTime.now(),
                lastDate: DateTime.now().add(const Duration(days: 365 * 2)),
              );
              
              if (picked != null) {
                setState(() {
                  _eventDate = picked;
                });
              }
            },
          ),
          const SizedBox(height: 24),
          
          // Budget
          const Text(
            'Budget (Optional)',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          TextFormField(
            decoration: const InputDecoration(
              border: OutlineInputBorder(),
              hintText: 'Enter your estimated budget',
              prefixText: '\$ ',
            ),
            keyboardType: TextInputType.number,
            onChanged: (value) {
              setState(() {
                _budget = double.tryParse(value);
              });
            },
          ),
          const SizedBox(height: 24),
          
          // Special Requests
          const Text(
            'Special Requests (Optional)',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          TextFormField(
            controller: _specialRequestsController,
            decoration: const InputDecoration(
              border: OutlineInputBorder(),
              hintText: 'Enter any special requests or notes',
            ),
            maxLines: 4,
          ),
        ],
      ),
    );
  }
  
  Widget _buildNavigationButtons() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          if (_currentPage > 0)
            ElevatedButton(
              onPressed: _previousPage,
              child: const Text('Previous'),
            )
          else
            const SizedBox(width: 88), // Placeholder for button width
          
          Text('${_currentPage + 1} / ${_questions.length + 1}'),
          
          ElevatedButton(
            onPressed: _currentPage == _questions.length 
                ? _submitEventRequest
                : _nextPage,
            child: Text(_currentPage == _questions.length ? 'Submit' : 'Next'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.eventType.name, style: const TextStyle(fontFamily: 'Almarai')),
        centerTitle: true,
      ),
      body: _isLoading 
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        _error!,
                        textAlign: TextAlign.center,
                        style: TextStyle(color: Colors.red[700]),
                      ),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: _fetchQuestionnaireItems,
                        child: const Text('Try Again'),
                      ),
                    ],
                  ),
                )
              : Column(
                  children: [
                    Expanded(
                      child: PageView(
                        controller: _pageController,
                        onPageChanged: (page) {
                          setState(() {
                            _currentPage = page;
                          });
                        },
                        children: [
                          ..._questions.map((question) {
                            return Padding(
                              padding: const EdgeInsets.all(16.0),
                              child: _buildQuestionWidget(question),
                            );
                          }).toList(),
                          
                          // Additional info page
                          _buildAdditionalInfoPage(),
                        ],
                      ),
                    ),
                    _buildNavigationButtons(),
                  ],
                ),
    );
  }
}