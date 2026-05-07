import { Knex } from 'knex';
import Redis from 'ioredis';

export interface AdminResponse {
  id: string;
  login: string;
  first_name: string;
  last_name: string;
  phone: string;
  branch_id: string;
  status: string;
}

export interface PermissionResponse {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface RoleResponse {
  id: string;
  name: string;
  description: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface BranchResponse {
  id: string;
  name: string;
  address: string;
  phone: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface UserResponse {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  repair_orders?: any[];
}

export type TestKnex = Knex;
export type TestRedis = Redis;
