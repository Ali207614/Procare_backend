import { User } from '../../../migrations/user.interface';

export interface RepairOrder {
  id: string;
  number_id: number;
  user_id: string;
  branch_id: string;

  total: string;
  imei: string | null;

  phone_category_id: string;
  status_id: string;

  delivery_method: 'Self' | 'Delivery';
  pickup_method: 'Self' | 'Pickup';

  sort: number;
  priority: 'Low' | 'Medium' | 'High' | 'Highest';
  priority_level: number;

  created_by: string;
  status: 'Open' | 'Deleted';

  created_at: string; // timestamp
  updated_at: string; // timestamp
}

export interface FreshRepairOrder {
  // repair_orders
  id: string;
  number_id: number;
  user_id: string;
  branch_id: string;
  total: string;
  imei: string | null;
  phone_category_id: string;
  status_id: string;
  delivery_method: 'Self' | 'Delivery';
  pickup_method: 'Self' | 'Pickup';
  sort: number;
  priority: 'Low' | 'Medium' | 'High' | 'Highest';
  priority_level: number;
  created_by: string;
  status: 'Open' | 'Deleted';
  created_at: string;
  updated_at: string;

  // from users
  client_first_name: string;
  client_last_name: string;
  client_phone_number: string;

  pickup_description: string | null;

  delivery_description: string | null;

  phone_name: string;
}

export interface RepairOrderDetails {
  // repair_orders
  id: string;
  number_id: number;
  user_id: string;
  branch_id: string;
  total: string;
  imei: string | null;
  phone_category_id: string;
  status_id: string;
  delivery_method: 'Self' | 'Delivery';
  pickup_method: 'Self' | 'Pickup';
  sort: number;
  priority: 'Low' | 'Medium' | 'High' | 'Highest';
  priority_level: number;
  created_by: string;
  status: 'Open' | 'Deleted';
  created_at: string;
  updated_at: string;

  // user info
  client_first_name: string;
  client_last_name: string;
  client_phone_number: string;

  // phone_categories
  phone_name: string;

  // created_by admin info
  created_by_name: string;
  created_by_phone: string;

  // status info
  status_name_uz: string;
  status_color: string;
  status_bg_color: string;

  // branch info
  branch_name: string;
  branch_color: string;
  branch_bg_color: string;

  // sub-entities (json_agg)
  assigned_admins: {
    admin_id: string;
    created_at: string;
  }[];

  initial_problems: {
    id: string;
    problem_category_id: string;
    price: string;
    estimated_minutes: number;
    created_by: string;
    created_at: string;
    updated_at: string;
  }[];

  final_problems: {
    id: string;
    problem_category_id: string;
    price: string;
    estimated_minutes: number;
    created_by: string;
    created_at: string;
    updated_at: string;
  }[];

  comments: {
    id: string;
    text: string;
    status: 'Open' | 'Deleted';
    created_by: string;
    status_by: string;
    created_at: string;
    updated_at: string;
  }[];

  pickups: {
    id: string;
    lat: string;
    long: string;
    description: string;
    is_main: boolean;
    status: 'Open' | 'Deleted';
    created_by: string;
    created_at: string;
    updated_at: string;
  }[];

  delivery: {
    id: string;
    lat: string;
    long: string;
    description: string;
    is_main: boolean;
    created_by: string;
    created_at: string;
    updated_at: string;
  } | null;

  rental_phone: {
    id: string;
    rental_phone_device_id: string;
    sap_order_id: string | null;
    is_free: boolean | null;
    price: string | null;
    currency: 'UZS' | 'USD' | 'EUR' | null;
    status: 'Active' | 'Returned' | 'Cancelled';
    rented_at: string;
    returned_at: string | null;
    notes: string | null;
    created_by: string;
    created_at: string;
    updated_at: string;
  } | null;
}


export interface JoinedRepairOrder {
  id: string;
  total: string;
  imei: string | null;
  delivery_method: 'Self' | 'Delivery';
  pickup_method: 'Self' | 'Pickup';
  priority: 'Low' | 'Medium' | 'High' | 'Highest';
  status: 'Open' | 'Deleted';
  created_at: string; // yoki Date

  // Branch info
  branch_name_uz: string | null;
  branch_name_ru: string | null;
  branch_name_en: string | null;

  // Phone category info
  phone_name_uz: string | null;
  phone_name_ru: string | null;
  phone_name_en: string | null;

  // Status info
  status_name_uz: string | null;
  status_name_ru: string | null;
  status_name_en: string | null;
}

export interface UserWithRepairOrders extends User {
  repair_orders: JoinedRepairOrder[];
}

