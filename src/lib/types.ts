export type Product = {
  id: string; sku: string | null; name_ar: string; name_en: string | null; unit_ar: string | null; cost_price: number; sale_price: number;
  barcode: string | null; brand: string | null; model: string | null; is_service: boolean; track_serial: boolean;
  tax_rate: number; warranty_months: number; reorder_level: number; is_active: boolean; category_id: string | null;
};
export type Contact = {
  id: string; code: string | null; name_ar: string; type: "customer" | "supplier" | "both"; phone: string | null;
  email: string | null; address_ar: string | null; tax_number: string | null; credit_limit: number; is_active: boolean;
};
