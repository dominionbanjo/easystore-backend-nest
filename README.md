# 🛠️ EasyStore API Core — High-Performance NestJS Engine

![NestJS](https://img.shields.io/badge/NestJS-11.x-E0234E?style=for-the-badge&logo=nestjs)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=for-the-badge&logo=postgresql)
![TypeORM](https://img.shields.io/badge/TypeORM-0.3-FB3E44?style=for-the-badge&logo=typeorm)
![Redis](https://img.shields.io/badge/Redis-Caching-DC382D?style=for-the-badge&logo=redis)

The **EasyStore API Core** is the architectural backbone of the EasyStore platform. It is a progressive **NestJS** application built with a focus on domain-driven modularity, security, and financial integrity. It handles everything from multi-step vendor onboarding to sophisticated escrow-based transaction clearing.

---

## 🏗️ System Architecture

The backend follows a **Modular Design Pattern**, where each core business domain is encapsulated in its own module.

### Core Domain Modules
- **`Identity-Module`**: Manages the security perimeter. 
    - Full JWT authentication with token rotation.
    - Role-Based Access Control (RBAC) (Admin, Vendor, User).
    - Multi-factor authentication via OTP (Email/SMS logic).
    - Google OAuth 2.0 integration.
- **`Commerce-Module`**: The transactional heart of the platform.
    - **Inventory System**: Complex product entity management with categories and variants.
    - **Order Lifecycle**: State-machine based order processing (Pending -> Paid -> Shipped -> Delivered).
    - **Review System**: Relational feedback loop between buyers and products.
- **`Finance-Module`**: Sophisticated financial orchestration.
    - **Escrow System**: Securely holds funds until delivery is verified.
    - **Transaction Ledger**: Immutable recording of all financial movements.
    - **Payout Automation**: Automated vendor settlements via the **Paystack API**.
- **`Vendor-Module`**: Storefront infrastructure.
    - Dynamic store creation and configuration.
    - **Analytics Engine**: Aggregates sales, customer, and order data for vendor dashboards.
- **`Admin-Module`**: Global governance and platform settings.
- **`Shared-Module`**: Infrastructural utilities (Cloudinary, Brevo, Redis).

---

## 💾 Data Model (Technical Spec)

EasyStore uses **TypeORM** for relational mapping with a highly optimized PostgreSQL schema.

### Primary Entities
- **User**: Central identity with dynamic role assignment.
- **Store**: Multi-tenant entity containing revenue metrics, branding, and metadata.
- **Product**: Relational entity linked to stores and categories.
- **Order**: Complex entity linking buyers, vendors, and line items.
- **Escrow**: Dedicated entity for managing the lifecycle of held funds.
- **Transaction**: Physical record of payment gateway events.

---

## ⚡ External Integrations

| Provider | Purpose | Implementation Detail |
|----------|---------|------------------------|
| **Paystack** | Financial Gateway | Used for secure checkouts, card verification, and vendor payouts. |
| **Cloudinary** | Media Optimization | Handles all image uploads (logos, product shots) with automated resizing. |
| **Brevo (Sendinblue)**| Communication | Event-driven transactional emails (Welcome, OTP, Order confirmation). |
| **Redis** | Speed & Security | Used for caching high-frequency data and managing rate-limiting states. |

---

## 🛡️ Security & Performance
- **Throttler Guard**: Global and endpoint-specific rate limiting to prevent brute-force and DDoS attacks.
- **Interceptors & DTOs**: Strict request validation using `class-validator` and `class-transformer`.
- **Database Indexing**: Optimized query performance for high-traffic store discovery.
- **Environment Gating**: Secure handling of production secrets via `@nestjs/config`.

---

## ⚙️ Development Setup

### 1. Prerequisites
- Docker (for local PG/Redis) or managed instances.
- Node.js v20+

### 2. Environment Configuration
Create a `.env` in `easystore-backend/`:
```env
DATABASE_URL=postgres://user:pass@host:port/db
JWT_SECRET=your_complex_secret
PAYSTACK_SECRET_KEY=sk_test_...
CLOUDINARY_URL=cloudinary://...
REDIS_HOST=localhost
REDIS_PORT=6379
```

### 3. Installation
```bash
# Install dependencies
npm install

# Run migrations
npm run migration:run

# Start development server
npm run dev
```

---

## 📡 API Overview
Detailed documentation is typically available via Swagger at `/api/docs` (if enabled in development).

| Group | Endpoints |
|-------|-----------|
| **Auth** | `/auth/login`, `/auth/register`, `/auth/verify-otp` |
| **Vendor** | `/stores/create`, `/stores/dashboard-stats`, `/products/*` |
| **Orders** | `/orders/create`, `/orders/my-orders`, `/orders/:id/status` |
| **Admin** | `/admin/vendors`, `/admin/system-logs`, `/admin/payouts` |

---

## 📄 License
This project is licensed under the UNLICENSED license.
