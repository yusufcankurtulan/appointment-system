export interface SiteProfile {
  slug: string;
  companyName: string;
  category: string;
  tagline: string;
  about: string;
  phone: string;
  email: string;
  address: string;
  workingHours: string;
  workStart: string;
  workEnd: string;
  workDays: string;
  slotDuration: number;
  services: string;
  primaryColor: string;
  logoUrl: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerToken?: string;
  createdAt: string;
  updatedAt: string;
}

export type SiteProfileInput = Omit<SiteProfile, "createdAt" | "updatedAt">;

export interface Appointment {
  id: string;
  siteSlug: string;
  date: string;
  time: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  note: string;
  createdAt: string;
}

export interface TimeSlot {
  time: string;
  available: boolean;
}
