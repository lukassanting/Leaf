# `backend/app/database/models` Overview

This folder contains SQLAlchemy models for the MySQL persistence layer.

Model responsibilities typically include:

- Representing the Leaf tree (self-referential relationships)
- Representing database tables (`DatabaseModel`)
- Representing database row properties (`properties` JSON column)

