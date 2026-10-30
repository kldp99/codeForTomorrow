# 💬 Chat Backend API

A production-ready chat backend built with **Node.js**, **Express**, **TypeScript (strict mode)**, **PostgreSQL**, and **Firebase Firestore**.

---

## Table of Contents

- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Setup & Installation](#setup--installation)
- [Firebase Setup](#firebase-setup)
- [Running the Server](#running-the-server)
- [API Reference](#api-reference)
- [Postman Collection](#postman-collection)
- [Project Structure](#project-structure)
- [Design Decisions](#design-decisions)

---

## Architecture

| Layer | Technology | Purpose |
|---|---|---|
| HTTP server | Express 4 + TypeScript | REST API routing |
| Relational data | PostgreSQL | Users, chats, membership |
| Message storage | Firebase Firestore | Messages, read receipts, timestamps |
| Validation | Joi | Request body/params/query validation |
| Security | Helmet, CORS, express-rate-limit | HTTP hardening |

**Data split rationale:**
- **PostgreSQL** stores structural data: who belongs to which chat. This enables fast joins and strict relational constraints (FK, unique constraints).
- **Firestore** stores time-series message data. Its real-time capabilities, `serverTimestamp()`, and `arrayUnion` for read receipts make it ideal for high-volume chat messages.

---

## Prerequisites

- Node.js ≥ 18
- PostgreSQL ≥ 14
- Firebase project with Firestore enabled
- A Firebase service account JSON

---

## Setup & Installation

### 1. Clone and install dependencies

```bash
git clone <repo-url>
cd chat-backend
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` with your actual values:

```env
# Server
PORT=3000
NODE_ENV=development

# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=chat_db
DB_USER=postgres
DB_PASSWORD=your_password

# Firebase (choose one option below)
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
# OR use inline vars:
# FIREBASE_PROJECT_ID=...
# FIREBASE_CLIENT_EMAIL=...
# FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### 3. Create the PostgreSQL database

```sql
CREATE DATABASE chat_db;
```

### 4. Run database migrations

```bash
npm run migrate
```

This will:
- Create the `users`, `chats`, and `chat_members` tables
- Create indexes and triggers
- Insert 3 seed users for testing (Alice, Bob, Carol)

---

## Firebase Setup

1. Go to the [Firebase Console](https://console.firebase.google.com)
2. Create a new project (or use an existing one)
3. Enable **Firestore Database** (start in test mode for development)
4. Go to **Project Settings → Service accounts**
5. Click **Generate new private key** — download the JSON file
6. Place it at the project root and name it `firebase-service-account.json`
7. Set `FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json` in `.env`

**Firestore Data Structure:**
```
chats/
  {chatId}/
    messages/
      {messageId}/
        chat_id: string
        sender_id: string
        content: string
        timestamp: Timestamp
        read_by: string[]
        deleted: boolean
```

---

## Running the Server

```bash
# Development (with hot reload)
npm run dev

# Production
npm run build
npm start

# TypeScript type check (no emit)
npm run typecheck
```

Server starts at: `http://localhost:3000`

---

## API Reference

All API endpoints are prefixed with `/api/v1`.

### Authentication

All requests support an optional `x-user-id` header. This is used for access control checks (e.g., verifying a sender is a member of a chat).

---

### `POST /api/v1/chat/create`

Create a new 1:1 chat between two users. Returns the existing chat if one already exists (duplicate prevention).

**Request Body:**
```json
{
  "user1_id": "00000000-0000-0000-0000-000000000001",
  "user2_id": "00000000-0000-0000-0000-000000000002"
}
```

**Response `201` (created):**
```json
{
  "success": true,
  "data": {
    "chat_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "created": true,
    "members": [
      "00000000-0000-0000-0000-000000000001",
      "00000000-0000-0000-0000-000000000002"
    ]
  }
}
```

**Response `200` (already exists):**
```json
{
  "success": true,
  "data": {
    "chat_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "created": false,
    "members": ["..."]
  }
}
```

---

### `POST /api/v1/chat/:chatId/message/send`

Send a message in a chat. The message is stored in Firestore with a server-side timestamp.

**Request Body:**
```json
{
  "sender_id": "00000000-0000-0000-0000-000000000001",
  "content": "Hello, World!"
}
```

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "message_id": "KxZ8a1bQ3rTqYpN2mJwL",
    "chat_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "sender_id": "00000000-0000-0000-0000-000000000001",
    "content": "Hello, World!",
    "timestamp": "2026-10-27T02:14:31.000Z"
  }
}
```

---

### `GET /api/v1/chat/:chatId/messages?limit=50`

Fetch paginated messages for a chat, ordered by timestamp descending (newest first).

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `limit` | integer | 50 | Number of messages per page (max 100) |
| `before` | string | — | Firestore document ID for cursor-based pagination |

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": "KxZ8a1bQ3rTqYpN2mJwL",
        "chat_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        "sender_id": "00000000-0000-0000-0000-000000000001",
        "content": "Hello, World!",
        "timestamp": "2026-10-27T02:14:31.000Z",
        "read_by": ["00000000-0000-0000-0000-000000000001"]
      }
    ],
    "has_more": false,
    "next_cursor": null
  }
}
```

**Pagination example:**
```
GET /api/v1/chat/{chatId}/messages?limit=10
→ next_cursor: "KxZ8a1bQ3rTqYpN2mJwL"

GET /api/v1/chat/{chatId}/messages?limit=10&before=KxZ8a1bQ3rTqYpN2mJwL
→ next page of results
```

---

### `POST /api/v1/chat/:chatId/message/:messageId/read`

Mark a message as read by a user. This is **idempotent** — calling it multiple times is safe.

**Request Body:**
```json
{
  "user_id": "00000000-0000-0000-0000-000000000002"
}
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "message_id": "KxZ8a1bQ3rTqYpN2mJwL",
    "read_by": [
      "00000000-0000-0000-0000-000000000001",
      "00000000-0000-0000-0000-000000000002"
    ]
  }
}
```

---

### `POST /api/v1/chat/:chatId/lastseen`

Update a user's last-seen message ID within a chat (for unread count tracking).

**Request Body:**
```json
{
  "user_id": "00000000-0000-0000-0000-000000000002",
  "message_id": "KxZ8a1bQ3rTqYpN2mJwL"
}
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "chat_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "user_id": "00000000-0000-0000-0000-000000000002",
    "last_seen_message_id": "KxZ8a1bQ3rTqYpN2mJwL"
  }
}
```

---

### `GET /api/v1/user/:userId/chats`

List all chats for a user, including member details from PostgreSQL.

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "user_id": "00000000-0000-0000-0000-000000000001",
    "chats": [
      {
        "chat_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        "members": [
          "00000000-0000-0000-0000-000000000001",
          "00000000-0000-0000-0000-000000000002"
        ],
        "joined_at": "2026-10-27T02:14:00.000Z",
        "last_seen_message_id": "KxZ8a1bQ3rTqYpN2mJwL",
        "created_at": "2026-10-27T02:14:00.000Z"
      }
    ]
  }
}
```

---

### Error Responses

All errors follow the same shape:

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Chat abc not found",
    "status": 404
  }
}
```

| Code | Status | Description |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Invalid request body/params |
| `UNAUTHORIZED` | 401 | Missing x-user-id header |
| `FORBIDDEN` | 403 | User is not a chat member |
| `NOT_FOUND` | 404 | Resource does not exist |
| `CONFLICT` | 409 | Resource already exists |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## Postman Collection

Import `chat-backend.postman_collection.json` into Postman.

The collection includes:
- Pre-built requests for all 6 endpoints
- Auto-extraction of `chatId` and `messageId` into collection variables (via test scripts)
- Edge case examples (validation error, 404)

**Quick start flow:**
1. Run **"1. Create or Retrieve Chat"** → `chatId` is auto-saved
2. Run **"2. Send Message"** → `messageId` is auto-saved
3. Run the remaining requests in order

---

## Project Structure

```
chat-backend/
├── src/
│   ├── config/
│   │   ├── env.ts           # Environment variable loader
│   │   └── firebase.ts      # Firebase Admin SDK init
│   ├── controllers/
│   │   └── chatController.ts # Request handlers (thin layer)
│   ├── database/
│   │   ├── migrate.ts        # Migration runner
│   │   ├── postgres.ts       # Pool + query helpers
│   │   └── schema.sql        # Full DB schema
│   ├── middleware/
│   │   ├── auth.ts           # Auth middleware (header-based, JWT-ready)
│   │   ├── errorHandler.ts   # Centralized error formatting
│   │   └── validate.ts       # Joi validation factory
│   ├── routes/
│   │   └── chatRoutes.ts     # Route definitions with middleware
│   ├── services/
│   │   ├── chatService.ts    # PostgreSQL operations
│   │   └── messageService.ts # Firestore operations
│   ├── types/
│   │   └── index.ts          # All TypeScript interfaces
│   ├── utils/
│   │   └── AppError.ts       # Custom error class
│   ├── validators/
│   │   └── schemas.ts        # Joi schemas
│   ├── app.ts                # Express app factory
│   └── server.ts             # Entry point + graceful shutdown
├── .env.example
├── .gitignore
├── chat-backend.postman_collection.json
├── package.json
├── README.md
└── tsconfig.json
```

---

## Design Decisions

### Duplicate chat prevention
`findOrCreateChat` first does a JOIN query on `chat_members` to check for an existing chat between two users before inserting. This is safe under concurrent requests because PostgreSQL's `UNIQUE` constraint on `(chat_id, user_id)` prevents double-insertion.

### Cursor-based pagination
`GET /chat/:chatId/messages` uses Firestore's `startAfter(docSnapshot)` cursor instead of offset pagination. This is O(1) for any page depth, whereas offset pagination degrades with large datasets.

### Read receipts with arrayUnion
`markMessageRead` uses `FieldValue.arrayUnion(userId)` which is idempotent and atomic — no race conditions when multiple clients mark the same message read simultaneously.

### Authentication architecture
The `x-user-id` header-based auth is intentional scaffolding. Swapping it for JWT requires only editing `src/middleware/auth.ts` — all controllers already receive `req.user` the same way.

### Strict TypeScript
`noImplicitAny`, `strictNullChecks`, `noImplicitReturns` are all enabled. No `any` types are used in production code.
