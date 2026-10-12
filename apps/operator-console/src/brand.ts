import brand from '../../../brand.json';

/** The product and company names every screen shows. Edit `brand.json` at the repository root, never this file. */
export const BRAND = {
  productName: brand.productName,
  companyName: brand.companyName,
} as const;
