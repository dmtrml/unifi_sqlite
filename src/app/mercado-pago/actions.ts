'use server';

import { z } from 'zod';
import type { SimplifiedTransaction } from './page';

const MercadoPagoTransactionSchema = z.object({
  id: z.string(),
  date_created: z.string(),
  date_approved: z.string().nullable(),
  description: z.string().nullable(),
  transaction_amount: z.number(),
  status: z.string(),
  currency_id: z.string(),
  payer: z.object({
    email: z.string().nullable(),
  }).nullable(),
});

const MercadoPagoResponseSchema = z.object({
  results: z.array(MercadoPagoTransactionSchema),
});

export async function getMercadoPagoTransactions(accessToken: string): Promise<{ success: true; data: SimplifiedTransaction[] } | { success: false; error: string }> {
  
  if (!accessToken) {
    return { success: false, error: 'Access Token not provided.' };
  }

  const MERCADO_PAGO_API_URL = 'https://api.mercadolibre.com/collections/search';

  try {
    const response = await fetch(`${MERCADO_PAGO_API_URL}?sort=date_created&criteria=desc`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Mercado Pago API Error:', errorData);
      return { success: false, error: `Mercado Pago API Error: ${errorData.message || 'Could not fetch data.'}` };
    }

    const rawData = await response.json();
    // Выводим сырые данные в консоль ДО валидации
    console.error('Raw Data from Mercado Pago:', JSON.stringify(rawData, null, 2));
    
    const parsedResponse = MercadoPagoResponseSchema.safeParse(rawData);

    if (!parsedResponse.success) {
        console.error('Validation Error:', parsedResponse.error.flatten());
        return { success: false, error: 'Invalid data received from Mercado Pago.' };
    }

    const simplifiedTransactions = parsedResponse.data.results.map((tx) => ({
      id: tx.id,
      date: tx.date_approved || tx.date_created,
      description: tx.description || 'No description',
      amount: tx.transaction_amount,
      currency: tx.currency_id,
      type: 'income' as const, 
      status: tx.status,
      payer: tx.payer?.email || 'Unknown',
    }));

    return { success: true, data: simplifiedTransactions };

  } catch (error) {
    console.error('Failed to fetch Mercado Pago transactions:', error);
    if (error instanceof Error) {
        return { success: false, error: `Internal server error: ${error.message}` };
    }
    return { success: false, error: 'An unknown error occurred.' };
  }
}
