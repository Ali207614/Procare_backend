-- Initial database setup for Procare Backend
-- This file is executed when PostgreSQL container starts for the first time

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- You can add initial schema setup here if needed
-- Tables will be created by Knex migrations