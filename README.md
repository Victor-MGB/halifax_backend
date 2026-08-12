# Halifax Offshore Private Bank — Backend API

A production-ready banking backend built with **Node.js**, **Express**, and **MongoDB**. It powers the Halifax Offshore Private Bank platform, providing user authentication, multi-currency accounts, secure transfers, a 22-stage withdrawal compliance workflow, admin oversight, notifications, and a contact/support system.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Scripts](#scripts)
- [Database Models](#database-models)
- [API Reference](#api-reference)
- [The 22-Stage Withdrawal Workflow](#the-22-stage-withdrawal-workflow)
- [Authentication](#authentication)
- [Health & Monitoring Endpoints](#health--monitoring-endpoints)
- [Docker](#docker)
- [Seeding Demo Data](#seeding-demo-data)
- [Security Notes](#security-notes)

## Features

### User Management
- JWT-based registration, login, and session verification
- Role-based access control (`user` / `admin`)
- Secure password hashing with bcrypt (salt rounds = 10)
- Account suspension / reactivation by admin
- Automatic creation of checking + savings accounts on registration

### Banking Operations
- Multi-currency accounts (currency is configurable; defaults to USD)
- Internal transfers between accounts using **MongoDB transactions** for data integrity
- Insufficient-funds and frozen-account validation
- Transaction history with pagination for users
- Admin fund-credit system

### Withdrawal System (22-Stage Compliance)
- Every withdrawal progresses through 22 defined verification stages
- Each stage requires explicit admin approval before the user can proceed
- Rejection halts the entire request
- Full audit trail per stage: `triggeredAt`, `resolvedAt`, `adminNote`, status
- Automatic notifications at every stage change

### Notification System
- In-app notifications for withdrawals, funding, account status changes, and support tickets
- Unread-count tracking and read/unread toggling

### Admin Dashboard (API)
- Platform analytics (users, accounts, transaction volume, monthly trends, category breakdown)
- User management (list/search, suspend/reactivate, delete with cascade cleanup)
- Account freeze/unfreeze
- Withdrawal approval/rejection with admin notes
- Transaction monitoring (paginated, populated)
- Contact/ticket management (list, filter, status updates, delete)

### Support / Contact System
- Public contact form submission (no auth required)
- Automatic admin notification on submission, with urgency-based labels (urgent / high / medium / low)
- Priority and status summaries for admins

### Security
- JWT bearer-token authentication
- bcrypt password hashing
- MongoDB sessions/transactions for financial writes
- CORS restricted to configured frontend origins
- Environment variables for secrets (`.env` is git-ignored)

## Tech Stack

| Technology  | Purpose                      |
|-------------|------------------------------|
| Node.js     | Runtime environment          |
| Express.js  | Web framework / API routing  |
| MongoDB     | Database                     |
| Mongoose    | ODM / schema modeling        |
| JSON Web Token (JWT) | Authentication        |
| bcryptjs    | Password hashing             |
| cors        | Cross-origin resource sharing|
| dotenv      | Environment configuration    |
| nodemon     | Development auto-reload      |

## Project Structure

```
halifax_offshore_backend/
├── middleware/
│   └── auth.js              # JWT protect + adminOnly guards
├── models/
│   ├── Account.js           # Checking/savings/investment accounts
│   ├── ContactModel.js      # Support/contact submissions
│   ├── Notification.js      # In-app notifications
│   ├── Transaction.js       # Transfer/deposit/withdrawal/admin_fund records
│   ├── User.js              # User accounts with bcrypt hashing
│   └── WithdrawalRequest.js # 22-stage withdrawal workflow
├── routes/
│   ├── accounts.js          # User account listing
│   ├── admin.js             # Admin analytics, funding, user & withdrawal management
│   ├── auth.js              # Register / login / me
│   ├── contact.js           # Public contact form + admin ticket management
│   ├── notifications.js     # Fetch + mark notifications
│   ├── transactions.js      # History + transfers
│   └── withdrawals.js       # Initiate/advance withdrawal stages
├── seed.js                  # Demo data seeding script
├── server.js                # App entry point + health endpoints
├── Dockerfile
├── package.json
└── .env                     # Environment variables (git-ignored)
```

## Getting Started

### Prerequisites
- Node.js 18+ (Docker image uses Node 20)
- A MongoDB instance (local or Atlas)

### Installation

```bash
# 1. Clone the repository
git clone <repo-url>
cd halifax_offshore_backend

# 2. Install dependencies
npm install

# 3. Create the environment file
cp .env.example .env   # then fill in your values (see below)
```

> There is no `.env.example` committed yet. Create one with the keys listed in [Environment Variables](#environment-variables).

### Running

```bash
# Production
npm start

# Development (auto-reload with nodemon)
npm run dev
```

The server connects to MongoDB first, then listens on the port from `PORT` (default `5000` in code, `4000` in the sample `.env`).

### Docker

```bash
docker build -t halifax-backend .
docker run -p 5000:5000 --env-file .env halifax-backend
```

The Dockerfile copies `package*.json`, installs production dependencies, copies the app, exposes port `5000`, and runs `node server.js`.

## Environment Variables

| Variable    | Description                                  | Default |
|-------------|----------------------------------------------|---------|
| `PORT`      | Port the server listens on                   | `5000`  |
| `MONGO_URI` | MongoDB connection string                    | *(required)* |
| `JWT_SECRET`| Secret used to sign JWT tokens               | *(required)* |
| `JWT_EXPIRE`| Token expiry duration (e.g. `7d`)            | `7d`    |
| `NODE_ENV`  | `development`, `production`, etc.            | `development` |

## Scripts

| Script          | Command                    | Description                        |
|-----------------|----------------------------|------------------------------------|
| `start`         | `npm start`                | Run the server                     |
| `dev`           | `npm run dev`              | Run with nodemon auto-reload       |
| `seed`          | `npm run seed`             | Wipe data and insert demo records  |

## Database Models

### User
`firstName`, `lastName`, `email` (unique), `password` (hashed), `role` (`user`|`admin`), `phone`, `isActive`, `createdAt`. Exposes a `matchPassword` method and a `fullName` virtual.

### Account
`user` (ref), `accountType` (`checking`|`savings`|`investment`), `accountNumber` (unique, auto-generated 10-digit), `balance`, `currency` (default `USD`), `isFrozen`, `createdAt`.

### Transaction
`fromAccount`, `toAccount` (refs), `user` (ref), `type` (`transfer`|`deposit`|`withdrawal`|`admin_fund`), `amount`, `currency`, `description`, `category`, `status` (`pending`|`completed`|`failed`), `createdAt`.

### WithdrawalRequest
`user`, `account` (refs), `amount`, `currency`, `destination`, `currentStage`, `stages[]` (each with `stageNumber`, `stageName`, `stageDesc`, `status`, `triggeredAt`, `resolvedAt`, `adminNote`), `status` (`in_progress`|`completed`|`rejected`), timestamps. The 22 stages are exposed as `WithdrawalRequest.STAGES`.

### Notification
`user` (ref), `title`, `message`, `type` (`info`|`success`|`warning`|`error`|`stage`|`funding`), `read`, `link`, `createdAt`.

### Contact (ContactModel)
`fullName`, `email`, `priority` (`low`|`medium`|`high`|`urgent`), `subject` (enum of predefined topics), `message` (min 10 chars), `status` (`open`|`in_review`|`resolved`|`closed`), `adminNote`, timestamps.

## API Reference

All JSON. Protected routes require an `Authorization: Bearer <token>` header. Admin routes additionally require a user with `role: admin`.

### Auth — `/api/auth`

| Method | Endpoint      | Auth  | Description                                        |
|--------|---------------|-------|----------------------------------------------------|
| POST   | `/register`   | No    | Create user (auto-creates checking + savings accounts). Returns token + user. |
| POST   | `/login`      | No    | Login with email/password. Returns token + user. Suspended accounts get 403. |
| GET    | `/me`         | Yes   | Return the current authenticated user.             |

### Accounts — `/api/accounts`

| Method | Endpoint | Auth | Description                        |
|--------|----------|------|------------------------------------|
| GET    | `/`      | Yes  | List the current user's accounts.  |

### Transactions — `/api/transactions`

| Method | Endpoint    | Auth | Description                                                        |
|--------|-------------|------|--------------------------------------------------------------------|
| GET    | `/`         | Yes  | Paginated user transaction history (`page`, `limit` query params). |
| POST   | `/transfer` | Yes  | Transfer between accounts. Uses a MongoDB transaction; validates ownership, frozen status, and funds. |

### Withdrawals — `/api/withdrawals`

| Method | Endpoint   | Auth | Description                                                                                  |
|--------|------------|------|----------------------------------------------------------------------------------------------|
| POST   | `/initiate`| Yes  | Start a withdrawal (stage 1) or advance to the next stage after the previous one is approved. Marks completed after stage 22. |
| GET    | `/my`      | Yes  | List the current user's withdrawal requests (populated account).                             |

### Notifications — `/api/notifications`

| Method | Endpoint        | Auth | Description                                  |
|--------|-----------------|------|----------------------------------------------|
| GET    | `/`             | Yes  | Latest 50 notifications + `unreadCount`.     |
| PUT    | `/read-all`     | Yes  | Mark all notifications as read.              |
| PUT    | `/:id/read`     | Yes  | Mark a single notification as read.          |

### Admin — `/api/admin` *(all require `role: admin`)*

| Method | Endpoint                                         | Description                                                    |
|--------|--------------------------------------------------|----------------------------------------------------------------|
| GET    | `/analytics`                                     | Platform stats: totals, balances, monthly volume, category breakdown. |
| POST   | `/fund`                                          | Credit a user's account, create an `admin_fund` transaction, notify the user. |
| GET    | `/users`                                         | List/search users (`?search=`) enriched with accounts and pending withdrawal. |
| PUT    | `/users/:id/toggle-active`                       | Suspend or reactivate a user.                                  |
| PUT    | `/accounts/:id/toggle-freeze`                    | Freeze or unfreeze an account.                                 |
| GET    | `/withdrawals`                                   | All withdrawal requests (populated user + account).            |
| PUT    | `/withdrawals/:requestId/stage/:stageIndex/approve` | Approve a stage (optional `adminNote`). Notifies the user.  |
| PUT    | `/withdrawals/:requestId/stage/:stageIndex/reject`  | Reject a stage (optional `adminNote`). Marks request rejected. |
| GET    | `/transactions`                                  | Paginated all-transactions feed.                               |
| DELETE | `/users/:id`                                     | Delete a user and all associated data (accounts, transactions, withdrawals, notifications). |

### Contact — `/api/contact`

| Method | Endpoint         | Auth   | Description                                                        |
|--------|------------------|--------|--------------------------------------------------------------------|
| POST   | `/`              | No     | Submit a contact message. Notifies all admins.                     |
| GET    | `/`              | Admin  | Paginated contact list; filters `?status=`, `?priority=`; includes status/priority summaries. |
| GET    | `/:id`           | Admin  | Get a single contact submission.                                   |
| PUT    | `/:id/status`    | Admin  | Update status (`open`/`in_review`/`resolved`/`closed`) and `adminNote`. |
| DELETE | `/:id`           | Admin  | Delete a contact submission.                                       |

## The 22-Stage Withdrawal Workflow

1. A user calls `POST /api/withdrawals/initiate` to start a withdrawal — Stage 1 (`Identity Verification`) is created as `pending`.
2. The admin reviews and calls the approve endpoint for that stage.
3. The user calls `/initiate` again; since the last stage is approved, the next stage is appended as `pending`.
4. Repeating this cycle walks the request through all 22 stages:

| # | Stage                          | # | Stage                            |
|---|--------------------------------|---|----------------------------------|
| 1 | Identity Verification          | 12| Credit Bureau Cross-Reference    |
| 2 | Account Ownership Confirmation | 13| Sanctions List Screening         |
| 3 | KYC Documentation Review       | 14| Enhanced Due Diligence           |
| 4 | AML Compliance Screening       | 15| Correspondent Bank Authorization |
| 5 | Source of Funds Verification   | 16| Liquidity Reserve Validation     |
| 6 | Transaction Risk Assessment    | 17| Internal Audit Flag Review       |
| 7 | Fraud Detection Scan           | 18| Currency Exchange Compliance     |
| 8 | Beneficiary Verification       | 19| Final AML Officer Sign-Off       |
| 9 | Regulatory Compliance Check    | 20| Board-Level Authorization        |
| 10| Tax Withholding Review         | 21| Clearing House Submission        |
| 11| Multi-Jurisdiction Clearance   | 22| Final Release Authorization      |

5. Approving stage 22 completes the request; rejecting any stage marks the whole request `rejected`.

## Authentication

- Registration and login return a signed JWT (`genToken`) with configurable expiry (`JWT_EXPIRE`).
- `protect` middleware verifies the `Bearer` token, loads the user (password excluded), and attaches it to `req.user`.
- `adminOnly` middleware rejects non-admin users with `403`.
- Suspended users (`isActive: false`) cannot log in.

## Health & Monitoring Endpoints

| Endpoint                 | Description                                                            |
|--------------------------|------------------------------------------------------------------------|
| `GET /api/health`        | Simple `{ status: 'OK' }`                                              |
| `GET /api/health/detailed` | Uptime, memory, DB ping latency, environment, Node version.          |
| `GET /api/health/stats`  | Record counts per collection, transaction rate, platform version.      |
| `GET /api/health/database`| DB connection state, host/port, per-collection document counts.       |
| `GET /api/health/services`| Status of database, JWT, and bcrypt services.                         |
| `GET /api/health/ready`  | Readiness probe (503 while the DB is disconnected).                    |
| `GET /api/health/live`   | Liveness probe.                                                        |

## Seeding Demo Data

```bash
npm run seed
```

Wipes all collections, then creates:

- 3 demo users: `alice@example.com`, `bob@example.com`, `carol@example.com` (password `password123`)
- Checking + savings accounts for each user
- 30 sample transactions across categories
- Welcome notifications

## Security Notes

- `.env` is git-ignored; never commit real credentials.
- The current sample `.env` in this working copy contains a live MongoDB connection string and a long `JWT_SECRET`. If this file was ever shared, **rotate the credentials immediately** (regenerate the Atlas password and JWT secret) and create a `.env.example` template with placeholder values.
- Financial writes (transfers) are wrapped in MongoDB sessions/transactions to keep balances consistent.
- No commit currently includes `.env` in the tracked files — verified via `git ls-files`.
