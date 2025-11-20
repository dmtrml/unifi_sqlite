import { parse as parseDate, isValid } from 'date-fns';
import type { NormalizedImportRow } from '@/lib/imports';
import type { Currency } from '@/lib/types';
import { formatDateLabel } from '@/lib/date';

export type ImportColumnMapping = Record<string, string>;
export type ImportField = { value: string; label: string };

export type TransferStub = {
  kind: 'transfer-stub';
  direction: 'out' | 'in';
  date: number;
  account: string;
  otherAccount: string;
  amount: number;
  currency: string;
  convertedAmount?: number;
  convertedCurrency?: string;
  description?: string;
  rawRow: Record<string, string>;
};

export type ImportProfileOptions = {
  delimiter?: string;
  decimalSeparator?: string;
  thousandsSeparator?: string;
};

export interface ImportProfile {
  id: string;
  label: string;
  description?: string;
  options?: ImportProfileOptions;
  fields?: ImportField[];
  inferMapping: (headers: string[]) => ImportColumnMapping;
  preprocessRows?: (rows: Record<string, string>[]) => Record<string, string>[];
  normalizeRow: (mappedRow: Record<string, string>, defaultCurrency: Currency) => NormalizedImportRow | TransferStub | null;
  finalize?: (items: (NormalizedImportRow | TransferStub)[], defaultCurrency: Currency) => NormalizedImportRow[];
}

const isTransferStub = (value: NormalizedImportRow | TransferStub): value is TransferStub =>
  Boolean(value && (value as TransferStub).kind === 'transfer-stub');

const ensureCurrencyValue = (value: string | undefined, fallback: Currency): Currency => {
  const normalized = value?.toUpperCase().trim();
  return (normalized as Currency) || fallback;
};

const normalizeKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9а-яё]/gi, '');

const parseAmount = (value: string | undefined, decimalSeparator = '.', thousandsSeparator = ' ') => {
  if (!value) return 0;
  const normalized = value
    .replace(new RegExp(String(thousandsSeparator), 'g'), '')
    .replace(',', decimalSeparator === ',' ? ',' : '.')
    .replace(/[^\d.-]/g, '');
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
};

const parseDateValue = (value: string | undefined) => {
  if (!value) return NaN;
  const parsed = parseDate(value, 'dd/MM/yyyy', new Date());
  return isValid(parsed) ? parsed.getTime() : NaN;
};

const ZEN_MONEY_FIELDS: ImportField[] = [
  { value: 'date', label: 'date' },
  { value: 'categoryName', label: 'categoryName' },
  { value: 'comment', label: 'comment' },
  { value: 'outcomeAccountName', label: 'outcomeAccountName' },
  { value: 'outcome', label: 'outcome' },
  { value: 'outcomeCurrency', label: 'outcomeCurrency' },
  { value: 'incomeAccountName', label: 'incomeAccountName' },
  { value: 'income', label: 'income' },
  { value: 'incomeCurrency', label: 'incomeCurrency' },
];


const ZEN_MONEY_FIELD_VARIANTS: Record<string, string[]> = {
  date: ['дата'],
  categoryName: ['category', 'категория'],
  comment: ['описание', 'note'],
  outcomeAccountName: ['account', 'счет', 'счёт'],
  outcome: ['расход'],
  outcomeCurrency: ['валюта'],
  incomeAccountName: ['счет поступления', 'счёт поступления'],
  income: ['доход'],
  incomeCurrency: ['валюта поступления'],
};

const zenMoneyProfile: ImportProfile = {
  id: 'zenmoney',
  label: 'ZenMoney',
  description: 'Default behavior for ZenMoney CSV exports',
  options: {
    delimiter: ';',
  },
  fields: ZEN_MONEY_FIELDS,
  inferMapping: (headers) => {
    const mapping: ImportColumnMapping = {};
    const normalizedHeaders = headers.map((header) => ({
      original: header,
      simplified: normalizeKey(header),
    }));

    Object.entries(ZEN_MONEY_FIELD_VARIANTS).forEach(([field, variants]) => {
      const normalizedField = normalizeKey(field);
      const lookup = [normalizedField, ...variants.map(normalizeKey)];
      const match = normalizedHeaders.find((candidate) =>
        lookup.some((variant) => candidate.simplified === variant),
      );
      if (match) {
        mapping[match.original] = field;
      }
    });

    headers.forEach((header) => {
      if (!mapping[header]) {
        mapping[header] = 'ignore';
      }
    });

    return mapping;
  },
  normalizeRow: (mappedRow, defaultCurrency) => {
    const dateValue = new Date(mappedRow.date);
    if (isNaN(dateValue.getTime())) {
      throw new Error(`Invalid date: ${mappedRow.date}`);
    }

    const incomeAmount = Number(mappedRow.income) || 0;
    const outcomeAmount = Number(mappedRow.outcome) || 0;

    if (!Number.isFinite(incomeAmount) || !Number.isFinite(outcomeAmount)) {
      throw new Error('Invalid numeric amount');
    }

    const description = mappedRow.comment?.trim() || 'Imported Transaction';

    if (incomeAmount > 0 && outcomeAmount > 0) {
      const fromAccountName = mappedRow.outcomeAccountName?.trim();
      const toAccountName = mappedRow.incomeAccountName?.trim();
      if (!fromAccountName || !toAccountName) {
        throw new Error('Transfer accounts missing');
      }
      return {
        transactionType: 'transfer',
        date: dateValue.getTime(),
        description,
        amountSent: Math.abs(outcomeAmount),
        amountReceived: Math.abs(incomeAmount),
        fromAccountName,
        fromAccountCurrency: ensureCurrencyValue(mappedRow.outcomeCurrency, defaultCurrency),
        toAccountName,
        toAccountCurrency: ensureCurrencyValue(mappedRow.incomeCurrency, defaultCurrency),
      };
    }

    if (outcomeAmount > 0) {
      const accountName = mappedRow.outcomeAccountName?.trim() || mappedRow.incomeAccountName?.trim();
      if (!accountName) {
        throw new Error('Account not provided for expense');
      }
      return {
        transactionType: 'expense',
        date: dateValue.getTime(),
        description,
        amount: Math.abs(outcomeAmount),
        accountName,
        accountCurrency: ensureCurrencyValue(
          mappedRow.outcomeCurrency || mappedRow.incomeCurrency,
          defaultCurrency,
        ),
        categoryName: mappedRow.categoryName?.trim() || null,
      };
    }

    if (incomeAmount > 0) {
      const accountName = mappedRow.incomeAccountName?.trim() || mappedRow.outcomeAccountName?.trim();
      if (!accountName) {
        throw new Error('Account not provided for income');
      }
      return {
        transactionType: 'income',
        date: dateValue.getTime(),
        description,
        amount: Math.abs(incomeAmount),
        accountName,
        accountCurrency: ensureCurrencyValue(
          mappedRow.incomeCurrency || mappedRow.outcomeCurrency,
          defaultCurrency,
        ),
        categoryName: mappedRow.categoryName?.trim() || null,
      };
    }

    return null;
  },
};

const MONEFY_FIELD_VARIANTS: Record<string, string[]> = {
  date: [],
  outcomeAccountName: ['account'],
  categoryName: [],
  amount: [],
  outcomeCurrency: ['currency'],
  convertedAmount: ['convertedamount'],
  convertedCurrency: ['convertedcurrency'],
  comment: ['description'],
};

const monefyProfile: ImportProfile = {
  id: 'monefy',
  label: 'Monefy',
  description: 'CSV exports from the Monefy app',
  options: {
    delimiter: ';',
    decimalSeparator: '.',
    thousandsSeparator: ' ',
  },
  fields: [
    { value: 'date', label: 'date' },
    { value: 'outcomeAccountName', label: 'account' },
    { value: 'categoryName', label: 'category' },
    { value: 'amount', label: 'amount' },
    { value: 'outcomeCurrency', label: 'currency' },
    { value: 'convertedAmount', label: 'converted amount' },
    { value: 'convertedCurrency', label: 'converted currency' },
    { value: 'comment', label: 'description' },
  ],
  inferMapping: (headers) => {
    const mapping: ImportColumnMapping = {};
    const normalizedHeaders = headers.map((header) => ({
      original: header,
      simplified: normalizeKey(header),
    }));

    headers.forEach((header) => {
      mapping[header] = 'ignore';
    });

    Object.entries(MONEFY_FIELD_VARIANTS).forEach(([field, variants]) => {
      const normalizedField = normalizeKey(field);
      const lookup = [normalizedField, ...variants.map(normalizeKey)];
      const match = normalizedHeaders.find((candidate) =>
        lookup.some((variant) => candidate.simplified === variant),
      );
      if (match) {
        mapping[match.original] = field;
      }
    });

    return mapping;
  },
  normalizeRow: (mappedRow, defaultCurrency) => {
    const dateValue = parseDateValue(mappedRow.date);
    if (!Number.isFinite(dateValue)) {
      throw new Error(`Invalid date: ${mappedRow.date}`);
    }

    const options = { decimalSeparator: '.', thousandsSeparator: ' ' };
    const amount = parseAmount(mappedRow.amount, options.decimalSeparator, options.thousandsSeparator);
    if (!Number.isFinite(amount) || amount === 0) {
      throw new Error('Amount is required.');
    }

    const accountName = mappedRow.outcomeAccountName?.trim();
    if (!accountName) {
      throw new Error('Account is required.');
    }

    const category = mappedRow.categoryName?.trim() ?? '';
    const description = mappedRow.comment?.trim() ?? '';
    const accountCurrency = ensureCurrencyValue(mappedRow.outcomeCurrency, defaultCurrency);
    const convertedAmount = parseAmount(mappedRow.convertedAmount, options.decimalSeparator, options.thousandsSeparator);
    const convertedCurrency = mappedRow.convertedCurrency
      ? ensureCurrencyValue(mappedRow.convertedCurrency, defaultCurrency)
      : undefined;

    const transferToMatch = category.match(/^to\s+'(.+)'/i);
    if (transferToMatch) {
      const otherAccount = transferToMatch[1].trim();
      return {
        kind: 'transfer-stub',
        direction: 'out',
        date: dateValue,
        account: accountName,
        otherAccount,
        amount,
        currency: accountCurrency,
        convertedAmount,
        convertedCurrency,
        description,
        rawRow: mappedRow,
      };
    }

    const transferFromMatch = category.match(/^from\s+'(.+)'/i);
    if (transferFromMatch) {
      const otherAccount = transferFromMatch[1].trim();
      return {
        kind: 'transfer-stub',
        direction: 'in',
        date: dateValue,
        account: accountName,
        otherAccount,
        amount,
        currency: accountCurrency,
        convertedAmount,
        convertedCurrency,
        description,
        rawRow: mappedRow,
      };
    }

    if (amount < 0) {
      return {
        transactionType: 'expense',
        date: dateValue,
        description,
        amount: Math.abs(amount),
        accountName,
        accountCurrency,
        categoryName: category || null,
      };
    }

    return {
      transactionType: 'income',
      date: dateValue,
      description,
      amount: Math.abs(amount),
      accountName,
      accountCurrency,
      categoryName: category || null,
    };
  },
  finalize: (items) => {
    const transfers: TransferStub[] = [];
    const normalized: NormalizedImportRow[] = [];
    items.forEach((item) => {
      if (isTransferStub(item)) {
        transfers.push(item);
      } else {
        normalized.push(item);
      }
    });

    const used = new Set<TransferStub>();
    const DAY_MS = 24 * 60 * 60 * 1000;

    transfers.forEach((stub) => {
      if (used.has(stub) || stub.direction !== 'out') {
        return;
      }
      const partner = transfers.find(
        (candidate) =>
          candidate !== stub &&
          !used.has(candidate) &&
          candidate.direction === 'in' &&
          candidate.account === stub.otherAccount &&
          candidate.otherAccount === stub.account &&
          Math.abs(candidate.date - stub.date) <= DAY_MS,
      );
      if (partner) {
        used.add(stub);
        used.add(partner);
        normalized.push({
          transactionType: 'transfer',
          date: stub.date,
          description: stub.description ?? partner.description ?? '',
          fromAccountName: stub.account,
          toAccountName: partner.account,
          amountSent: Math.abs(stub.amount),
          amountReceived: Math.abs(partner.amount),
          fromAccountCurrency: stub.currency,
          toAccountCurrency: partner.currency,
        });
        return;
      }

      if (stub.convertedAmount && stub.convertedCurrency) {
        used.add(stub);
        normalized.push({
          transactionType: 'transfer',
          date: stub.date,
          description: stub.description ?? '',
          fromAccountName: stub.account,
          toAccountName: stub.otherAccount,
          amountSent: Math.abs(stub.amount),
          amountReceived: Math.abs(stub.convertedAmount),
          fromAccountCurrency: stub.currency,
          toAccountCurrency: stub.convertedCurrency,
        });
        return;
      }

      throw new Error(
        `Unpaired transfer between ${stub.account} and ${stub.otherAccount} on ${formatDateLabel(stub.date)}`,
      );
    });

    return normalized;
  },
};

const profiles: ImportProfile[] = [zenMoneyProfile, monefyProfile];

export const DEFAULT_IMPORT_PROFILE_ID = zenMoneyProfile.id;

export const importProfiles = profiles;

export const getImportProfile = (id?: string | null): ImportProfile => {
  const profile = id ? profiles.find((item) => item.id === id) : null;
  return profile ?? zenMoneyProfile;
};
