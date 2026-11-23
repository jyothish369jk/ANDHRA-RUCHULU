export type MenuCategory =
  | 'All'
  | 'Starters (Vepudu)'
  | 'Royal Biryanis & Pulaos'
  | 'Coastal Curries'
  | 'Traditional Sweets';

export type DietaryType = 'Veg' | 'Non-Veg';

export type SpiceIntensity = 1 | 2 | 3;

export type SpicePreference = 'Mild Temper' | 'Authentic Andhra' | 'Fiery Guntur';

export type PortionStyle = 'Signature Plate' | 'Claypot Feast (+₹180)';

export interface MenuItem {
  id: string;
  name: string;
  teluguSubtitle: string;
  category: Exclude<MenuCategory, 'All'>;
  description: string;
  priceInr: number;
  dietary: DietaryType;
  spiceLevel: SpiceIntensity;
  spiceLabel: string;
  region: string;
  image: string;
  pairingNote: string;
}

export interface CartItem {
  cartKey: string;
  item: MenuItem;
  quantity: number;
  spicePreference: SpicePreference;
  portionStyle: PortionStyle;
  unitPriceInr: number;
  notes?: string;
}

export interface FlagshipLocation {
  id: 'hyderabad' | 'visakhapatnam';
  city: string;
  neighborhood: string;
  address: string;
  hours: string;
  phone: string;
  email: string;
  coordinatesLabel: string;
  landmarks: Array<{ id: string; label: string; x: number; y: number; distance: string }>;
}

export type ReservationOccasion =
  | 'Birthday'
  | 'Anniversary'
  | 'Family Dinner'
  | 'Casual Dining'
  | 'Corporate Event'
  | 'Other';

export interface TableBooking {
  id: string;
  name: string;
  phone: string;
  occasion: ReservationOccasion;
  guests: number;
  dateTime: string;
  bookedAt: string;
  status: 'Sent via WhatsApp (Awaiting Reply)';
  locationName?: string;
}
