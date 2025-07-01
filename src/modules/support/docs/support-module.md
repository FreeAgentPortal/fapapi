# 🎫 Support Module Overview

The `support` module powers the ticketing system for the Free Agent Portal. It allows users to create help tickets, message with support staff and manage ticket status.

## 📁 Module Structure

```
modules/support
├── handlers/   # Business logic for tickets, agents and groups
├── services/   # HTTP facing controllers
├── routes/     # Express routes mounted at /api/v1/support
└── models/     # Mongoose schemas for tickets, messages and groups
```

Key handlers:
- `TicketHandler` – create, retrieve and update tickets
- `AgentHandler` – fetch available support agents for a ticket
- `SupportHandler` – manage support groups

## 🚦 Basic Workflows

1. **Create a Ticket** – `POST /api/v1/support/ticket`
   - Accepts fields like `subject`, `description` and `category`.
   - Automatically assigns the ticket to matching `SupportGroup` records.
   - The first message is stored in `SupportMessage`.
2. **List Tickets** – `GET /api/v1/support/ticket`
   - Supports filtering, sorting and pagination via query params.
3. **View or Update a Ticket** – `GET /api/v1/support/ticket/:id` and `PUT /api/v1/support/ticket/:id`
   - Returns ticket details along with requester info and groups.
4. **Request Available Agents** – `GET /api/v1/support/agent/:id`
   - Returns agents associated with the ticket's groups.

## 🧪 Testing the Endpoints

Use a tool like Postman to interact with the API:

```http
POST /api/v1/support/ticket
GET  /api/v1/support/ticket/:id
GET  /api/v1/support/agent/:id
```

Authentication headers follow the same pattern as other modules (API key or bearer token).

## 📌 Notes

This module is designed around small handlers so business logic remains testable. Ticket messages and group assignment use Mongoose relations for easy expansion later on.
