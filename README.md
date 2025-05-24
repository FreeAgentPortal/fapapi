# 🏈 Free Agent Portal – Backend API

This is the backend API powering the Free Agent Portal — a platform to connect athletes, teams, and agents.

---

## 📚 Table of Contents

- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Core Workflows](#core-workflows)
- [Modules](#modules)
- [Environment Variables](#environment-variables)
- [Scripts](#scripts)
- [Contributing](#contributing)

## 📚 Developer Docs

- [Registration Workflow](./src/modules/auth/docs/registration-workflow.md)
---

## 🚀 Getting Started

```bash
git clone https://github.com/your-org/fapapi.git
cd fapapi
npm install
npm run dev
```

---

## 🗂️ Project Structure

The FAP API is designed as a monolithic API service, however its structure allows for it to be broken up into smaller microservices later on as the platform scales
Each `module` (i.e. `auth`) is responsible for its own sub directories, models, services, etc. This allows for a clean seperation of concerns
Should the platform ever scale to the point of making each `module` a microservice, itll allow for greater flexibility in moving `modules`

```
src/modules
├── controllers/        # Express route handlers (AuthService, etc.)
├── handlers/           # Business logic orchestration (RegisterHandler)
├── services/           # Core services (Payment, Auth, etc.)
├── models/             # Mongoose schemas
├── factories/          # Role-based profile and payment logic
├── routes/             # Express routers (authRoutes, etc.)
├── utils/              # Shared helpers and utility functions
├── events/             # Event emitter setup and listeners
└── docs/               # Markdown documentation
```

---

## 📦 Modules

- **Auth**: Login, registration, JWT generation
- **User**: Central identity record
- **Athlete**: Performance and personal metrics
- **Team**: Organizational account + access control
- **Admin**: Superuser account support
- **Billing**: Payment processor integration and vaulting

---

## ⚙️ Environment Variables

Ensure your `.env` file includes:

```env
MONGO_USER=<mongo-user>
MONGO_PASS=<mongo-pass>
MONGO_DBNAME=<mongo-dbname>
JWT_SECRET=<your-jwt-secret>
PYRE_API_KEY=<your-pyre-api-key>
PYRE_MERCHANT_ID=<your-merchant-id>
```

---

## 🧪 Scripts

```bash
npm run dev       # Start dev server (TS)
npm run build     # Compile TypeScript
npm start         # Start from compiled JS
```

---

## 🤝 Contributing

- Follow modular design: routes → service → handler
- Add new documentation to `/docs/`
- Write expressive commits and PRs
- Include tests or examples where possible
