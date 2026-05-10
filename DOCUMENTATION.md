# Saneea Event Management Platform - Complete Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [System Architecture](#system-architecture)
3. [Technology Stack](#technology-stack)
4. [Project Structure](#project-structure)
5. [Database Schema](#database-schema)
6. [API Documentation](#api-documentation)
7. [Frontend Components](#frontend-components)
8. [Mobile Application](#mobile-application)
9. [Authentication & Security](#authentication--security)
10. [Real-time Features](#real-time-features)
11. [Configuration Guide](#configuration-guide)
12. [Deployment Guide](#deployment-guide)
13. [Development Workflow](#development-workflow)

## Project Overview

Saneea is a comprehensive event management platform that connects clients with event organizers through a seamless mobile and web interface. The platform enables:

- **Clients**: Submit event requests through mobile app with custom questionnaires
- **Administrators**: Manage events, create quotations, and communicate with clients via web dashboard
- **Vendors**: Provide services and manage bookings (future feature)

### Key Features
- Multi-platform support (Web dashboard + Mobile app)
- Dynamic questionnaire system based on event types
- Real-time messaging between clients and administrators
- Session-based authentication with role management
- Responsive design with RTL language support
- PostgreSQL database with type-safe operations

## System Architecture

### High-Level Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│                 │    │                 │    │                 │
│   Flutter App   │◄──►│  Node.js API    │◄──►│   PostgreSQL    │
│   (Mobile)      │    │   (Backend)     │    │   (Database)    │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         ▲                        ▲
         │                        │
         ▼                        ▼
┌─────────────────┐    ┌─────────────────┐
│                 │    │                 │
│   React Web     │    │   WebSocket     │
│  (Dashboard)    │    │  (Real-time)    │
│                 │    │                 │
└─────────────────┘    └─────────────────┘
```

### Data Flow
1. **Client Registration**: Mobile app → API → Database
2. **Event Submission**: Mobile questionnaire → API validation → Database storage
3. **Admin Processing**: Web dashboard → API → Database updates
4. **Real-time Communication**: WebSocket connections for instant messaging
5. **Session Management**: Cookie-based authentication across platforms

## Technology Stack

### Backend
- **Runtime**: Node.js 20+
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL 14+
- **ORM**: Drizzle ORM with Drizzle Kit
- **Authentication**: Passport.js (Local Strategy)
- **Session Store**: connect-pg-simple
- **Real-time**: WebSocket (ws library)
- **Validation**: Zod schemas
- **Build Tool**: ESBuild

### Frontend (Web Dashboard)
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Routing**: Wouter
- **State Management**: TanStack Query (React Query)
- **UI Components**: Shadcn/ui + Radix UI
- **Styling**: Tailwind CSS
- **Forms**: React Hook Form + Zod validation
- **Icons**: Lucide React

### Mobile Application
- **Framework**: Flutter 3.0+
- **Language**: Dart
- **State Management**: Provider pattern
- **HTTP Client**: Custom API service
- **Local Storage**: SharedPreferences
- **Internationalization**: Flutter intl with ARB files

### Development Tools
- **Package Manager**: npm
- **Type Checking**: TypeScript
- **Database Migrations**: Drizzle Kit
- **Development Server**: tsx (TypeScript execution)
- **Linting**: ESLint (implicit)
- **CSS Processing**: PostCSS + Tailwind

## Project Structure

```
saneea-platform/
├── client/                     # React web dashboard
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   │   ├── ui/            # Shadcn UI components
│   │   │   ├── auth/          # Authentication forms
│   │   │   ├── chat/          # Chat interface components
│   │   │   ├── layout/        # Layout components
│   │   │   └── ...
│   │   ├── hooks/             # Custom React hooks
│   │   ├── lib/               # Utility functions and configurations
│   │   ├── pages/             # Page components
│   │   │   ├── admin/         # Admin dashboard pages
│   │   │   ├── vendor/        # Vendor pages (future)
│   │   │   └── ...
│   │   ├── assets/            # Static assets
│   │   └── i18n/              # Internationalization files
│   └── ...
├── server/                     # Node.js backend
│   ├── auth.ts                # Passport.js authentication setup
│   ├── db.ts                  # Database connection
│   ├── index.ts               # Main server entry point
│   ├── routes.ts              # API routes and WebSocket handling
│   ├── storage.ts             # Database operations interface
│   └── vite.ts                # Vite development server integration
├── shared/                     # Shared code between client and server
│   └── schema.ts              # Database schema and types
├── mobile/                     # Flutter mobile application
│   ├── lib/
│   │   ├── models/            # Data models
│   │   ├── providers/         # State management
│   │   ├── screens/           # UI screens
│   │   ├── services/          # API and business logic services
│   │   ├── widgets/           # Reusable widgets
│   │   └── ...
│   ├── assets/                # Mobile app assets
│   └── ...
├── package.json               # Node.js dependencies and scripts
├── vite.config.ts             # Vite configuration
├── tailwind.config.ts         # Tailwind CSS configuration
├── drizzle.config.ts          # Drizzle ORM configuration
└── .replit                    # Replit platform configuration
```

## Database Schema

### Core Tables

#### Users Table
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  user_type VARCHAR(50) NOT NULL DEFAULT 'client',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Event Types Table
```sql
CREATE TABLE event_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Questionnaire Items Table
```sql
CREATE TABLE questionnaire_items (
  id SERIAL PRIMARY KEY,
  event_type_id INTEGER REFERENCES event_types(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  question_type VARCHAR(50) NOT NULL,
  options TEXT[], -- JSON array for multiple choice options
  is_required BOOLEAN DEFAULT false,
  order_index INTEGER DEFAULT 0
);
```

#### Bookings Table (Unified Events)
```sql
CREATE TABLE bookings (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES users(id),
  event_type_id INTEGER REFERENCES event_types(id),
  questionnaire_responses JSONB, -- Structured questionnaire answers
  status VARCHAR(50) DEFAULT 'pending',
  quotation_details TEXT,
  quotation_notes TEXT,
  quotation_valid_until TIMESTAMP,
  event_date TIMESTAMP,
  estimated_guests INTEGER,
  budget_range VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Messages Table
```sql
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  sender_id INTEGER REFERENCES users(id),
  receiver_id INTEGER REFERENCES users(id),
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Relationships
- **Users** → **Bookings** (One-to-Many): A user can have multiple bookings
- **Event Types** → **Questionnaire Items** (One-to-Many): Each event type has custom questions
- **Event Types** → **Bookings** (One-to-Many): Bookings are categorized by event type
- **Users** → **Messages** (Many-to-Many): Users can send/receive messages

## API Documentation

### Authentication Endpoints

#### POST /api/auth/login
```json
Request:
{
  "username": "string",
  "password": "string"
}

Response:
{
  "id": 1,
  "username": "admin",
  "email": "admin@example.com",
  "userType": "admin"
}
```

#### POST /api/auth/register
```json
Request:
{
  "username": "string",
  "email": "string",
  "password": "string",
  "userType": "client"
}

Response:
{
  "id": 2,
  "username": "newuser",
  "email": "user@example.com",
  "userType": "client"
}
```

#### POST /api/auth/logout
```
Response: 200 OK
```

#### GET /api/user
```json
Response:
{
  "id": 1,
  "username": "admin",
  "email": "admin@example.com",
  "userType": "admin"
}
```

### Event Management Endpoints

#### GET /api/event-types
Returns active event types for clients, all event types for admins.

#### GET /api/event-types/:id/questionnaire-items
```json
Response:
[
  {
    "id": 1,
    "question": "What is your preferred venue?",
    "questionType": "text",
    "isRequired": true,
    "orderIndex": 1
  }
]
```

#### POST /api/event-types (Admin only)
```json
Request:
{
  "name": "Wedding",
  "description": "Wedding ceremony and reception",
  "isActive": true
}
```

#### POST /api/questionnaire-items (Admin only)
```json
Request:
{
  "eventTypeId": 1,
  "question": "Number of guests?",
  "questionType": "number",
  "isRequired": true,
  "orderIndex": 2
}
```

### Booking Management Endpoints

#### GET /api/bookings/client/:clientId
Returns all bookings for a specific client.

#### POST /api/bookings
```json
Request:
{
  "clientId": 2,
  "eventTypeId": 1,
  "questionnaireResponses": {
    "venue": "Hotel Ballroom",
    "guests": 150,
    "date": "2025-08-15"
  },
  "eventDate": "2025-08-15T18:00:00Z",
  "estimatedGuests": 150
}
```

#### PATCH /api/bookings/:id (Admin only)
Update booking status and add quotation details.

### Messaging Endpoints

#### GET /api/conversations
Returns list of conversations for the current user.

#### GET /api/messages/:userId
Returns messages between current user and specified user.

#### POST /api/messages
```json
Request:
{
  "receiverId": 1,
  "content": "Hello, I have a question about my booking."
}
```

### Admin Endpoints

#### GET /api/admin/users
Returns all users (admin only).

#### GET /api/admin/bookings
Returns all bookings with client details (admin only).

#### DELETE /api/admin/bookings/:id
Cancel/delete a booking (admin only).

## Frontend Components

### Component Architecture

#### Layout Components
- **AdminLayout**: Sidebar navigation for admin pages
- **Header**: Top navigation with user info and logout
- **BottomNavigation**: Mobile-style bottom tabs

#### UI Components (Shadcn/ui)
- **Button**: Customizable button with variants
- **Input**: Form input fields with validation
- **Dialog**: Modal dialogs for confirmations
- **Table**: Data tables with sorting
- **Form**: Form wrapper with validation
- **Toast**: Notification system

#### Business Components
- **BookingCard**: Display booking information
- **ChatWindow**: Real-time messaging interface
- **EventTypeCategories**: Event type selection
- **AuthForms**: Login and registration forms

### State Management

#### TanStack Query Usage
```typescript
// Fetching data
const { data: bookings, isLoading } = useQuery({
  queryKey: ['/api/bookings'],
});

// Mutations with cache invalidation
const createBookingMutation = useMutation({
  mutationFn: (booking) => apiRequest('/api/bookings', 'POST', booking),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
  }
});
```

#### Authentication Context
```typescript
const { user, isLoading, loginMutation, logoutMutation } = useAuth();
```

### Routing Structure
```
/ → Home/Login page
/admin → Admin dashboard
/admin/bookings → Booking management
/admin/events → Event type management
/admin/messages → Message center
/admin/users → User management
/client/home → Client dashboard
/vendor/dashboard → Vendor area (future)
```

## Mobile Application

### Architecture

#### Providers (State Management)
- **AuthProvider**: User authentication state
- **BookingProvider**: Booking management
- **MessageProvider**: Chat functionality
- **EventProvider**: Event type data

#### Services
- **ApiService**: HTTP client with session handling
- **AuthService**: Authentication operations
- **BookingService**: Event booking operations
- **MessageService**: Real-time messaging

#### Screen Structure
```
lib/screens/
├── auth/
│   ├── login_screen.dart
│   └── register_screen.dart
├── home/
│   ├── home_screen.dart
│   └── event_category_screen.dart
├── booking/
│   ├── questionnaire_screen.dart
│   └── bookings_screen.dart
├── chat/
│   ├── messages_screen.dart
│   └── chat_screen.dart
└── main_screen.dart (Tab navigation)
```

### Key Features

#### Multi-language Support
```dart
// ARB files for internationalization
app_en.arb - English translations
app_ar.arb - Arabic translations with RTL support
```

#### Dynamic Questionnaire System
```dart
// Supports multiple question types:
- text: Single line text input
- textarea: Multi-line text input
- number: Numeric input with validation
- date: Date picker
- single_choice: Dropdown selection
- multiple_choice: Checkbox list
- boolean: Yes/No radio buttons
```

#### Real-time Messaging
```dart
// WebSocket integration for instant messaging
WebSocketService connects to /ws endpoint
Automatic reconnection on connection loss
Message persistence in local storage
```

## Authentication & Security

### Session-based Authentication

#### Server Configuration
```typescript
app.use(session({
  store: new (connectPgSimple(session))({
    pool: pool, // PostgreSQL connection pool
    tableName: 'session'
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));
```

#### Password Security
- **Hashing**: Node.js crypto.scrypt with salt
- **Salt Generation**: Random 32-byte salt per password
- **Verification**: Constant-time comparison to prevent timing attacks

#### Role-based Access Control
```typescript
// User types
CLIENT = 'client'    // Mobile app users
ADMIN = 'admin'      // Web dashboard administrators  
VENDOR = 'vendor'    // Service providers (future)

// Permission checking
const requireAdmin = (req, res, next) => {
  if (!req.isAuthenticated() || req.user.userType !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};
```

### Mobile App Security
- **Session Cookies**: Automatic handling via HTTP client
- **Secure Storage**: SharedPreferences for user data
- **API Validation**: Request/response validation on all endpoints
- **Network Security**: HTTPS enforcement in production

## Real-time Features

### WebSocket Implementation

#### Server Setup
```typescript
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

wss.on('connection', (ws: WebSocket) => {
  ws.on('message', async (message: string) => {
    const data = JSON.parse(message);
    
    if (data.type === 'auth') {
      // Authenticate WebSocket connection
      userId = parseInt(data.content);
      connections.push({ userId, socket: ws });
    }
    
    if (data.type === 'message') {
      // Store message in database
      const savedMessage = await storage.createMessage(messageData);
      
      // Broadcast to recipient
      const recipientSocket = connections.find(c => c.userId === data.receiverId);
      if (recipientSocket) {
        recipientSocket.socket.send(JSON.stringify(savedMessage));
      }
    }
  });
});
```

#### Client Integration
```typescript
// React hook for WebSocket
const { sendMessage, conversations, status } = useWebSocket();

// Flutter WebSocket service  
class MessageService {
  WebSocketChannel? _channel;
  
  void connect() {
    _channel = WebSocketChannel.connect(Uri.parse('ws://server/ws'));
    _channel!.stream.listen(_handleMessage);
  }
}
```

### Message Persistence
- **Database Storage**: All messages stored in PostgreSQL
- **Real-time Sync**: WebSocket broadcasts with database backup
- **Offline Support**: Messages queued when connection unavailable
- **Read Status**: Message read/unread tracking

## Configuration Guide

### Environment Variables

#### Required Variables
```bash
# Database
DATABASE_URL=postgresql://username:password@host:port/database

# Server
PORT=5000
NODE_ENV=development

# Session Security
SESSION_SECRET=your-secure-random-string-here

# Optional for production
DOCKER_CONTAINER=true
DOMAIN=yourdomain.com
```

#### Development Setup
```bash
# Install dependencies
npm install

# Set up database
npm run db:push

# Start development server
npm run dev
```

#### Production Environment
```bash
# Build application
npm run build

# Start production server
npm start
```

### Database Configuration

#### Connection Setup
```typescript
// server/db.ts
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});
export const db = drizzle(pool, { schema });
```

#### Migration Commands
```bash
# Push schema changes to database
npm run db:push

# Generate migration files (if needed)
npx drizzle-kit generate

# Apply migrations
npx drizzle-kit push
```

### Mobile App Configuration

#### API Endpoint Configuration
```dart
// lib/services/api_service.dart
class ApiService {
  static const String baseUrl = 'https://your-server.com';
  // Update this URL for your production server
}
```

#### Build Configuration
```yaml
# pubspec.yaml
name: saneea_mobile_flutter
description: Saneea Event Management Mobile App
version: 1.0.0+1

flutter:
  uses-material-design: true
  generate: true # Enable internationalization
```

## Deployment Guide

### Platform Options

#### 1. Traditional VPS/Cloud Server
```bash
# System requirements
- Ubuntu 20.04+ or similar Linux distribution
- Node.js 20+
- PostgreSQL 14+
- Nginx (recommended for reverse proxy)
- SSL certificate (Let's Encrypt)

# Installation steps
1. Clone repository
2. Install Node.js and PostgreSQL
3. Set environment variables
4. Run npm install && npm run build
5. Configure Nginx reverse proxy
6. Set up SSL certificate
7. Start application with PM2 or systemd
```

#### 2. Platform-as-a-Service (Heroku, Railway, Render)
```bash
# Heroku deployment
1. Create Heroku app
2. Add PostgreSQL addon
3. Set environment variables
4. Deploy via Git push
5. Run database migrations

# Railway/Render
1. Connect GitHub repository
2. Set environment variables
3. Deploy automatically on push
```

### Mobile App Deployment

#### Android (Google Play Store)
```bash
# Build release APK
flutter build apk --release

# Build App Bundle (recommended)
flutter build appbundle --release

# Generate signing key
keytool -genkey -v -keystore ~/upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

#### iOS (App Store)
```bash
# Build for iOS
flutter build ios --release

# Create archive in Xcode
1. Open ios/Runner.xcworkspace
2. Select "Any iOS Device" target  
3. Product → Archive
4. Upload to App Store Connect
```

### Production Checklist

#### Security
- [ ] SSL/TLS certificate installed
- [ ] Environment variables secured
- [ ] Database passwords changed from defaults
- [ ] Session secret is random and secure
- [ ] CORS configured for production domains
- [ ] Rate limiting enabled
- [ ] Input validation on all endpoints

#### Performance  
- [ ] Database indexes created
- [ ] Static files served by CDN or web server
- [ ] Gzip compression enabled
- [ ] Database connection pooling configured
- [ ] WebSocket connection limits set

#### Monitoring
- [ ] Error tracking service configured
- [ ] Application monitoring set up
- [ ] Database backup automated
- [ ] Health check endpoints working
- [ ] Log aggregation configured

#### Legal & Compliance
- [ ] Privacy policy published
- [ ] Terms of service available
- [ ] Cookie consent implemented (if required)
- [ ] Data retention policies defined

## Development Workflow

### Local Development Setup

#### Prerequisites
```bash
# Required software
- Node.js 20+
- PostgreSQL 14+
- Flutter 3.0+ (for mobile development)
- Git
- Code editor (VS Code recommended)
```

#### Initial Setup
```bash
# 1. Clone repository
git clone <repository-url>
cd saneea-platform

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your database credentials

# 4. Set up database
createdb saneea_development
npm run db:push

# 5. Start development server
npm run dev

# 6. Set up mobile development (optional)
cd mobile
flutter pub get
flutter run
```

### Development Commands

#### Backend Development
```bash
# Start development server
npm run dev

# Type checking
npm run check

# Build for production
npm run build

# Database operations
npm run db:push        # Push schema changes
npx drizzle-kit studio # Database GUI
```

#### Mobile Development
```bash
cd mobile

# Get dependencies
flutter pub get

# Run on emulator/device
flutter run

# Build for testing
flutter build apk --debug
flutter build ios --debug

# Generate app icons
flutter pub run flutter_launcher_icons:main

# Update translations
flutter gen-l10n
```

### Code Organization Standards

#### File Naming Conventions
```
- Use kebab-case for files: user-profile.tsx
- Use PascalCase for components: UserProfile.tsx  
- Use camelCase for functions and variables: getUserData()
- Use UPPER_CASE for constants: API_BASE_URL
```

#### Import Organization
```typescript
// 1. External libraries
import React from 'react';
import { useQuery } from '@tanstack/react-query';

// 2. Internal utilities
import { cn } from '@/lib/utils';

// 3. Components
import { Button } from '@/components/ui/button';

// 4. Types
import type { User } from '@/shared/schema';
```

#### Error Handling Patterns
```typescript
// API error handling
try {
  const response = await apiRequest('/api/endpoint');
  return response;
} catch (error) {
  console.error('Operation failed:', error);
  throw new Error('User-friendly error message');
}

// React error boundaries for UI errors
// Query error handling via TanStack Query
const { data, error, isLoading } = useQuery({
  queryKey: ['/api/data'],
  retry: 3,
  onError: (error) => {
    toast.error('Failed to load data');
  }
});
```

### Testing Guidelines

#### Backend Testing
```bash
# Unit tests for API endpoints
# Integration tests for database operations  
# Authentication flow testing
# WebSocket connection testing
```

#### Frontend Testing
```bash
# Component testing with React Testing Library
# Integration testing for user flows
# Accessibility testing
# Cross-browser compatibility
```

#### Mobile Testing
```bash
# Widget testing for UI components
# Integration testing for API calls
# Platform-specific testing (iOS/Android)
# Performance testing on real devices
```

### Git Workflow

#### Branch Naming
```bash
feature/user-authentication
bugfix/websocket-connection
hotfix/security-patch
release/v1.0.0
```

#### Commit Messages
```bash
feat: add user registration endpoint
fix: resolve WebSocket connection issues  
docs: update API documentation
refactor: improve database query performance
test: add unit tests for auth service
```

This documentation provides a comprehensive guide for understanding, configuring, and maintaining the Saneea event management platform. For specific implementation questions or troubleshooting, refer to the code comments and inline documentation throughout the project.
