---
name: analyze_api_module
description: Comprehensive analysis of a NestJS API module to create Postman testing guidance.
---

# Analyze API Module Skill

Use this skill to perform a deep-dive analysis of a specific NestJS API module and produce a Postman-ready testing guide. This skill ensures you cover all aspects: controllers, services, DTOs, migrations, seeds, guards, and types.

## 📋 Steps for Analysis

### 1. Discovery phase
- **Module Path**: Locate the module in `src/[module_name]`.
- **Files**: List all files including `*.controller.ts`, `*.service.ts`, `*.module.ts`, and the `dto/` directory.
- **Database**: Search `migrations/` for tables created or modified for this module.
- **Initial Data**: Search `seeds/` for any seed data related to this module's tables.

### 2. Deep Dive Analysis
- **Controller**:
    - Identify all endpoints (`@Get`, `@Post`, `@Patch`, `@Delete`, etc.).
    - Note the path prefixes from `@Controller('path')`.
    - Check for guards (`@UseGuards`) such as `JwtAdminAuthGuard`, `PermissionsGuard`.
    - Note permissions required by `@SetPermissions(...)`.
- **DTOs & Validation**:
    - Read `*.dto.ts` files to understand payload structure.
    - Note `class-validator` decorators for validation rules (e.g., `@IsString()`, `@MinLength()`).
- **Service & Logic**:
    - Analyze the service methods to see how data is stored/transformed.
    - Check for database transactions or complex queries.
    - Identify side effects (e.g., creating history, sending notifications).
- **Types & Interfaces**:
    - Cross-reference with `src/common/types/` to understand the data models and response shapes.

### 3. Generate Postman Guide
Create a markdown file (e.g., `docs/[MODULE]_POSTMAN_GUIDE.md`) with:
- **Prerequisites**: Auth tokens, specific roles/permissions needed.
- **Environment Variables**: `base_url`, `admin_token`, module-specific IDs (e.g., `template_id`).
- **Endpoint Sections**: For each endpoint:
    - Method and URL.
    - Required Headers (include a **Bulk Edit Format** section for common headers like `Authorization`).
    - Query Parameters with descriptions AND a **Bulk Edit Format** code block for quick copy-pasting.
    - Sample JSON Request Body (if applicable).
    - Description of side effects or special behavior.
- **Postman Tips**: Scripts for setting environment variables from responses.

## 🛠 Useful Tools
- `list_dir` to explore the module and common directories.
- `view_file` to read code and documentation.
- `grep_search` to find related migrations, seeds, or permissions.
- `write_to_file` to save the final guide.

## 💡 Best Practices
- **Never guess**: If you see a guard, check its implementation if needed, but usually the name (e.g., `JwtAdminAuthGuard`) is enough to know auth is required.
- **Check Permissions**: Always look for `@SetPermissions` as it tells you exactly what the Admin must have.
- **Realistic Examples**: Use the `seeds/` data to create realistic examples in the guide.
- **Comprehensive Coverage**: Don't just list endpoints; explain *how* to test them (e.g., "Must create item A before testing GET item A").
