# Saneea Mobile App

Smart Event Management Platform

## Overview

Saneea is a comprehensive event management platform with features for clients, vendors, and administrators.

## Features

- User authentication with client and vendor roles
- Event category selection and custom event planning
- Booking management system
- Real-time messaging between users
- Multi-language support (English/Arabic with RTL)
- API integration with central server

## Development Setup

1. **Install Dependencies:**
   ```
   flutter pub get
   ```

2. **Run Development Build:**
   ```
   flutter run
   ```

3. **Build Release Version:**
   ```
   flutter build apk --release
   ```
   or
   ```
   flutter build ios --release
   ```

## Project Structure

- `lib/`: Application source code
  - `models/`: Data models
  - `screens/`: UI screens
  - `widgets/`: Reusable UI components
  - `providers/`: State management
  - `services/`: API and backend services
  - `utils/`: Utility functions
  - `config/`: Configuration settings
  - `l10n/`: Localization resources

- `assets/`: Static resources
  - `images/`: Images and graphics
  - `icons/`: App icons
  - `fonts/`: Custom fonts
  - `lang/`: Language files

## Mobile App Configuration

The mobile app is configured to connect to the backend server. The API endpoints
are defined in `lib/config/api_config.dart`. Update the endpoints as needed for 
your deployment environment.
