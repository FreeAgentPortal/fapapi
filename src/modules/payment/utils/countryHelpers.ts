import { getCountryCode, getAllCountryNames } from './countryMapping';

/**
 * @description Helper functions for working with country data in forms and APIs
 */

export interface CountryOption {
  name: string;
  code: string;
  value: string; // Can be either name or code depending on frontend needs
}

/**
 * @description Generate country options for frontend dropdowns
 * @param useCodeAsValue - If true, uses 2-character code as value, otherwise uses full name
 * @returns Array of country options with name, code, and value
 */
export function generateCountryOptions(useCodeAsValue: boolean = false): CountryOption[] {
  const countryNames = getAllCountryNames();

  return countryNames.map((name) => ({
    name,
    code: getCountryCode(name),
    value: useCodeAsValue ? getCountryCode(name) : name,
  }));
}

/**
 * @description Convert frontend country list to country options
 * @param countries - Array of country names from frontend
 * @param useCodeAsValue - If true, uses 2-character code as value
 * @returns Array of country options
 */
export function convertCountriesArray(countries: string[], useCodeAsValue: boolean = false): CountryOption[] {
  return countries.map((name) => ({
    name,
    code: getCountryCode(name),
    value: useCodeAsValue ? getCountryCode(name) : name,
  }));
}

/**
 * @description Validate and normalize country input from frontend
 * @param countryInput - Country name or code from frontend
 * @returns Object with normalized name and code, or null if invalid
 */
export function normalizeCountryInput(countryInput: string): { name: string; code: string } | null {
  // First try as a country name
  const codeFromName = getCountryCode(countryInput);
  if (codeFromName !== 'US' || countryInput === 'United States') {
    // Found a valid mapping or it's actually US
    return {
      name: countryInput,
      code: codeFromName,
    };
  }

  // If input is already a 2-character code, find the name
  if (countryInput.length === 2) {
    const countryNames = getAllCountryNames();
    const foundName = countryNames.find((name) => getCountryCode(name) === countryInput.toUpperCase());

    if (foundName) {
      return {
        name: foundName,
        code: countryInput.toUpperCase(),
      };
    }
  }

  return null;
}

/**
 * @description Get payment processor safe country code
 * @param countryInput - Country name or code from frontend
 * @returns 2-character country code safe for payment processors
 */
export function getPaymentSafeCountryCode(countryInput: string): string {
  const normalized = normalizeCountryInput(countryInput);
  return normalized ? normalized.code : 'US'; // Default to US for payment processors
}
