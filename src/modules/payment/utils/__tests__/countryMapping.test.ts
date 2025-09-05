import { getCountryCode, isValidCountryName, isValidCountryCode } from '../countryMapping';

/**
 * @description Test file for country mapping functionality
 * Run this to verify country mappings are working correctly
 */

// Test common countries
const testCountries = [
  { name: 'United States', expectedCode: 'US' },
  { name: 'Canada', expectedCode: 'CA' },
  { name: 'United Kingdom of Great Britain and Northern Ireland (the)', expectedCode: 'GB' },
  { name: 'Germany', expectedCode: 'DE' },
  { name: 'France', expectedCode: 'FR' },
  { name: 'Australia', expectedCode: 'AU' },
  { name: 'Japan', expectedCode: 'JP' },
  { name: 'Brazil', expectedCode: 'BR' },
  { name: 'Mexico', expectedCode: 'MX' },
  { name: 'China', expectedCode: 'CN' },
];

console.log('Testing Country Code Mapping:');
console.log('============================');

let allTestsPassed = true;

testCountries.forEach(({ name, expectedCode }) => {
  const actualCode = getCountryCode(name);
  const passed = actualCode === expectedCode;

  if (!passed) {
    allTestsPassed = false;
    console.error(`❌ FAILED: ${name} -> Expected: ${expectedCode}, Got: ${actualCode}`);
  } else {
    console.log(`✅ PASSED: ${name} -> ${actualCode}`);
  }
});

console.log('\nTesting Invalid Country:');
console.log('========================');
const invalidCountryCode = getCountryCode('Invalid Country Name');
console.log(`Invalid country defaults to: ${invalidCountryCode}`);

console.log('\nTesting Validation Functions:');
console.log('=============================');
console.log(`isValidCountryName('United States'): ${isValidCountryName('United States')}`);
console.log(`isValidCountryName('Fake Country'): ${isValidCountryName('Fake Country')}`);
console.log(`isValidCountryCode('US'): ${isValidCountryCode('US')}`);
console.log(`isValidCountryCode('XX'): ${isValidCountryCode('XX')}`);

console.log('\n' + '='.repeat(50));
if (allTestsPassed) {
  console.log('🎉 ALL TESTS PASSED! Country mapping is working correctly.');
} else {
  console.log('❌ SOME TESTS FAILED! Please check the country mappings.');
}
console.log('='.repeat(50));

export {}; // Make this a module
