# AI Chat Electron App

An Electron application with React that uses Vercel AI SDK to chat with OpenAI.

## Setup

1. Install dependencies:

```bash
pnpm install
```

2. Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

3. Add your OpenAI API key to the `.env` file:

```
OPENAI_API_KEY=your-actual-api-key-here
```

## Running the app

```bash
pnpm start
```

## Database

This project uses Drizzle ORM with SQLite for local data persistence.

### Database Setup

The database is automatically created when you run the application for the first time at:
- macOS: `~/Library/Application Support/archestra/archestra.db`
- Windows: `%APPDATA%\archestra\archestra.db`
- Linux: `~/.config/archestra/archestra.db`

### Working with Drizzle

#### View and Manage Database

Use Drizzle Studio to browse and manage your database:

```bash
pnpm exec drizzle-kit studio
```

#### Generate Migrations

After modifying schema files, generate a new migration:

```bash
pnpm exec drizzle-kit generate
```

This creates migration files in `src/backend/database/migrations/`.

#### Apply Migrations

Migrations are automatically applied when the app starts. To manually apply:

```bash
pnpm exec drizzle-kit migrate
```

#### Push Schema Changes (Development)

For quick development iterations without generating migrations:

```bash
pnpm exec drizzle-kit push
```

⚠️ **Warning**: Only use `push` in development. Always use migrations for production.

#### Common Database Commands

```bash
# Check current schema status
pnpm exec drizzle-kit check

# Drop all tables (careful!)
pnpm exec drizzle-kit drop

# Create a database snapshot
pnpm exec drizzle-kit snapshot
```

## Features

- Electron desktop application
- React frontend with useChat hook from Vercel AI SDK
- Express backend server integrated with Electron
- Streaming chat responses from OpenAI
- Clean, responsive UI

## Tech Stack

- Electron
- React
- TypeScript
- Express.js
- Vercel AI SDK
- OpenAI API
