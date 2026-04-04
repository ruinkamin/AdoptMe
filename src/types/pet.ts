export interface Pet {
  id: string;
  type: "cat" | "dog";
  breed_visual?: string;
  name: string;
  sex?: string;
  description?: string;
  age_months?: number;
  size?: string;
  weight_kg?: number;
  color?: string;
  sterilized?: boolean;
  temperament_tags?: string[];
  health_status?: string;
  medical_conditions?: string;
  ideal_owner_tags?: string[];
  photo_url?: string;
  monthly_cost?: number;
  status?: "available" | "trial" | "adopted";
  deleted_at?: string | null;

  // TVL backward compatibility
  age?: string;
  breed?: string;
  temperament?: string;
  imageUrl?: string;
  estimatedCost?: number;
  timeNeeded?: string;
  costBreakdown?: {
    food: number;
    medical: number;
    other: number;
  };
}

export interface AdoptionFormData {
  fullName: string;
  phone: string;
  address: string;
  date: string;
  time: string;
  hasChildren: boolean;
  hasOtherPets: boolean;
  understandsCommitment: boolean;
}

export interface Application {
  id: string;
  user_id: string;
  pet_id: string;
  type: string;
  full_name: string;
  phone: string;
  address: string;
  has_children: boolean;
  has_other_pets: boolean;
  booking_date: string;
  booking_time: string;
  date?: string;
  time?: string;
  agreed_to_costs: boolean;
  status: string;
  created_at: string;
  user_name?: string;
  pet_name?: string;
  userName?: string;
  petName?: string;
}

export type AdoptionType = "trial" | "adoption";