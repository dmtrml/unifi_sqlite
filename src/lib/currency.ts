import type { Currency } from './types';

// Hardcoded exchange rates relative to USD for simplicity.
// In a real application, these would be fetched from an API.
const staticExchangeRates: Record<Currency, number> = {
  "USD": 1,
  "EUR": 0.93,    // 1 USD = 0.93 EUR
  "JPY": 157.0,   // 1 USD = 157 JPY
  "GBP": 0.79,    // 1 USD = 0.79 GBP
  "CHF": 0.90,    // 1 USD = 0.90 CHF
  "CAD": 1.37,    // 1 USD = 1.37 CAD
  "AUD": 1.50,    // 1 USD = 1.50 AUD
  "CNY": 7.25,    // 1 USD = 7.25 CNY
  "INR": 83.5,    // 1 USD = 83.5 INR
  "ARS": 900.0,   // 1 USD = 900.0 ARS
  "RUB": 90.0,    // 1 USD = 90.0 RUB
};

/**
 * Converts an amount from one currency to another using a static exchange rate table.
 *
 * @param amount The amount of money to convert.
 * @param fromCurrency The currency of the initial amount.
 * @param toCurrency The target currency to convert to.
 * @returns The converted amount in the target currency.
 */
export function convertAmount(
  amount: number,
  fromCurrency: Currency,
  toCurrency: Currency
): number {
  if (fromCurrency === toCurrency) {
    return amount;
  }

  // Convert the initial amount to USD first
  const amountInUSD = amount / staticExchangeRates[fromCurrency];

  // Then convert from USD to the target currency
  const convertedAmount = amountInUSD * staticExchangeRates[toCurrency];

  return convertedAmount;
}

    