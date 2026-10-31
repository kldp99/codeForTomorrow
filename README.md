# 💬 Chat Backend API

A production-ready, strictly-typed chat backend built with **Node.js**, **Express**, **TypeScript (strict mode)**, **TypeORM + Aiven Cloud MySQL**, and **Firebase Admin SDK (Cloud Firestore)**.

---

## Table of Contents

- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Setup & Installation](#setup--installation)
- [Firebase Setup](#firebase-setup)
- [Database Setup & Migrations](#database-setup--migrations)
- [Running the Server](#running-the-server)
- [API Reference](#api-reference)
- [Postman Collection](#postman-collection)
- [Project Structure](#project-structure)
- [Security & Design Decisions](#security--design-decisions)

---

## Architecture

| Layer | Technology | Purpose |
|---|---|---|
| **Runtime & Language** | Node.js (≥18) + TypeScript (strict mode) | Core server platform with compile-time type safety |
| **HTTP Framework** | Express 4 | RESTful routing, middleware pipelines |
| **Relational Database** | Aiven Cloud MySQL + TypeORM | Users, chats, chat memberships, order-independent deduplication |
| **Document Store** | Firebase Firestore (Admin SDK) | Messages, per-user read receipts, per-user last-seen tracking |
| **Validation** | Joi | Declarative schema validation for params, body, and query |
| **Security** | Helmet, CORS, express-rate-limit | HTTP header hardening, rate limiting, and CORS configuration |

**Data Storage Strategy:**
- **MySQL (via TypeORM)**: Handles relational integrity and relational membership. Stores users, chats, and memberships (`users`, `chats`, `chat_members`). Uses transactions for chat creation and unique constraint indexing for deterministic 1:1 chat deduplication.
- **Cloud Firestore**: Handles time-series message events and high-concurrency sub-collections:
  - Messages: `chats/{chatId}/messages/{messageId}`
  - Read Receipts: `chats/{chatId}/messages/{messageId}/readReceipts/{userId}`
  - Last Seen: `chats/{chatId}/lastSeen/{userId}`

---

## Prerequisites

- **Node.js**: `v18.0.0` or higher
- **npm**: `v9.0.0` or higher
- **MySQL Database**: Aiven Cloud MySQL instance (or standard MySQL 8.0+)
- **Firebase Project**: Cloud Firestore enabled in Native mode with service account credentials

---

## Setup & Installation

### 1. Clone repository and install dependencies

```bash
git clone <repo-url>
cd codeForTomorrow
npm install
```

### 2. Configure Environment Variables

Copy the example environment configuration:

```bash
cp .env.example .env
```

Configure the environment variables in `.env`:

```env
# Server
PORT=3000
NODE_ENV=development

# Aiven Cloud MySQL
MYSQL_HOST=mysql-your-instance.aivencloud.com
MYSQL_PORT=28314
MYSQL_DATABASE=defaultdb
MYSQL_USER=avnadmin
MYSQL_PASSWORD=your_mysql_password
MYSQL_SSL_CA=./certs/ca.pem

# Firebase Admin SDK
FIREBASE_SERVICE_ACCOUNT_PATH=./certs/firebase-service-account.json

# Security & Rate Limiting
JWT_SECRET=your_jwt_secret
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
```

---

## Firebase Setup

1. Open the [Firebase Console](https://console.firebase.google.com/).
2. Select your project and navigate to **Build → Firestore Database** (ensure it is created in Native mode).
3. Navigate to **Project Settings (gear icon) → Service Accounts**.
4. Click **Generate new private key** to download the service account JSON.
5. Place the downloaded JSON file in the `certs/` directory:
   ```
   certs/firebase-service-account.json
   ```
   *(Note: The `certs/` directory is automatically ignored by `.gitignore` to prevent credential exposure).*

---

## Database Setup & Migrations

Synchronize the MySQL schema using TypeORM:

```bash
npm run schema:sync
```

This ensures the required MySQL tables (`users`, `chats`, `chat_members`) and indexes are properly created in the database.

---

## Running the Server

### Development Mode
Runs the server with hot-reload:
```bash
npm run dev
```

### Production Build & Start
Compiles TypeScript to JavaScript in `dist/` and starts the Node process:
```bash
npm run build
npm start
```

### Type Checking
Runs TypeScript type check without emitting files:
```bash
npm run typecheck
```

Server endpoints:
- **Base URL**: `http://localhost:3000/api/v1`
- **Health Check**: `http://localhost:3000/health`

---

## API Reference

All API routes are prefixed with `/api/v1`.

### 1. Create User
- **Method**: `POST`
- **Endpoint**: `/api/v1/user`
- **Request Body**:
  ```json
  {
    "name": "Alice",
    "email": "alice@example.com"
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "success": true,
    "userId": "e19300cd-d492-429b-a6ee-d4a4f9651493",
    "message": "User created successfully"
  }
  ```

---

### 2. Get User by ID
- **Method**: `GET`
- **Endpoint**: `/api/v1/user/:userId`
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "user": {
      "id": "e19300cd-d492-429b-a6ee-d4a4f9651493",
      "name": "Alice",
      "email": "alice@example.com",
      "createdAt": "2026-10-31T01:07:20.000Z",
      "updatedAt": "2026-10-31T01:07:20.000Z"
    }
  }
  ```

---

### 3. Create or Get 1:1 Chat
- **Method**: `POST`
- **Endpoint**: `/api/v1/chat/create`
- **Behavior**: Uses an order-independent conversation key. Returns existing chat if already created.
- **Request Body**:
  ```json
  {
    "userAId": "e19300cd-d492-429b-a6ee-d4a4f9651493",
    "userBId": "2149cbe3-a2d2-444e-9a42-342513770b15"
  }
  ```
- **Response `201 Created`** (new chat) or **`200 OK`** (existing chat):
  ```json
  {
    "success": true,
    "chatId": "acb0aa2a-6cac-490f-bc1f-0c287f0a7d36",
    "message": "Chat created successfully"
  }
  ```

---

### 4. List User Chats
- **Method**: `GET`
- **Endpoint**: `/api/v1/user/:userId/chats`
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "chats": [
      {
        "chatId": "acb0aa2a-6cac-490f-bc1f-0c287f0a7d36",
        "chatType": "ONE_TO_ONE",
        "members": [
          "e19300cd-d492-429b-a6ee-d4a4f9651493",
          "2149cbe3-a2d2-444e-9a42-342513770b15"
        ],
        "createdAt": "2026-10-31T01:07:21.000Z"
      }
    ]
  }
  ```

---

### 5. Send Message
- **Method**: `POST`
- **Endpoint**: `/api/v1/chat/:chatId/message/send`
- **Behavior**: Verifies chat exists and sender is a member in MySQL; stores message in Cloud Firestore with server timestamp.
- **Request Body**:
  ```json
  {
    "senderId": "e19300cd-d492-429b-a6ee-d4a4f9651493",
    "text": "Hello Bob!"
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "success": true,
    "message": "Message sent successfully",
    "messageId": "R5pzLPTlruJPCOPeFqCo",
    "data": {
      "messageId": "R5pzLPTlruJPCOPeFqCo",
      "chatId": "acb0aa2a-6cac-490f-bc1f-0c287f0a7d36",
      "senderId": "e19300cd-d492-429b-a6ee-d4a4f9651493",
      "text": "Hello Bob!",
      "timestamp": "2026-10-31T01:07:22.000Z"
    }
  }
  ```

---

### 6. Get Messages (with Pagination)
- **Method**: `GET`
- **Endpoint**: `/api/v1/chat/:chatId/messages?limit=50&userId=<uuid>&cursor=<msgId>`
- **Query Parameters**:
  - `limit`: Number of messages (default: 50, max: 100)
  - `userId`: Member user UUID verifying access
  - `cursor`: (Optional) Message ID to paginate after
- **Behavior**: Queries Firestore `timestamp DESC` with limit + 1, reverses to chronological ascending order.
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "messages": [
      {
        "messageId": "R5pzLPTlruJPCOPeFqCo",
        "chatId": "acb0aa2a-6cac-490f-bc1f-0c287f0a7d36",
        "senderId": "e19300cd-d492-429b-a6ee-d4a4f9651493",
        "text": "Hello Bob!",
        "timestamp": "2026-10-31T01:07:22.000Z"
      }
    ],
    "hasMore": false,
    "nextCursor": null
  }
  ```

---

### 7. Mark Message Read
- **Method**: `POST`
- **Endpoint**: `/api/v1/chat/:chatId/message/:messageId/read`
- **Behavior**: Idempotent. Writes to `chats/{chatId}/messages/{messageId}/readReceipts/{userId}` without modifying the original message.
- **Request Body**:
  ```json
  {
    "userId": "2149cbe3-a2d2-444e-9a42-342513770b15"
  }
  ```
- **Response `200 OK`** (first read: `isNew: true`, repeated read: `isNew: false`):
  ```json
  {
    "success": true,
    "message": "Message marked as read successfully",
    "data": {
      "chatId": "acb0aa2a-6cac-490f-bc1f-0c287f0a7d36",
      "messageId": "R5pzLPTlruJPCOPeFqCo",
      "userId": "2149cbe3-a2d2-444e-9a42-342513770b15",
      "readAt": "2026-10-31T01:07:23.321Z",
      "isNew": true
    }
  }
  ```

---

### 8. Update Last Seen
- **Method**: `POST`
- **Endpoint**: `/api/v1/chat/:chatId/lastseen`
- **Behavior**: Updates `chats/{chatId}/lastSeen/{userId}`. Enforces that last-seen cannot move backwards to an older message (returns `400 INVALID_LAST_SEEN_ORDER`).
- **Request Body**:
  ```json
  {
    "userId": "2149cbe3-a2d2-444e-9a42-342513770b15",
    "messageId": "R5pzLPTlruJPCOPeFqCo"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "message": "Last seen updated successfully",
    "data": {
      "chatId": "acb0aa2a-6cac-490f-bc1f-0c287f0a7d36",
      "userId": "2149cbe3-a2d2-444e-9a42-342513770b15",
      "messageId": "R5pzLPTlruJPCOPeFqCo",
      "lastSeenAt": "2026-10-31T01:07:24.000Z"
    }
  }
  ```

---

## Postman Collection

Two Postman collections are provided:

1. **`chat-backend-clean.postman_collection.json`** *(Final Assignment Submission)*:
   - Contains the core endpoints organized into `Users`, `Chats`, and `Messages` folders.
   - Provides explicit requests for creating both User A (`userAId`) and User B (`userBId`), creating their 1:1 chat, sending messages, paginated reading, read receipts, and last-seen tracking.
   - Clean, sequential, and pre-configured for Postman Collection Runner.

2. **`chat-backend.postman_collection.json`** *(Comprehensive Test Suite)*:
   - Includes **38 automated test cases** covering all success paths, validation errors, duplicate chat prevention, 403 authorization checks, 404s, pagination, read receipt idempotency, and monotonic last-seen ordering.

---

## Project Structure

```
codeForTomorrow/
├── certs/                             # SSL CA and Firebase service account (gitignored)
│   ├── ca.pem
│   └── firebase-service-account.json
├── src/
│   ├── config/
│   │   ├── env.ts                     # Validated environment configuration
│   │   └── firebase.ts                # Firebase Admin SDK & collection helpers
│   ├── controllers/
│   │   ├── chatController.ts          # HTTP handlers for chat & messaging endpoints
│   │   └── userController.ts          # HTTP handlers for user endpoints
│   ├── database/
│   │   ├── data-source.ts             # TypeORM DataSource initialization & SSL config
│   │   └── sync.ts                    # Database schema synchronization script
│   ├── entities/
│   │   ├── Chat.ts                    # TypeORM Chat entity
│   │   ├── ChatMember.ts              # TypeORM ChatMember entity (relational joins)
│   │   ├── User.ts                    # TypeORM User entity
│   │   └── index.ts
│   ├── middleware/
│   │   ├── auth.ts                    # Authentication scaffolding (header-based)
│   │   ├── errorHandler.ts            # Centralized error handler (no exposed stack traces)
│   │   └── validate.ts                # Joi validation middleware
│   ├── repositories/
│   │   ├── chatRepository.ts          # TypeORM chat queries & transactions
│   │   └── userRepository.ts          # TypeORM user queries
│   ├── routes/
│   │   └── chatRoutes.ts              # Central router definition for all 8 APIs
│   ├── services/
│   │   ├── chatService.ts             # Chat business logic & membership assertions
│   │   ├── messageService.ts          # Firestore messaging, pagination, receipts & last-seen
│   │   └── userService.ts             # User creation & lookup logic
│   ├── types/
│   │   └── index.ts                   # Strict TypeScript interfaces & request/response types
│   ├── utils/
│   │   ├── AppError.ts                # Custom operational error class
│   │   └── mysqlErrors.ts             # MySQL error code translator (e.g. 1062 -> 409)
│   ├── validators/
│   │   └── schemas.ts                 # Joi input validation schemas
│   ├── app.ts                         # Express application setup (Helmet, CORS, rate limiting)
│   └── server.ts                      # Server bootstrap & graceful shutdown handling
├── .env.example                       # Documented environment template with placeholders
├── .gitignore                         # Strict exclusion for credentials, node_modules, and dist
├── chat-backend.postman_collection.json # Comprehensive 38-request test collection
├── package.json
├── README.md
└── tsconfig.json                      # Strict TypeScript compiler configuration
```

---

## Security & Design Decisions

1. **Credentials Isolation**: All private credentials (`certs/`, `.env`) are kept out of source control via `.gitignore`.
2. **Strict Primary Keys**: Entity columns strictly define lengths and default timestamps compatible with MySQL's `sql_require_primary_key=ON`.
3. **Deterministic 1:1 Chats**: Unique `conversation_key` (`min(userAId, userBId)_max(userAId, userBId)`) prevents race-condition chat duplicates.
4. **Idempotency**:
   - Creating an existing chat returns `200 OK` with the existing chat ID.
   - Marking a message as read preserves the initial `readAt` timestamp and returns `isNew: false`.
   - Updating last-seen to the current message succeeds without redundant writes.
5. **Monotonic Last Seen**: Enforced ordering using Firestore server timestamps guarantees unread trackers never move backwards to an older message.
6. **Information Disclosure Prevention**: Error payloads never leak internal stack traces or database driver internal details in API responses.
