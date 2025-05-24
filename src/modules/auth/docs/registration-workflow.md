# 🧾 Free Agent Portal: User Registration Workflow

## 🔄 Overview

The registration workflow is responsible for:

- Creating a new `User`
- Creating associated `Profile(s)` (e.g. `team`, `athlete`, `admin`)
- (If billable) Creating a `BillingAccount`
- Returning a secure JWT
- Emitting a registration event for post-registration actions

---

## 🧩 Flow Summary

```
Route: POST /api/auth/register
Handler Chain: authRoutes → AuthService → RegisterHandler
```

---

## 🛠️ Step-by-Step Breakdown

### 1. **Receive Request**

**Route:** `/api/auth/register`  
**Method:** `POST`  
**Expected Fields:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "roles": ["team"]
}
```

---

### 2. **Controller: AuthService.register**

- Receives the request
- Instantiates the `RegisterHandler` class with the input
- Calls `execute()` on the handler
- Fires `user.registered` event via `EventEmitter`
- Responds with token + profileRefs + billing status

---

### 3. **Handler: RegisterHandler.execute()**

This is where core registration logic lives.

#### 3.1. **Validate Email**
- Checks for existing user
- If duplicate, throws an error

#### 3.2. **Create User**
- Hashes password
- Creates a new `User` document
- Stores: `email`, `passwordHash`, `roles`, `firstName`, etc.

#### 3.3. **Create Profile(s)**
- Iterates over `roles`
- Uses `ProfileCreationFactory` to call the correct profile builder
- Saves the profile `_id` in `profileRefs`

#### 3.4. **Create BillingAccount (if applicable)**
- Checks `RoleRegistry` to see if role is billable
- Creates a billing account:
  - `status: "trialing"`
  - `vaulted: false`
  - `trialEndsAt: [date]`
- Uses `PaymentService.createCustomer(...)` to register customer in payment processor

#### 3.5. **Save User ProfileRefs**
- Updates the user with references to created profiles
- Saves the `User` document

#### 3.6. **Return Token**
- Issues JWT containing:
  - `userId`
  - `roles`
  - `profileRefs`

---

### 4. **Emit Event: `user.registered`**

Emitted from `AuthService` after successful execution:

```ts
EventEmitter.emit('user.registered', {
  userId,
  email,
  roles
});
```

---

### 5. **Client Response**

```json
{
  "token": "<JWT>",
  "profileRefs": {
    "team": "ObjectId"
  },
  "billing": {
    "status": "trialing",
    "requiresVaultSetup": true
  }
}
```

---

## 🔐 Security Considerations

- Passwords are hashed using `bcrypt`
- JWTs expire in 7 days (refresh tokens to be implemented separately)
- Card data is not handled directly — vaulting handled securely post-registration

---

## ✅ Notes

- Admins, scouts, and other non-billable roles skip the billing step
- Billing vaulting is deferred to the dashboard for user convenience
- Event-driven architecture enables modular notification logic
- Profile creation is modular per role for scalability
