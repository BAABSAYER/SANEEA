class QuestionnaireItem {
  final int id;
  final int eventTypeId;
  final String questionText;
  final String answerType; // text, number, boolean, select
  final List<String>? options; // For select type questions
  final bool isRequired;
  final int orderIndex;
  
  // Aliased properties to match error references
  String get question => questionText;
  bool get required => isRequired;
  int get displayOrder => orderIndex;
  String get questionType => answerType;
  String get type => answerType;
  
  const QuestionnaireItem({
    required this.id,
    required this.eventTypeId,
    required this.questionText,
    required this.answerType,
    this.options,
    required this.isRequired,
    required this.orderIndex,
  });
  
  factory QuestionnaireItem.fromJson(Map<String, dynamic> json) {
    return QuestionnaireItem(
      id: json['id'] as int,
      eventTypeId: json['eventTypeId'] as int,
      questionText: json['questionText'] as String? ?? '',
      answerType: json['questionType'] as String? ?? 'text', // Database uses questionType
      options: json['options'] != null 
          ? List<String>.from(json['options']) 
          : null,
      isRequired: json['required'] as bool? ?? false, // Database uses required
      orderIndex: json['displayOrder'] as int? ?? 0, // Database uses displayOrder
    );
  }
  
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'eventTypeId': eventTypeId,
      'questionText': questionText,
      'answerType': answerType,
      'options': options,
      'isRequired': isRequired,
      'orderIndex': orderIndex,
    };
  }
}