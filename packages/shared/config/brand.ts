import brand from '../../../brand.json';

/** The product and company names every message to a person uses. Edit `brand.json` at the repository root, never this file. */
export const BRAND = {
  productName: brand.productName,
  companyName: brand.companyName,
} as const;
