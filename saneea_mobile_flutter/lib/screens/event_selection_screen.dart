import 'package:flutter/material.dart';
import '../config/api_config.dart';
import '../models/event_type.dart';
import '../services/auth_service.dart';
import 'questionnaire_screen.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:provider/provider.dart';

class EventSelectionScreen extends StatefulWidget {
  const EventSelectionScreen({Key? key}) : super(key: key);

  @override
  _EventSelectionScreenState createState() => _EventSelectionScreenState();
}

class _EventSelectionScreenState extends State<EventSelectionScreen> {
  List<EventType> _eventTypes = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetchEventTypes();
  }

  Future<void> _fetchEventTypes() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final authService = Provider.of<AuthService>(context, listen: false);
      
      final response = await authService.apiService.get(
        ApiConfig.eventTypesEndpoint
      );

      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body);
        setState(() {
          _eventTypes = data.map((item) => EventType.fromJson(item)).toList();
          _isLoading = false;
        });
      } else {
        setState(() {
          _error = 'Failed to load event types. Please try again later.';
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

  void _selectEventType(EventType eventType) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (context) => QuestionnaireScreen(eventType: eventType),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Select Event Type', style: TextStyle(fontFamily: 'Almarai')),
        centerTitle: true,
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null) {
      return Center(
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
              onPressed: _fetchEventTypes,
              child: const Text('Try Again'),
            ),
          ],
        ),
      );
    }

    if (_eventTypes.isEmpty) {
      return const Center(
        child: Text(
          'No event types available at the moment.\nPlease check back later.',
          textAlign: TextAlign.center,
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'What type of event are you planning?',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              fontFamily: 'Almarai',
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),
          Expanded(
            child: GridView.builder(
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                childAspectRatio: 1.0,
                crossAxisSpacing: 16,
                mainAxisSpacing: 16,
              ),
              itemCount: _eventTypes.length,
              itemBuilder: (context, index) {
                final eventType = _eventTypes[index];
                return _buildEventTypeCard(eventType);
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEventTypeCard(EventType eventType) {
    return Card(
      elevation: 4,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
      ),
      child: InkWell(
        onTap: () => _selectEventType(eventType),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                eventType.icon ?? '📅',
                style: const TextStyle(fontSize: 40),
              ),
              const SizedBox(height: 16),
              Text(
                eventType.name,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  fontFamily: 'Almarai',
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                eventType.description ?? '',
                style: const TextStyle(
                  fontSize: 12,
                  color: Colors.grey,
                  fontFamily: 'Almarai',
                ),
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}