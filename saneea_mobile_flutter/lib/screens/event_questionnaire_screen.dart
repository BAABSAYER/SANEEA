import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../models/event_type.dart';
import '../models/questionnaire_item.dart';
import '../config/api_config.dart';
import '../services/auth_service.dart';
import '../services/booking_service.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

class EventQuestionnaireScreen extends StatefulWidget {
  final EventType eventType;

  const EventQuestionnaireScreen({Key? key, required this.eventType}) : super(key: key);

  @override
  _EventQuestionnaireScreenState createState() => _EventQuestionnaireScreenState();
}

class _EventQuestionnaireScreenState extends State<EventQuestionnaireScreen> {
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
        '${ApiConfig.apiUrl}/event-types/${widget.eventType.id}/questionnaire-items',
      );
      
      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body);
        setState(() {
          _questions = data.map((item) => QuestionnaireItem.fromJson(item)).toList();
          _isLoading = false;
        });
      } else if (response.statusCode == 401) {
        // Session expired, redirect to login
        if (mounted) {
          Navigator.of(context).pushNamedAndRemoveUntil('/login', (route) => false);
        }
      } else {
        setState(() {
          _error = 'Failed to load questionnaire: ${response.statusCode}';
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _error = 'Network error: ${e.toString()}';
        _isLoading = false;
      });
    }
  }
  
  Future<void> _submitEventRequest() async {
    final authService = Provider.of<AuthService>(context, listen: false);
    
    // Prepare the request data with correct field names for backend
    // Convert responses to JSON-serializable format ensuring all values are strings
    final Map<String, String> cleanResponses = {};
    
    for (final entry in _responses.entries) {
      final key = entry.key.toString();
      final value = entry.value;
      
      if (value is List) {
        // For multiple choice questions, join with commas
        final stringList = value.where((item) => item != null).map((item) => item.toString()).toList();
        if (stringList.isNotEmpty) {
          cleanResponses[key] = stringList.join(', ');
        }
      } else if (value != null && value.toString().trim().isNotEmpty) {
        cleanResponses[key] = value.toString().trim();
      }
    }
    
    // Create properly structured request data with proper validation
    final Map<String, dynamic> requestData = {
      'eventTypeId': widget.eventType.id,
      'eventDate': _eventDate?.toIso8601String() ?? DateTime.now().add(Duration(days: 7)).toIso8601String(),
      'eventTime': '18:00:00',
      'location': cleanResponses['location'] ?? '',
      'estimatedGuests': cleanResponses['estimatedGuests'] != null ? int.tryParse(cleanResponses['estimatedGuests'].toString()) ?? 0 : 0,
      'guestCount': cleanResponses['guestCount'] != null ? int.tryParse(cleanResponses['guestCount'].toString()) ?? 0 : 0,
      'specialRequests': _specialRequestsController.text.trim(),
      'questionnaireResponses': cleanResponses,
      'totalPrice': 0.0,
      'status': 'pending'
    };
    
    // Debug logging
    print('Submitting request data: $requestData');
    print('Clean responses: $cleanResponses');
    
    try {
      print('Submitting event request...');
      
      final bookingService = Provider.of<BookingService>(context, listen: false);
      
      await bookingService.createBooking(requestData, authService);
      
      if (mounted) {
        Navigator.of(context).popUntil((route) => route.isFirst);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to submit request: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }
  
  Widget _buildQuestionWidget(QuestionnaireItem question) {
    switch (question.answerType) {
      case 'text':
        return TextFormField(
          decoration: InputDecoration(
            labelText: question.questionText,
            border: OutlineInputBorder(),
          ),
          onChanged: (value) {
            _responses[question.id] = value;
          },
          validator: question.isRequired ? (value) {
            if (value == null || value.isEmpty) {
              return 'This field is required';
            }
            return null;
          } : null,
        );
        
      case 'textarea':
        return TextFormField(
          decoration: InputDecoration(
            labelText: question.questionText,
            border: OutlineInputBorder(),
          ),
          maxLines: 4,
          onChanged: (value) {
            _responses[question.id] = value;
          },
          validator: question.isRequired ? (value) {
            if (value == null || value.isEmpty) {
              return 'This field is required';
            }
            return null;
          } : null,
        );
        
      case 'number':
        return TextFormField(
          decoration: InputDecoration(
            labelText: question.questionText,
            border: OutlineInputBorder(),
          ),
          keyboardType: TextInputType.number,
          onChanged: (value) {
            _responses[question.id] = value;
          },
          validator: question.isRequired ? (value) {
            if (value == null || value.isEmpty) {
              return 'This field is required';
            }
            return null;
          } : null,
        );
        
      case 'single_choice':
        return DropdownButtonFormField<String>(
          decoration: InputDecoration(
            labelText: question.questionText,
            border: OutlineInputBorder(),
          ),
          items: question.options?.map((option) {
            return DropdownMenuItem<String>(
              value: option,
              child: Text(option),
            );
          }).toList() ?? [],
          onChanged: (value) {
            _responses[question.id] = value;
          },
          validator: question.isRequired ? (value) {
            if (value == null || value.isEmpty) {
              return 'Please select an option';
            }
            return null;
          } : null,
        );
        
      case 'multiple_choice':
      case 'checkbox':
        return _buildMultipleChoiceWidget(question);
        
      case 'date':
        return _buildDatePickerWidget(question);
        
      default:
        return TextFormField(
          decoration: InputDecoration(
            labelText: question.questionText,
            border: OutlineInputBorder(),
          ),
          onChanged: (value) {
            _responses[question.id] = value;
          },
        );
    }
  }
  
  Widget _buildMultipleChoiceWidget(QuestionnaireItem question) {
    // Initialize selected options if not exists
    if (!_responses.containsKey(question.id)) {
      _responses[question.id] = <String>[];
    }
    
    List<String> selectedOptions = List<String>.from(_responses[question.id] ?? []);
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          question.questionText,
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500),
        ),
        SizedBox(height: 8),
        ...question.options?.map((option) {
          return CheckboxListTile(
            title: Text(option),
            value: selectedOptions.contains(option),
            onChanged: (bool? value) {
              setState(() {
                if (value == true) {
                  selectedOptions.add(option);
                } else {
                  selectedOptions.remove(option);
                }
                _responses[question.id] = selectedOptions;
              });
            },
            controlAffinity: ListTileControlAffinity.leading,
          );
        }).toList() ?? [],
        if (question.isRequired && selectedOptions.isEmpty)
          Padding(
            padding: EdgeInsets.only(left: 16, top: 4),
            child: Text(
              'Please select at least one option',
              style: TextStyle(color: Colors.red, fontSize: 12),
            ),
          ),
      ],
    );
  }
  
  Widget _buildDatePickerWidget(QuestionnaireItem question) {
    DateTime? selectedDate = _responses[question.id] != null 
        ? DateTime.tryParse(_responses[question.id].toString()) 
        : null;
    
    return InkWell(
      onTap: () async {
        final DateTime? picked = await showDatePicker(
          context: context,
          initialDate: selectedDate ?? DateTime.now(),
          firstDate: DateTime.now(),
          lastDate: DateTime.now().add(Duration(days: 365 * 2)),
        );
        if (picked != null) {
          setState(() {
            _responses[question.id] = picked.toIso8601String();
          });
        }
      },
      child: Container(
        padding: EdgeInsets.all(16),
        decoration: BoxDecoration(
          border: Border.all(color: Colors.grey),
          borderRadius: BorderRadius.circular(4),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              selectedDate != null
                  ? '${selectedDate.day}/${selectedDate.month}/${selectedDate.year}'
                  : question.questionText,
              style: TextStyle(
                fontSize: 16,
                color: selectedDate != null ? Colors.black : Colors.grey[600],
              ),
            ),
            Icon(Icons.calendar_today, color: Colors.grey[600]),
          ],
        ),
      ),
    );
  }
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('${widget.eventType.name} - Questionnaire'),
        backgroundColor: Colors.orange,
      ),
      body: _isLoading
          ? Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        _error!,
                        style: TextStyle(color: Colors.red),
                        textAlign: TextAlign.center,
                      ),
                      SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: _fetchQuestionnaireItems,
                        child: Text('Retry'),
                      ),
                    ],
                  ),
                )
              : SingleChildScrollView(
                  padding: EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Questions
                      if (_questions.isNotEmpty) ...[
                        Text(
                          'Event Details',
                          style: Theme.of(context).textTheme.headlineSmall,
                        ),
                        SizedBox(height: 16),
                        
                        ..._questions.map((question) => Padding(
                          padding: EdgeInsets.only(bottom: 16),
                          child: _buildQuestionWidget(question),
                        )).toList(),
                      ],
                      
                      SizedBox(height: 16),
                      
                      // Special Requests
                      TextFormField(
                        controller: _specialRequestsController,
                        decoration: InputDecoration(
                          labelText: 'Special Requests (optional)',
                          border: OutlineInputBorder(),
                          hintText: 'Any special requirements or notes...',
                        ),
                        maxLines: 3,
                      ),
                      
                      SizedBox(height: 32),
                      
                      // Submit Button
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: _eventDate != null ? _submitEventRequest : null,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.orange,
                            padding: EdgeInsets.symmetric(vertical: 16),
                          ),
                          child: Text(
                            'Submit Event Request',
                            style: TextStyle(fontSize: 16),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
    );
  }
}