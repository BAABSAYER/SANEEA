class EventCategory {
  final String id;
  final String name;
  final String? icon;
  final String? description;
  
  const EventCategory({
    required this.id,
    required this.name,
    this.icon,
    this.description,
  });
  
  factory EventCategory.fromJson(Map<String, dynamic> json) {
    return EventCategory(
      id: json['id'],
      name: json['name'],
      icon: json['icon'],
      description: json['description'],
    );
  }
  
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'icon': icon,
      'description': description,
    };
  }
}