'use server';

import { z } from 'zod';

const MercadoPagoPagingSchema = z.object({
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
});

const MercadoPagoFeeDetailSchema = z.object({
    type: z.string(),
    amount: z.number(),
    fee_payer: z.string(),
}).optional();

const MercadoPagoTransactionSchema = z.object({
  id: z.number(),
  date_approved: z.string().nullable(),
  date_created: z.string(),
  description: z.string().nullable(),
  transaction_amount: z.number(),
  status: z.string(),
  currency_id: z.string(),
  payer: z.object({ email: z.string().nullable() }).nullable(),
  operation_type: z.string(),
  transaction_details: z.object({ 
    net_received_amount: z.number().optional() 
  }).optional(),
  fee_details: z.array(MercadoPagoFeeDetailSchema).optional(),
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
      let type: 'income' | 'expense' | 'transfer' | 'funding' | 'unknown' = 'unknown';
      if (tx.operation_type === 'regular_payment') {
          type = tx.card ? 'expense' : 'income';
      } else if (tx.operation_type === 'money_transfer') {
          type = 'transfer';
      } else if (tx.operation_type === 'account_fund') {
          type = 'funding';
      }

      const fees = tx.fee_details?.reduce((acc: number, fee: any) => acc + fee.amount, 0) || 0;

      return {
        id: String(tx.id),
        date: tx.date_approved || tx.date_created,
        description: tx.description || 'No description',
        gross_amount: tx.transaction_amount,
        fees: fees,
        net_amount: tx.transaction_details?.net_received_amount ?? tx.transaction_amount - fees,
        currency: tx.currency_id,
        type: type,
        status: tx.status,
        operation_type: tx.operation_type,
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
