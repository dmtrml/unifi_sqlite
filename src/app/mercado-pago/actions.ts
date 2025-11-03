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
  opts?: { beginDate?: string; endDate?: string } // ISO strings, e.g., "2025-10-01T00:00:00Z"
): Promise<
  | { success: true; data: any[]; rawData: any }
  | { success: false; error: string; rawData?: any }
> {
  if (!accessToken) return { success: false, error: 'Access Token not provided.' };

  const MERCADO_PAGO_API_URL = 'https://api.mercadopago.com/v1/payments/search';
  const PAGE_LIMIT = 50;

  try {
    const allTransactions: z.infer<typeof MercadoPagoTransactionSchema>[] = [];
    const allRawResults: any[] = [];
    let offset = 0;
    let page = 0;

    const begin = opts?.beginDate ?? undefined;
    const end = opts?.endDate ?? undefined;

    while (true) {
      const params = new URLSearchParams({
        sort: 'date_created',
        criteria: 'desc',
        limit: String(PAGE_LIMIT),
        offset: String(offset),
      });

      if (begin && end) {
        params.set('range', 'date_created');
        params.set('begin_date', begin);
        params.set('end_date', end);
      }

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

      const parsed = MercadoPagoResponseSchema.safeParse(rawData);
      if (!parsed.success) {
        console.error('Validation Error:', parsed.error.flatten());
        return { success: false, error: 'Invalid data received from Mercado Pago.', rawData };
      }

      const { results } = parsed.data;

      allTransactions.push(...results);
      allRawResults.push(...results);

      if (results.length < PAGE_LIMIT) break;

      offset += results.length;

      if (++page > 1000) break;
    }

    const simplifiedTransactions = allTransactions.map((tx) => {
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

    return { success: true, data: simplifiedTransactions, rawData: { results: allRawResults } };
  } catch (error) {
    console.error('Failed to fetch Mercado Pago transactions:', error);
    if (error instanceof Error) {
      return { success: false, error: `Internal server error: ${error.message}` };
    }
    return { success: false, error: 'An unknown error occurred.' };
  }
}
