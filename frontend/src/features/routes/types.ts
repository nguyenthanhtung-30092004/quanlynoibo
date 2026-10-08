export interface Route {
  id: number;
  name: string;
  origin: string;
  destination: string;
  defaultPrice?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRouteInput {
  name: string;
  origin: string;
  destination: string;
  defaultPrice?: number;
  isActive?: boolean;
}

export interface UpdateRouteInput {
  name?: string;
  origin?: string;
  destination?: string;
  defaultPrice?: number;
  isActive?: boolean;
}

export interface RouteFilters {
  search?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}
