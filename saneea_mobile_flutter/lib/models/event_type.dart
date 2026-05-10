class EventType {
  final int id;
  final String name;
  final String? description;
  final bool isActive;
  final String? categoryId;
  final String? icon;  // Added icon field
  
  const EventType({
    required this.id,
    required this.name,
    this.description,
    required this.isActive,
    this.categoryId,
    this.icon,  // Added to constructor
  });
  
  factory EventType.fromJson(Map<String, dynamic> json) {
    return EventType(
      id: json['id'],
      name: json['name'],
      description: json['description'],
      isActive: json['isActive'] ?? true,
      categoryId: json['categoryId'],
      icon: json['icon'],  // Added to fromJson
    );
  }
  
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'description': description,
      'isActive': isActive,
      'categoryId': categoryId,
      'icon': icon,  // Added to toJson
    };
  }
}