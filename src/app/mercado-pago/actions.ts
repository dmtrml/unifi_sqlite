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

// Обновленная схема для более точного определения типа перевода
const MercadoPagoTransactionSchema = z.object({
  id: z.number(),
  date_approved: z.string().nullable(),
  date_created: z.string(),
  description: z.string().nullable(),
  transaction_amount: z.number(),
  coupon_amount: z.number().default(0),
  status: z.string(),
  currency_id: z.string(),
  payer: z.object({ email: z.string().nullable() }).nullable(),
  operation_type: z.string(),
  transaction_details: z.object({ 
    net_received_amount: z.number().optional(),
    total_paid_amount: z.number().optional(),
  }).optional(),
  fee_details: z.array(MercadoPagoFeeDetailSchema).optional(),
  point_of_interaction: z.object({
    business_info: z.object({
        unit: z.string().optional().nullable(),
    }).optional().nullable(),
  }).optional().nullable(),
  // Добавляем поля для точной идентификации переводов
  collector_id: z.number().optional().nullable(),
  collector: z.object({ id: z.number() }).optional().nullable(),
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

      switch (tx.operation_type) {
        case 'regular_payment':
          type = 'expense';
          break;
        case 'money_transfer':
          // Применяем вашу логику: если есть collector_id, это доход. Иначе — расход.
          if (tx.collector_id) {
            type = 'income'; // Нам перевели деньги
          } else {
            type = 'expense'; // Мы перевели деньги
          }
          break;
        case 'account_fund':
          type = 'funding';
          break;
        default:
          type = 'unknown';
      }

      const fees = tx.fee_details?.reduce((acc: number, fee: any) => acc + fee.amount, 0) || 0;

      return {
        id: String(tx.id),
        date: tx.date_approved || tx.date_created,
        description: tx.description || 'No description',
        gross_amount: tx.transaction_amount,
        coupon_amount: tx.coupon_amount || 0,
        total_paid_amount: tx.transaction_details?.total_paid_amount || tx.transaction_amount,
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
