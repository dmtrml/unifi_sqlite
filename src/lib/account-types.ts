const ACCOUNT_TYPE_RULES: { type: string; keywords: string[] }[] = [
  { type: 'Cash', keywords: ['налич', 'cash'] },
  { type: 'Bank Account', keywords: ['счет', 'счёт', 'account'] },
  { type: 'Deposit', keywords: ['вклад', 'депозит', 'deposit', 'saving'] },
  { type: 'Loan', keywords: ['кредит', 'loan', 'debt'] },
];

const DEFAULT_ACCOUNT_TYPE = 'Card';

export const inferAccountType = (name: string | null | undefined): string => {
  if (!name) return DEFAULT_ACCOUNT_TYPE;
  const normalized = name.toLowerCase();
  for (const rule of ACCOUNT_TYPE_RULES) {
    if (rule.keywords.some((keyword) => normalized.includes(keyword))) {
      return rule.type;
    }
  }
  return DEFAULT_ACCOUNT_TYPE;
};
