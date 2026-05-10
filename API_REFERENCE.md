# Saneea API Reference

## Base URL
```
Development: http://localhost:5000
Production: https://yourdomain.com
```

## Authentication

All API endpoints use session-based authentication with cookies. After login, the session cookie is automatically included in subsequent requests.

### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "id": 1,
  "username": "admin",
  "email": "admin@example.com",
  "userType": "admin"
}
```

### Register
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "string",
  "email": "string",
  "password": "string",
  "userType": "client"
}
```

### Logout
```http
POST /api/auth/logout
```

### Get Current User
```http
GET /api/user
```

## Event Types

### Get All Event Types
```http
GET /api/event-types
```

**Response for Clients (active only):**
```json
[
  {
    "id": 1,
    "name": "Wedding",
    "description": "Wedding ceremony and reception",
    "isActive": true,
    "createdAt": "2025-06-15T00:00:00.000Z"
  }
]
```

### Get Event Type by ID
```http
GET /api/event-types/{id}
```

### Get Active Event Types
```http
GET /api/event-types/active
```

### Create Event Type (Admin Only)
```http
POST /api/event-types
Content-Type: application/json
Authorization: Admin session required

{
  "name": "Corporate Event",
  "description": "Business meetings and conferences",
  "isActive": true
}
```

### Update Event Type (Admin Only)
```http
PATCH /api/event-types/{id}
Content-Type: application/json

{
  "name": "Updated Event Name",
  "isActive": false
}
```

### Delete Event Type (Admin Only)
```http
DELETE /api/event-types/{id}
```

## Questionnaire Items

### Get Questionnaire for Event Type
```http
GET /api/event-types/{eventTypeId}/questionnaire-items
```

**Response:**
```json
[
  {
    "id": 1,
    "eventTypeId": 1,
    "question": "What is your preferred venue?",
    "questionType": "text",
    "options": null,
    "isRequired": true,
    "orderIndex": 1
  },
  {
    "id": 2,
    "eventTypeId": 1,
    "question": "Number of guests",
    "questionType": "number",
    "options": null,
    "isRequired": true,
    "orderIndex": 2
  },
  {
    "id": 3,
    "eventTypeId": 1,
    "question": "Catering preference",
    "questionType": "single_choice",
    "options": ["Buffet", "Plated", "Family Style"],
    "isRequired": false,
    "orderIndex": 3
  }
]
```

### Create Questionnaire Item (Admin Only)
```http
POST /api/questionnaire-items
Content-Type: application/json

{
  "eventTypeId": 1,
  "question": "What is your budget range?",
  "questionType": "single_choice",
  "options": ["$1000-5000", "$5000-10000", "$10000+"],
  "isRequired": true,
  "orderIndex": 4
}
```

**Question Types:**
- `text` - Single line text input
- `textarea` - Multi-line text input
- `number` - Numeric input
- `date` - Date picker
- `single_choice` - Dropdown/radio selection
- `multiple_choice` - Checkbox selection
- `boolean` - Yes/No radio buttons

### Update Questionnaire Item (Admin Only)
```http
PATCH /api/questionnaire-items/{id}
Content-Type: application/json

{
  "question": "Updated question text",
  "isRequired": false
}
```

### Delete Questionnaire Item (Admin Only)
```http
DELETE /api/questionnaire-items/{id}
```

## Bookings

### Get Client Bookings
```http
GET /api/bookings/client/{clientId}
```

**Response:**
```json
[
  {
    "id": 1,
    "clientId": 2,
    "eventTypeId": 1,
    "questionnaireResponses": {
      "venue": "Hotel Ballroom",
      "guests": 150,
      "catering": "Buffet",
      "date": "2025-08-15"
    },
    "status": "pending",
    "quotationDetails": null,
    "quotationNotes": null,
    "quotationValidUntil": null,
    "eventDate": "2025-08-15T18:00:00.000Z",
    "estimatedGuests": 150,
    "budgetRange": "$5000-10000",
    "createdAt": "2025-06-15T00:00:00.000Z",
    "updatedAt": "2025-06-15T00:00:00.000Z"
  }
]
```

### Create Booking
```http
POST /api/bookings
Content-Type: application/json

{
  "clientId": 2,
  "eventTypeId": 1,
  "questionnaireResponses": {
    "venue": "Hotel Ballroom",
    "guests": 150,
    "catering": "Buffet",
    "special_requests": "Vegetarian options needed"
  },
  "eventDate": "2025-08-15T18:00:00.000Z",
  "estimatedGuests": 150,
  "budgetRange": "$5000-10000"
}
```

### Get All Bookings (Admin Only)
```http
GET /api/admin/bookings
```

### Update Booking (Admin Only)
```http
PATCH /api/bookings/{id}
Content-Type: application/json

{
  "status": "confirmed",
  "quotationDetails": "Wedding package including venue, catering, and decoration",
  "quotationNotes": "Price includes tax and service charge",
  "quotationValidUntil": "2025-07-15T23:59:59.000Z"
}
```

**Booking Status Options:**
- `pending` - Awaiting admin review
- `confirmed` - Accepted by admin
- `completed` - Event finished
- `cancelled` - Booking cancelled

### Delete Booking (Admin Only)
```http
DELETE /api/admin/bookings/{id}
```

## Messages

### Get Conversations
```http
GET /api/conversations
```

**Response:**
```json
[
  {
    "userId": 2,
    "username": "client1",
    "lastMessage": {
      "id": 15,
      "senderId": 2,
      "receiverId": 1,
      "content": "Thank you for the quotation",
      "read": false,
      "createdAt": "2025-06-15T12:00:00.000Z"
    }
  }
]
```

### Get Messages with User
```http
GET /api/messages/{userId}
```

**Response:**
```json
[
  {
    "id": 14,
    "senderId": 1,
    "receiverId": 2,
    "content": "Here is your event quotation",
    "read": true,
    "createdAt": "2025-06-15T11:30:00.000Z"
  },
  {
    "id": 15,
    "senderId": 2,
    "receiverId": 1,
    "content": "Thank you for the quotation",
    "read": false,
    "createdAt": "2025-06-15T12:00:00.000Z"
  }
]
```

### Send Message
```http
POST /api/messages
Content-Type: application/json

{
  "receiverId": 1,
  "content": "I have a question about my booking"
}
```

### Mark Message as Read
```http
PATCH /api/messages/{id}/read
```

## User Management

### Get All Users (Admin Only)
```http
GET /api/admin/users
```

**Response:**
```json
[
  {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "userType": "admin",
    "createdAt": "2025-06-15T00:00:00.000Z"
  },
  {
    "id": 2,
    "username": "client1",
    "email": "client@example.com",
    "userType": "client",
    "createdAt": "2025-06-15T00:00:00.000Z"
  }
]
```

### Delete User (Admin Only)
```http
DELETE /api/admin/users/{id}
```

## Vendors (Future Feature)

### Get All Vendors
```http
GET /api/vendors
```

### Create Vendor
```http
POST /api/vendors
Content-Type: application/json

{
  "userId": 3,
  "businessName": "Elegant Events Co.",
  "category": "catering",
  "description": "Premium catering services",
  "contactPhone": "+1234567890",
  "location": "New York, NY"
}
```

## Health Check

### Health Status
```http
GET /api/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-06-15T00:00:00.000Z",
  "uptime": 86400,
  "environment": "production",
  "version": "1.0.0"
}
```

## WebSocket API

### Connection
```javascript
const ws = new WebSocket('ws://localhost:5000/ws');
// Production: wss://yourdomain.com/ws
```

### Authentication
```javascript
// Send authentication message after connection
ws.send(JSON.stringify({
  type: 'auth',
  senderId: userId,
  receiverId: 0,
  content: userId.toString(),
  timestamp: new Date()
}));
```

### Sending Messages
```javascript
ws.send(JSON.stringify({
  type: 'message',
  sender: userId,
  receiver: recipientId,
  content: 'Hello, I have a question',
  timestamp: new Date()
}));
```

### Receiving Messages
```javascript
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'message') {
    // Handle incoming message
    console.log('New message:', data.content);
  }
};
```

## Error Handling

### Standard Error Response
```json
{
  "message": "Error description",
  "status": 400
}
```

### Common HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (not logged in)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

### Validation Errors
```json
{
  "message": "Validation failed",
  "errors": [
    {
      "field": "username",
      "message": "Username is required"
    },
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

## Rate Limiting

### Limits
- **General API**: 100 requests per minute per IP
- **Authentication**: 5 requests per minute per IP
- **WebSocket**: 1000 messages per hour per user

### Rate Limit Headers
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1624523456
```

## Request/Response Examples

### Complete Booking Flow

#### 1. Get Event Types
```bash
curl -X GET "http://localhost:5000/api/event-types/active" \
  -H "Cookie: connect.sid=your-session-cookie"
```

#### 2. Get Questionnaire
```bash
curl -X GET "http://localhost:5000/api/event-types/1/questionnaire-items" \
  -H "Cookie: connect.sid=your-session-cookie"
```

#### 3. Submit Booking
```bash
curl -X POST "http://localhost:5000/api/bookings" \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=your-session-cookie" \
  -d '{
    "clientId": 2,
    "eventTypeId": 1,
    "questionnaireResponses": {
      "venue": "Hotel Ballroom",
      "guests": 150,
      "catering": "Buffet"
    },
    "eventDate": "2025-08-15T18:00:00.000Z",
    "estimatedGuests": 150
  }'
```

#### 4. Admin Updates Booking
```bash
curl -X PATCH "http://localhost:5000/api/bookings/1" \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=admin-session-cookie" \
  -d '{
    "status": "confirmed",
    "quotationDetails": "Complete wedding package - $8,500",
    "quotationValidUntil": "2025-07-15T23:59:59.000Z"
  }'
```

## SDK Examples

### JavaScript/TypeScript
```typescript
class SaneeaClient {
  private baseUrl: string;
  private sessionCookie: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async login(username: string, password: string) {
    const response = await fetch(`${this.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password })
    });
    return response.json();
  }

  async getEventTypes() {
    const response = await fetch(`${this.baseUrl}/api/event-types`, {
      credentials: 'include'
    });
    return response.json();
  }

  async createBooking(booking: BookingData) {
    const response = await fetch(`${this.baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(booking)
    });
    return response.json();
  }
}
```

### Flutter/Dart
```dart
class ApiService {
  static const String baseUrl = 'https://yourdomain.com';
  final Dio _dio = Dio();

  Future<User> login(String username, String password) async {
    final response = await _dio.post(
      '$baseUrl/api/auth/login',
      data: {'username': username, 'password': password},
      options: Options(
        headers: {'Content-Type': 'application/json'},
      ),
    );
    return User.fromJson(response.data);
  }

  Future<List<EventType>> getEventTypes() async {
    final response = await _dio.get('$baseUrl/api/event-types/active');
    return (response.data as List)
        .map((json) => EventType.fromJson(json))
        .toList();
  }
}
```

This comprehensive API reference covers all endpoints and usage patterns for the Saneea event management platform.