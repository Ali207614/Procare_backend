---
name: debug_api_endpoint
description: Systematically debug API endpoint errors given an endpoint, payload, and response/error details.
---

# Debug API Endpoint

Use this skill when you encounter an API error (e.g., 500, 400, 403) and need to pinpoint the root cause by analyzing the codebase, database, and logs. This skill focuses on a systematic approach to comparing the expected behavior (code) with the actual state (database/runtime).

## 1. Information Gathering

*   **Endpoint Analysis**:
    *   Identify the Controller and Service method responsible for the endpoint (e.g., `GET /api/v1/users` -> `UsersController.findAll`).
    *   Find the exact line of code associated with the error if a stack trace or specific error message is provided.
    *   Check the HTTP method (GET, POST, PUT, DELETE) and parameters.

*   **Error Analysis**:
    *   Read the full error response (status code, message, error type).
    *   If the error is a `DatabaseError` (e.g., "column does not exist", "relation does not exist"), immediately suspect a schema mismatch.
    *   If the error is a `ValidationError` (400), check the DTO validation rules.

## 2. Code vs. Database Verification

*   **For Database Errors (500)**:
    1.  **Locate Query**: Find the TypeORM/Knex/Prisma query in the Service method.
    2.  **Inspect Entity/Model**: Check the entity definition or interface causing the error.
    3.  **Check Database Schema**:
        *   Use `psql` (or equivalent) to inspect the *actual* table schema: `\d table_name` or `SELECT column_name FROM information_schema.columns WHERE table_name = '...'`.
        *   Compare the columns in the database with the columns requested in the code.
        *   **CRITICAL**: Do not assume the migration files match the database state. Always check the live database schema.
    4.  **Check Migrations**:
        *   List the executed migrations (`knex_migrations` table or similar).
        *   Check the migration files in the codebase (`migrations/` folder) to see if a migration is missing or pending.

*   **For Logic/Validation Errors (400/403)**:
    1.  **Inspect DTO**: Check the `class-validator` decorators in the DTO associated with the endpoint.
    2.  **Verify Payload**: Compare the provided payload with the DTO rules.
    3.  **Check Guards**: If it's a 403, check `Guard` classes and user permissions in the database.

## 3. Data Inspection

*   If the error is related to specific data (e.g., "record not found" or logic depending on data state):
    *   Query the database for the relevant records (e.g., `SELECT * FROM users WHERE id = ...`).
    *   Verify foreign key relationships and constraints.

## 4. Synthesis & Solution

*   **Root Cause**: Explicitly state the mismatch (e.g., "Code expects column `x`, but DB table `y` is missing it").
*   **Fix Options**:
    *   **Option 1 (Database Fix)**: Provide the SQL command to align the database with the code (e.g., `ALTER TABLE ... ADD COLUMN ...`).
    *   **Option 2 (Code Fix)**: If the code is incorrect, suggest the necessary code changes.
    *   **Option 3 (Payload Fix)**: If the request payload is wrong, provide the corrected payload.

## Example Workflow

1.  **User**: "I get a 500 error on POST /users with message 'column age does not exist'."
2.  **Agent**:
    *   Locates `UsersService.create`.
    *   Sees `INSERT INTO users (name, age) VALUES (...)`.
    *   Runs `\d users` in DB -> calculates `age` column is missing.
    *   Checks `migrations/` -> sees `2023...create_users.js` only has `name`.
    *   **Conclusion**: Migration for `age` is missing or not run.
    *   **Fix**: Run migration or manually add column.
