export interface ProblemWithParts {
  problem_category_id: string;
  price: number;
  estimated_minutes: number;
  parts?: { id: string; part_price: number; quantity: number }[];
}
