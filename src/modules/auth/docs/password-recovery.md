# 🔐 Password Recovery Flow

This document outlines how the password recovery system is structured and functions within the Free Agent Portal API.

---

## 📁 Module Structure

The password recovery logic lives within the `auth` module and is broken into clean, separable layers:

```yaml
/modules/auth
├── routes/
│ └── authRoutes.ts # Defines /forgot-password route
├── services/
│ └── AuthService.ts # Orchestrates the flow: validation, handler call, and response
├── handlers/
│ └── PasswordRecoveryHandler.ts # Core logic for generating/resetting password tokens
```

---

## 🔄 Workflow Overview

1. **Client sends** a `POST /api/auth/forgot-password` request with the user's email.
2. The request hits the Express route defined in `authRoutes.ts`.
3. The route calls `AuthService.forgotPassword`.
4. `AuthService` delegates the logic to a pre-instantiated `PasswordRecoveryHandler`.
5. `PasswordRecoveryHandler`:
   - Validates the email.
   - Generates a secure token and expiry timestamp.
   - Attaches the token + expiry to the user record.
   - Saves the updated user to the database.
6. The `AuthService` then:
   - Emits an event via `eventBus.publish('password.recovery.initiated')`.
   - Sends a 200 OK response to the client.

---

## 🧠 Design Decisions

| Layer                                   | Responsibility                                                          |
| --------------------------------------- | ----------------------------------------------------------------------- |
| **Routes**                              | Handle HTTP-level routing only.                                         |
| **Service (`AuthService`)**             | Coordinates request handling, emits events, and returns HTTP responses. |
| **Handler (`PasswordRecoveryHandler`)** | Encapsulates business logic for recovery token generation.              |
| **Event Bus**                           | Emits event for decoupled email notification processing.                |

---

## 📨 Notification Delivery

The actual sending of recovery emails is **not handled** inside the handler. Instead:

- An event like `password.recovery.initiated` is published.
- The `NotificationService` or equivalent subscriber handles email dispatch.
- This ensures clean separation of concerns and testability.

---

## 🔐 Token Strategy

Tokens are:

- **Randomly generated** (e.g., UUID or crypto string)
- **Stored on the `User` document** along with an expiry timestamp
- **Scoped for one-time use** and expire after a set duration (e.g., 15 minutes)

---

## 📦 Example Payload

**POST** `/api/auth/forgot-password`

```json
{
  "email": "athlete@example.com"
}
```

Response:

```json
{
  "message": "Recovery email sent"
}
```

---
