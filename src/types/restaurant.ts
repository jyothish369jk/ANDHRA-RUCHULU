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
  id: 'madhuravada-vizag';
  city: string;
  neighborhood: string;
  address: string;
  shortAddress: string;
  hours: string;
  phone: string;
  email: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  coordinatesLabel: string;
  directionsUrl: string;
}

export type ReservationOccasion =
  | 'Birthday'
  | 'Anniversary'
  | 'Family Dinner'
  | 'Casual Dining'
  | 'Corporate Event'
  | 'Other';

export type BookingStatus =
  | 'Pending'
  | 'Sent via WhatsApp (Awaiting Reply)'
  | 'Confirmed'
  | 'Seated'
  | 'Completed'
  | 'Cancelled';

export interface TableBooking {
  id: string;
  name: string;
  phone: string;
  occasion: ReservationOccasion;
  guests: number;
  dateTime: string;
  bookedAt: string;
  status: BookingStatus;
  locationName?: string;
  updatedAt?: string;
}

export type OrderStatus = 'New' | 'Pending' | 'Preparing' | 'Delivered' | 'Cancelled';

export type OrderFulfillmentType = 'Delivery' | 'Pickup';

export interface OrderLineItem {
  itemId: string;
  name: string;
  quantity: number;
  spicePreference: SpicePreference;
  portionStyle: PortionStyle;
  unitPriceInr: number;
  lineTotalInr: number;
  notes?: string;
  fulfillmentType?: OrderFulfillmentType;
  deliveryAddress?: string;
}

export interface CustomerOrder {
  id: string;
  customerName: string;
  customerPhone: string;
  fulfillmentType: OrderFulfillmentType;
  deliveryAddress: string;
  items: OrderLineItem[];
  subtotalInr: number;
  taxesInr: number;
  totalAmountInr: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

export type AggregatorPlatform = 'Zomato' | 'Swiggy';

export type AggregatorEntrySource = 'Seeded' | 'Manual' | 'CSV';

export type AggregatorSettlementStatus = 'Settled' | 'Processing';

export interface AggregatorAnalyticsEntry {
  id: string;
  platform: AggregatorPlatform;
  date: string;
  orders: number;
  cancelledOrders?: number;
  grossSalesInr: number;
  deductionsInr: number;
  commissionInr?: number;
  gstInr?: number;
  packagingInr?: number;
  adsDiscountInr?: number;
  netPayoutInr: number;
  settlementStatus?: AggregatorSettlementStatus;
  orderId?: string;
  source: AggregatorEntrySource;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AggregatorEntryInput {
  platform: AggregatorPlatform;
  date: string;
  orders: number;
  cancelledOrders?: number;
  grossSalesInr: number;
  deductionsInr: number;
  commissionInr?: number;
  gstInr?: number;
  packagingInr?: number;
  adsDiscountInr?: number;
  settlementStatus?: AggregatorSettlementStatus;
  orderId?: string;
  source?: AggregatorEntrySource;
  notes?: string;
}

