# `backend/app/database/connectors` Overview

Database connector implementations.

Responsibilities typically include:

- Creating/initializing DB schema (or ensuring it exists)
- Creating SQLAlchemy engines/sessions
- Providing a small abstraction used by `database/operations/*`

