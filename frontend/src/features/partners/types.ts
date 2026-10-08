export interface Partner {
  id: number;
  name: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PartnerInput {
  name: string;
  note?: string;
}
