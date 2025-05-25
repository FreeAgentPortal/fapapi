# 🛡️ Auth Module Documentation

The `auth` module handles user authentication workflows for the Free Agent Portal. This includes registration, login, password recovery, token management, and more.

## 📁 Module Overview

This module follows the [Modular Monolith design](../../README.md#api-design) defined in the API Architecture Strategy. It is isolated under its own domain:

/modules
/auth
/handlers # Business logic encapsulation
/services # Orchestration & validation
/routes # API route bindings
/models # (optional) Auth-specific types or payloads
AuthService.ts # Entry point for orchestration logic

markdown
Copy
Edit

## 🔗 Related Documents

- [User Registration Workflow](./registration-workflow.md)
- [Password Recovery Flow](./password-recovery.md)
            |

## 🔒 Authentication Design Philosophy

- **Centralized User Model**: All roles (athlete, agent, scout, etc.) connect to a shared `User` record.
- **Separation of Concerns**: Profile creation and auth logic are strictly decoupled.
- **Token-first Architecture**: JWTs contain roles and profile references to eliminate unnecessary DB hits.

## 🔄 Auth Workflows

Each major auth function has a dedicated handler:

- `RegisterHandler.execute()` → Create user + profile
- `AuthenticationHandler.()*` → Validate logins, Tokens, return JWT
- `PasswordRecoveryHandler.requestReset()` → Attach reset token to user
- `PasswordRecoveryHandler.resetPassword()` → Validate and update password

## 🧪 Testing

Use tools like Postman to test key endpoints:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

To set the `Authorization` header with an API Key:  
```http
Authorization: ApiKey <your-api-key>
```
OR
```http
Authorization: Bearer <JWT Token>
```

## 📌 Notes
All handlers are pure where possible and testable in isolation.

Email delivery is triggered in AuthService, not within handlers (in line with SRP).

Token TTLs and hashing strategies are configurable via environment variables.
