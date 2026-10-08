export interface Carrier {
  id: number;
  name: string;
  phone?: string;
  address?: string;
  note?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCarrierInput {
  name: string;
  phone?: string;
  address?: string;
  note?: string;
  isActive?: boolean;
}

export interface UpdateCarrierInput {
  name?: string;
  phone?: string;
  address?: string;
  note?: string;
  isActive?: boolean;
}

export interface CarrierFilters {
  search?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}
