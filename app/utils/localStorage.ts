const STORAGE_KEYS = {
  SHARE_AMOUNT: 'ticker_deck_share_amount',
} as const;

export function getStoredShareAmount(): number {
  if (typeof window === 'undefined') return 4900; // Default for SSR
  
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.SHARE_AMOUNT);
    return stored ? parseInt(stored, 10) : 4900;
  } catch (error) {
    console.warn('Failed to read from localStorage:', error);
    return 5000;
  }
}

export function setStoredShareAmount(amount: number): void {
  if (typeof window === 'undefined') return; // Skip during SSR
  
  try {
    localStorage.setItem(STORAGE_KEYS.SHARE_AMOUNT, amount.toString());
  } catch (error) {
    console.warn('Failed to write to localStorage:', error);
  }
}
