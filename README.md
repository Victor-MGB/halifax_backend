# halifax_backend
# Nexus Private Bank - Backend API

A robust, production-ready banking backend built with Node.js, Express, and MongoDB. Features multi-currency support, 22-stage withdrawal compliance, admin oversight, and real-time notifications.

## 🏦 Overview

Nexus Private Bank is a modern digital banking platform that provides institutional-grade security and compliance features. This backend API powers the entire banking ecosystem including user management, multi-currency accounts, secure transfers, and a unique 22-stage withdrawal verification process.

## ✨ Key Features

### 👤 User Management
- JWT-based authentication
- Role-based access (User / Admin)
- Secure password hashing with bcrypt
- Account suspension/reactivation
- Profile management

### 💳 Banking Operations
- Multi-currency accounts (USD, EUR, GBP, CHF, JPY, CAD, AUD, SGD, AED, HKD)
- Real-time internal transfers
- Transaction history with pagination
- Account freeze/unfreeze (admin only)
- Admin fund credit system

### 🔄 Withdrawal System (22-Stage Compliance)
- 22-step verification process
- Each stage requires explicit admin approval
- Real-time stage progression tracking
- Stage notes and audit trail
- Automatic notifications on stage changes

### 🔔 Notification System
- Real-time in-app notifications
- Email notifications (optional)
- Mark as read/unread
- Unread count tracking

### 📊 Admin Dashboard
- Complete platform analytics
- User management (CRUD operations)
- Transaction monitoring
- Withdrawal approval workflow
- Account freeze/unfreeze
- Multi-currency funding

### 🔒 Security Features
- JWT token authentication
- Password encryption (bcrypt)
- MongoDB transactions for data integrity
- CORS configured for frontend
- Environment variable protection
- Input validation and sanitization

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| Node.js | Runtime environment |
| Express.js | Web framework |
| MongoDB | Database |
| Mongoose | ODM for MongoDB |
| JWT | Authentication |
| bcrypt | Password hashing |
| CORS | Cross-origin resource sharing |
| dotenv | Environment variables |

## 📁 Project Structure
