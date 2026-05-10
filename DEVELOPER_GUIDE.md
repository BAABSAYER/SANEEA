# Saneea Developer Guide

## Getting Started as a Developer

This guide helps you understand and work with the Saneea event management platform as a developer.

## Quick Start

### 1. Development Environment Setup

```bash
# Clone the project
git clone <your-repository-url>
cd saneea-platform

# Install Node.js dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials

# Initialize database
npm run db:push

# Start development server
npm run dev
```

### 2. Project Structure Overview

```
saneea-platform/
├── client/           # React web dashboard (TypeScript)
├── server/           # Node.js API backend (TypeScript)  
├── shared/           # Shared types and schemas
├── mobile/           # Flutter mobile app (Dart)
├── package.json      # Dependencies and scripts
└── README.md         # This guide
```

## Core Development Concepts

### 1. Database-First Development

**Schema Definition**: All database tables are defined in `shared/schema.ts`
```typescript
// Example: Adding a new table
export const newTable = pgTable("new_table", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow()
});
```

**Type Generation**: Types are automatically generated from schema
```typescript
export type NewTable = typeof newTable.$inferSelect;
export type InsertNewTable = typeof newTable.$inferInsert;
```

**Database Operations**: Use the storage interface in `server/storage.ts`
```typescript
// Add new methods to IStorage interface
async getNewTable(id: number): Promise<NewTable | undefined>;
async createNewTable(data: InsertNewTable): Promise<NewTable>;
```

### 2. API Development Pattern

**Route Structure**: All API routes are in `server/routes.ts`
```typescript
// Standard CRUD pattern
app.get('/api/items', async (req, res) => {
  const items = await storage.getAllItems();
  res.json(items);
});

app.post('/api/items', async (req, res) => {
  const newItem = await storage.createItem(req.body);
  res.json(newItem);
});
```

**Authentication**: Use middleware for protected routes
```typescript
app.get('/api/admin/items', requireAuth, requireAdmin, async (req, res) => {
  // Admin-only endpoint
});
```

### 3. Frontend Development

**Component Structure**: Use functional components with hooks
```typescript
// Standard component pattern
export function ItemList() {
  const { data: items, isLoading } = useQuery({
    queryKey: ['/api/items']
  });

  if (isLoading) return <div>Loading...</div>;
  
  return (
    <div>
      {items?.map(item => (
        <ItemCard key={item.id} item={item} />
      ))}
    </div>
  );
}
```

**Form Handling**: Use React Hook Form with Zod validation
```typescript
const form = useForm<InsertItem>({
  resolver: zodResolver(insertItemSchema)
});

const createItemMutation = useMutation({
  mutationFn: (data: InsertItem) => apiRequest('/api/items', 'POST', data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/items'] });
  }
});
```

### 4. Mobile Development

**Service Pattern**: API calls through service classes
```dart
class ItemService {
  final ApiService _apiService;
  
  Future<List<Item>> getItems() async {
    final response = await _apiService.get('/api/items');
    return (response.data as List).map((json) => Item.fromJson(json)).toList();
  }
}
```

**State Management**: Use Provider pattern
```dart
class ItemProvider extends ChangeNotifier {
  List<Item> _items = [];
  
  List<Item> get items => _items;
  
  Future<void> loadItems() async {
    _items = await _itemService.getItems();
    notifyListeners();
  }
}
```

## Common Development Tasks

### Adding a New Feature

1. **Define Database Schema** (`shared/schema.ts`)
2. **Add Storage Methods** (`server/storage.ts`)
3. **Create API Routes** (`server/routes.ts`)
4. **Build Frontend Components** (`client/src/components/`)
5. **Add Mobile Screens** (`mobile/lib/screens/`)
6. **Update Navigation** (both web and mobile)

### Example: Adding a "Categories" Feature

#### Step 1: Database Schema
```typescript
// shared/schema.ts
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow()
});

export type Category = typeof categories.$inferSelect;
export type InsertCategory = typeof categories.$inferInsert;
```

#### Step 2: Storage Interface
```typescript
// server/storage.ts - Add to IStorage interface
async getCategory(id: number): Promise<Category | undefined>;
async getAllCategories(): Promise<Category[]>;
async createCategory(category: InsertCategory): Promise<Category>;
async updateCategory(id: number, data: Partial<Category>): Promise<Category | undefined>;
async deleteCategory(id: number): Promise<void>;
```

#### Step 3: API Routes
```typescript
// server/routes.ts
app.get('/api/categories', async (req, res) => {
  const categories = await storage.getAllCategories();
  res.json(categories);
});

app.post('/api/categories', requireAuth, requireAdmin, async (req, res) => {
  const category = await storage.createCategory(req.body);
  res.json(category);
});
```

#### Step 4: Frontend Component
```typescript
// client/src/components/categories/category-list.tsx
export function CategoryList() {
  const { data: categories, isLoading } = useQuery({
    queryKey: ['/api/categories']
  });

  return (
    <div className="grid gap-4">
      {categories?.map(category => (
        <CategoryCard key={category.id} category={category} />
      ))}
    </div>
  );
}
```

#### Step 5: Mobile Screen
```dart
// mobile/lib/screens/categories_screen.dart
class CategoriesScreen extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Categories')),
      body: Consumer<CategoryProvider>(
        builder: (context, provider, child) {
          return ListView.builder(
            itemCount: provider.categories.length,
            itemBuilder: (context, index) {
              return CategoryTile(category: provider.categories[index]);
            },
          );
        },
      ),
    );
  }
}
```

## Development Workflow

### Daily Development Process

1. **Pull latest changes**
   ```bash
   git pull origin main
   ```

2. **Create feature branch**
   ```bash
   git checkout -b feature/category-management
   ```

3. **Make changes following the pattern above**

4. **Test your changes**
   ```bash
   npm run dev  # Test web app
   cd mobile && flutter run  # Test mobile app
   ```

5. **Commit and push**
   ```bash
   git add .
   git commit -m "feat: add category management system"
   git push origin feature/category-management
   ```

### Database Changes

```bash
# After modifying schema in shared/schema.ts
npm run db:push

# View database in GUI (optional)
npx drizzle-kit studio
```

### Code Quality

**TypeScript**: Enable strict mode and fix all type errors
```typescript
// Use proper typing
const user: User = await storage.getUser(id);
// Not: const user: any = await storage.getUser(id);
```

**Error Handling**: Always handle errors gracefully
```typescript
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  console.error('Operation failed:', error);
  throw new Error('User-friendly message');
}
```

**Validation**: Use Zod schemas for all inputs
```typescript
const createUserSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(8)
});
```

## Architecture Decisions

### Why These Technologies?

**TypeScript**: Type safety across the entire stack
**Drizzle ORM**: Type-safe database operations with great developer experience
**TanStack Query**: Powerful server state management with caching
**Shadcn/ui**: High-quality, customizable components
**Flutter**: Single codebase for iOS and Android with native performance

### Design Patterns Used

**Repository Pattern**: Storage interface abstracts database operations
**Provider Pattern**: Centralized state management in Flutter
**Compound Components**: Flexible UI components with multiple parts
**Custom Hooks**: Reusable logic in React components

## Troubleshooting

### Common Issues

**Port Already in Use**
```bash
# Kill process using port 5000
lsof -ti:5000 | xargs kill -9
# Or restart the workflow in Replit
```

**Database Connection Errors**
```bash
# Check DATABASE_URL is set
echo $DATABASE_URL
# Verify PostgreSQL is running
pg_isready
```

**TypeScript Errors**
```bash
# Run type checking
npm run check
# Fix errors before continuing development
```

**Mobile Build Errors**
```bash
# Clean and rebuild
cd mobile
flutter clean
flutter pub get
flutter run
```

### Getting Help

1. **Check Console Logs**: Browser dev tools and server logs
2. **Review Documentation**: This guide and DOCUMENTATION.md
3. **Check Database**: Use Drizzle Studio to inspect data
4. **Test API Endpoints**: Use curl or Postman to test backend

## Best Practices

### Code Organization

**File Naming**: Use consistent naming conventions
- Components: `PascalCase.tsx`
- Utilities: `kebab-case.ts`
- Constants: `UPPER_CASE.ts`

**Folder Structure**: Group related files together
```
components/
├── ui/           # Reusable UI components
├── features/     # Feature-specific components
└── layout/       # Layout components
```

### Performance

**Database**: Use indexes for frequently queried columns
**Frontend**: Lazy load components and use React.memo for expensive renders
**Mobile**: Optimize image sizes and use efficient list rendering

### Security

**Authentication**: Always validate user permissions
**Input Validation**: Sanitize all user inputs
**Environment Variables**: Never commit secrets to version control

## Deployment

### Development Deployment
```bash
# Already set up in Replit
npm run dev
```

### Production Deployment
```bash
# Build application
npm run build

# Start production server
NODE_ENV=production npm start
```

### Mobile App Deployment
```bash
# Android
flutter build appbundle --release

# iOS
flutter build ios --release
```

## Configuration Reference

### Environment Variables
```bash
# Required
DATABASE_URL=postgresql://user:pass@host:port/db
SESSION_SECRET=random-secret-string
PORT=5000

# Optional
NODE_ENV=development
DOCKER_CONTAINER=false
```

### Key Files
- `package.json` - Dependencies and scripts
- `vite.config.ts` - Frontend build configuration
- `drizzle.config.ts` - Database configuration
- `tailwind.config.ts` - Styling configuration

This guide provides everything you need to start developing with the Saneea platform. The architecture is designed to be scalable and maintainable, with clear separation of concerns between the database, API, web frontend, and mobile app.