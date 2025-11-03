import { User } from 'src/common/types/user.interface';

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
  status: 'Open' | 'Deleted' | 'Closed' | 'Cancelled';

  created_at: string; // timestamp
  updated_at: string; // timestamp
}

export interface FreshRepairOrder {
  id: string;
  number_id: number;
  total: string;
  imei: string | null;
  delivery_method: 'Self' | 'Delivery';
  pickup_method: 'Self' | 'Pickup';
  sort: number;
  priority: 'Low' | 'Medium' | 'High' | 'Highest';
  status_id: string;
  user: {
    id: string | null;
    first_name: string | null;
    last_name: string | null;
    phone_number1: string | null;
    phone_number2: string | null;
  };
  created_by_admin: {
    id: string | null;
    first_name: string | null;
    last_name: string | null;
    phone_number: string | null;
  };
  phone_category: {
    id: string | null;
    name_uz: string | null;
    name_ru: string | null;
    name_en: string | null;
  };
  repair_order_status: {
    id: string | null;
    name_uz: string | null;
    name_ru: string | null;
    name_en: string | null;
  };
  branch: {
    id: string | null;
    name_uz: string | null;
    name_ru: string | null;
    name_en: string | null;
  };
  assigned_admins: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    phone_number: string | null;
    created_at: string;
  }[];
  initial_problems: {
    id: string;
    problem_category: {
      id: string | null;
      name_uz: string | null;
      name_ru: string | null;
      name_en: string | null;
    };
    price: string;
    estimated_minutes: number;
    created_by: string;
    created_at: string;
    updated_at: string;
    parts: {
      id: string;
      repair_part: {
        id: string | null;
        name_uz: string | null;
        name_ru: string | null;
        name_en: string | null;
        price: string | null;
        quantity: number | null;
        description_uz: string | null;
        description_ru: string | null;
        description_en: string | null;
        status: 'Open' | 'Deleted' | null;
        created_by: string | null;
        created_at: string | null;
        updated_at: string | null;
      };
      quantity: number;
      part_price: string;
      created_by: string;
      created_at: string;
      updated_at: string;
    }[];
  }[];
  final_problems: {
    id: string;
    problem_category: {
      id: string | null;
      name_uz: string | null;
      name_ru: string | null;
      name_en: string | null;
    };
    price: string;
    estimated_minutes: number;
    created_by: string;
    created_at: string;
    updated_at: string;
    parts: {
      id: string;
      repair_part: {
        id: string | null;
        name_uz: string | null;
        name_ru: string | null;
        name_en: string | null;
        price: string | null;
        quantity: number | null;
        description_uz: string | null;
        description_ru: string | null;
        description_en: string | null;
        status: 'Open' | 'Deleted' | null;
        created_by: string | null;
        created_at: string | null;
        updated_at: string | null;
      };
      quantity: number;
      part_price: string;
      created_by: string;
      created_at: string;
      updated_at: string;
    }[];
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
    courier: {
      id: string | null;
      first_name: string | null;
      last_name: string | null;
      phone_number: string | null;
    };
    created_by: string;
    created_at: string;
    updated_at: string;
  }[];
  delivery: {
    id: string | null;
    lat: string | null;
    long: string | null;
    description: string | null;
    is_main: boolean | null;
    courier: {
      id: string | null;
      first_name: string | null;
      last_name: string | null;
      phone_number: string | null;
    } | null;
    created_by: string | null;
    created_at: string | null;
    updated_at: string | null;
  };
  rental_phone: {
    id: string | null;
    rental_phone_device_id: string | null;
    sap_order_id: string | null;
    is_free: boolean | null;
    price: string | null;
    currency: 'UZS' | 'USD' | 'EUR' | null;
    status: 'Active' | 'Returned' | 'Cancelled' | null;
    rented_at: string | null;
    returned_at: string | null;
    notes: string | null;
    created_by: string | null;
    created_at: string | null;
    updated_at: string | null;
  };
}

export interface RepairOrderDetails {
  id: string;
  number_id: number;
  total: string;
  imei: string | null;
  delivery_method: 'Self' | 'Delivery';
  pickup_method: 'Self' | 'Pickup';
  sort: number;
  priority: 'Low' | 'Medium' | 'High' | 'Highest';
  user: {
    id: string | null;
    first_name: string | null;
    last_name: string | null;
    phone_number1: string | null;
    phone_number2: string | null;
  };
  created_by_admin: {
    id: string | null;
    first_name: string | null;
    last_name: string | null;
    phone_number: string | null;
  };
  phone_category: {
    id: string | null;
    name_uz: string | null;
    name_ru: string | null;
    name_en: string | null;
  };
  repair_order_status: {
    id: string;
    name_uz: string;
    name_ru: string;
    name_en: string;
  };
  branch: {
    id: string;
    name_uz: string;
    name_ru: string;
    name_en: string;
  };
  assigned_admins: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    phone_number: string | null;
    created_at: string;
  }[];
  initial_problems: {
    id: string;
    problem_category: {
      id: string | null;
      name_uz: string | null;
      name_ru: string | null;
      name_en: string | null;
    };
    price: string;
    estimated_minutes: number;
    created_by: string;
    created_at: string;
    updated_at: string;
    parts: {
      id: string;
      repair_part: {
        id: string | null;
        name_uz: string | null;
        name_ru: string | null;
        name_en: string | null;
        price: string | null;
        quantity: number | null;
        description_uz: string | null;
        description_ru: string | null;
        description_en: string | null;
        status: 'Open' | 'Deleted' | null;
        created_by: string | null;
        created_at: string | null;
        updated_at: string | null;
      };
      quantity: number;
      part_price: string;
      created_by: string;
      created_at: string;
      updated_at: string;
    }[];
  }[];
  final_problems: {
    id: string;
    problem_category: {
      id: string | null;
      name_uz: string | null;
      name_ru: string | null;
      name_en: string | null;
    };
    price: string;
    estimated_minutes: number;
    created_by: string;
    created_at: string;
    updated_at: string;
    parts: {
      id: string;
      repair_part: {
        id: string | null;
        name_uz: string | null;
        name_ru: string | null;
        name_en: string | null;
        price: string | null;
        quantity: number | null;
        description_uz: string | null;
        description_ru: string | null;
        description_en: string | null;
        status: 'Open' | 'Deleted' | null;
        created_by: string | null;
        created_at: string | null;
        updated_at: string | null;
      };
      quantity: number;
      part_price: string;
      created_by: string;
      created_at: string;
      updated_at: string;
    }[];
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
    courier: {
      id: string | null;
      first_name: string | null;
      last_name: string | null;
      phone_number: string | null;
    };
    created_by: string;
    created_at: string;
    updated_at: string;
  }[];
  delivery: {
    id: string | null;
    lat: string | null;
    long: string | null;
    description: string | null;
    is_main: boolean | null;
    courier: {
      id: string | null;
      first_name: string | null;
      last_name: string | null;
      phone_number: string | null;
    } | null;
    created_by: string | null;
    created_at: string | null;
    updated_at: string | null;
  };
  rental_phone: {
    id: string | null;
    rental_phone_device_id: string | null;
    sap_order_id: string | null;
    is_free: boolean | null;
    price: string | null;
    currency: 'UZS' | 'USD' | 'EUR' | null;
    status: 'Active' | 'Returned' | 'Cancelled' | null;
    rented_at: string | null;
    returned_at: string | null;
    notes: string | null;
    created_by: string | null;
    created_at: string | null;
    updated_at: string | null;
  };
}

export interface JoinedRepairOrder {
  id: string;
  total: string;
  imei: string | null;
  delivery_method: 'Self' | 'Delivery';
  pickup_method: 'Self' | 'Pickup';
  priority: 'Low' | 'Medium' | 'High' | 'Highest';
  status: 'Open' | 'Deleted' | 'Closed' | 'Cancelled';
  created_at: string;

  branch: {
    id: string | null;
    name_uz: string | null;
    name_ru: string | null;
    name_en: string | null;
  };

  phone_category: {
    id: string | null;
    name_uz: string | null;
    name_ru: string | null;
    name_en: string | null;
  };

  repair_order_status: {
    id: string | null;
    name_uz: string | null;
    name_ru: string | null;
    name_en: string | null;
    color: string | null;
    bg_color: string | null;
  };
}


export interface UserWithRepairOrders extends User {
  repair_orders: JoinedRepairOrder[];
}
