const EVENT_NAME = 'transactions:changed';

export const notifyTransactionsChanged = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(EVENT_NAME));
};

export const subscribeToTransactions = (handler: () => void) => {
  if (typeof window === 'undefined') {
    return () => {};
  }
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
};
