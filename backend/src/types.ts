export interface SiteProfile {
  slug: string;
  companyName: string;
  tagline: string;
  about: string;
  phone: string;
  email: string;
  address: string;
  workingHours: string;
  services: string;
  primaryColor: string;
  logoUrl: string;
  createdAt: string;
  updatedAt: string;
}

export type SiteProfileInput = Omit<SiteProfile, "createdAt" | "updatedAt">;
