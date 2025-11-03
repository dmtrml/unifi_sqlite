'use server';

import { z } from 'zod';

const MercadoPagoPagingSchema = z.object({
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
});

const MercadoPagoTransactionSchema = z.object({
  id: z.number(),
  date_approved: z.string().nullable(),
  date_created: z.string(),
  description: z.string().nullable(),
  transaction_amount: z.number(),
  status: z.string(),
  currency_id: z.string(),
  payer: z.object({ email: z.string().nullable() }).nullable(),
  transaction_details: z.object({ net_received_amount: z.number() }).optional(),
  card: z.object({}).nullable().optional(),
});

const MercadoPagoResponseSchema = z.object({
  paging: MercadoPagoPagingSchema,
  results: z.array(MercadoPagoTransactionSchema),
});

export async function getMercadoPagoTransactions(
  accessToken: string,
  offset: number = 0
): Promise<
  | { success: true; data: any[]; nextOffset: number | null; rawData: any }
  | { success: false; error: string; rawData?: any }
> {
  if (!accessToken) return { success: false, error: 'Access Token not provided.' };

  const MERCADO_PAGO_API_URL = 'https://api.mercadopago.com/v1/payments/search';
  const PAGE_LIMIT = 50;

  try {
    const params = new URLSearchParams({
      sort: 'date_created',
      criteria: 'desc',
      limit: String(PAGE_LIMIT),
      offset: String(offset),
    });

    const response = await fetch(`${MERCADO_PAGO_API_URL}?${params.toString()}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });
    
    const rawData = await response.json();

    if (!response.ok) {
      console.error('Mercado Pago API Error:', rawData);
      return {
        success: false,
        error: `Mercado Pago API Error: ${rawData.message || 'Could not fetch data.'}`,
        rawData,
      };
    }
    
    const results = rawData.results || [];
    const paging = rawData.paging || { offset: 0, total: 0 };

    const simplifiedTransactions = results.map((tx: any) => {
      const isIncome = tx.card === null || tx.card === undefined;
      return {
        id: String(tx.id),
        date: tx.date_approved || tx.date_created,
        description: tx.description || 'No description',
        amount: tx.transaction_amount,
        currency: tx.currency_id,
        type: (isIncome ? 'income' : 'expense') as const,
        status: tx.status,
        payer: tx.payer?.email || 'Unknown',
      };
    });
    
    const hasMore = (paging.offset + results.length) < paging.total;
    const nextOffset = hasMore ? paging.offset + results.length : null;

    return { success: true, data: simplifiedTransactions, nextOffset, rawData };
  } catch (error) {
    console.error('Failed to fetch Mercado Pago transactions:', error);
    if (error instanceof Error) {
      return { success: false, error: `Internal server error: ${error.message}` };
    }
    return { success: false, error: 'An unknown error occurred.' };
  }
}
