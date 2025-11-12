'use server';

import { z } from 'zod';
import { headers } from 'next/headers';
import { UsersRepository } from '@/server/db/repositories/users-repo';

const MercadoPagoFeeDetailSchema = z.object({
  type: z.string(),
  amount: z.number(),
  fee_payer: z.string(),
}).optional();

const MercadoPagoTransactionSchema = z.object({
  id: z.number(),
  date_created: z.string(),
  description: z.string().nullable(),
  transaction_amount: z.number(),
  coupon_amount: z.number().default(0),
  status: z.string(),
  currency_id: z.string(),
  payer: z.object({ email: z.string().nullable() }).nullable(),
  operation_type: z.string(),
  transaction_details: z
    .object({
      net_received_amount: z.number().optional().nullable(),
      total_paid_amount: z.number().optional().nullable(),
    })
    .optional()
    .nullable(),
  fee_details: z.array(MercadoPagoFeeDetailSchema).optional().nullable(),
  point_of_interaction: z
    .object({
      business_info: z.object({
        unit: z.string().optional().nullable(),
      }).optional().nullable(),
    })
    .optional()
    .nullable(),
});

export type SimplifiedTransaction = {
  id: string;
  date: string;
  description: string;
  gross_amount: number;
  coupon_amount: number;
  total_paid_amount: number;
  fees: number;
  net_amount: number;
  currency: string;
  type: 'income' | 'expense' | 'transfer' | 'funding' | 'unknown';
  status: string;
  operation_type: string;
  payer: string;
};

const resolveUserId = async (explicit?: string | null) => {
  if (explicit) return explicit;
  try {
    const hdrs = await headers();
    return hdrs.get('x-uid');
  } catch {
    return null;
  }
};

export type MercadoPagoTransactionsResult =
  | { success: true; data: SimplifiedTransaction[]; rawData: any[] }
  | { success: false; error: string; rawData?: any[] };

export async function exchangeCodeForToken(code: string, explicitUid?: string) {
  const userId = await resolveUserId(explicitUid);
  if (!userId) {
    return { success: false, error: 'User not authenticated.' };
  }

  const CLIENT_ID = process.env.NEXT_PUBLIC_MERCADO_PAGO_CLIENT_ID;
  const CLIENT_SECRET = process.env.MERCADO_PAGO_CLIENT_SECRET;
  const REDIRECT_URI = process.env.MERCADO_PAGO_REDIRECT_URI ?? 'http://localhost:9002/mercado-pago/callback';

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return { success: false, error: 'Mercado Pago credentials are not configured.' };
  }

  try {
    const response = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return {
        success: false,
        error: `Mercado Pago API error: ${data.message ?? 'Failed to exchange code.'}`,
        data,
      };
    }

    const { access_token, refresh_token, expires_in } = data;
    if (!access_token) {
      return { success: false, error: 'Access token missing in Mercado Pago response.', data };
    }

    await UsersRepository.updateTokens(userId, {
      mercadoPagoAccessToken: access_token,
      mercadoPagoRefreshToken: refresh_token,
      mercadoPagoTokenExpires: Date.now() + Number(expires_in ?? 0) * 1000,
    });

    return { success: true, data };
  } catch (error) {
    console.error('Failed to exchange Mercado Pago code', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error while exchanging code.',
    };
  }
}

export async function getMercadoPagoTransactions(
  explicitUid?: string,
): Promise<MercadoPagoTransactionsResult> {
  const userId = await resolveUserId(explicitUid);
  if (!userId) {
    return { success: false, error: 'User not authenticated.' };
  }
  const userRecord = await UsersRepository.getById(userId);
  const accessToken = userRecord?.mercadoPagoAccessToken;

  if (!accessToken) {
    return { success: false, error: 'Mercado Pago account not connected.' };
  }

  const MERCADO_PAGO_API_URL = 'https://api.mercadopago.com/v1/payments/search';
  const PAGE_LIMIT = 50;

  let offset = 0;
  const allTransactions: any[] = [];
  const allRawData: any[] = [];
  let hasMore = true;

  try {
    do {
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
      allRawData.push(rawData);

      if (!response.ok) {
        throw new Error(rawData.message ?? 'Mercado Pago API error.');
      }

      const parseResult = z
        .object({ results: z.array(MercadoPagoTransactionSchema), paging: z.any() })
        .safeParse(rawData);

      if (!parseResult.success) {
        console.error('Mercado Pago data validation failed', parseResult.error);
        return { success: false, error: 'Invalid data received from Mercado Pago.', rawData: allRawData };
      }

      const results = parseResult.data.results ?? [];
      const paging = rawData.paging ?? { offset: 0, total: 0 };

      const simplifiedTransactions = results.map((tx: any) => {
        let type: 'income' | 'expense' | 'transfer' | 'funding' | 'unknown' = 'unknown';

        switch (tx.operation_type) {
          case 'regular_payment':
            type = 'expense';
            break;
          case 'money_transfer':
            type =
              (tx.transaction_details?.net_received_amount ?? 0) >= 0
                ? 'income'
                : 'expense';
            break;
          case 'account_fund':
            type = 'funding';
            break;
          default:
            type = 'unknown';
        }

        const fees =
          tx.fee_details?.reduce((acc: number, fee: any) => acc + (fee.amount || 0), 0) || 0;

        return {
          id: String(tx.id),
          date: tx.date_created,
          description: tx.description || 'No description',
          gross_amount: tx.transaction_amount,
          coupon_amount: tx.coupon_amount || 0,
          total_paid_amount: tx.transaction_details?.total_paid_amount || tx.transaction_amount,
          fees,
          net_amount:
            tx.transaction_details?.net_received_amount ?? tx.transaction_amount - fees,
          currency: tx.currency_id,
          type,
          status: tx.status,
          operation_type: tx.operation_type,
          payer: tx.payer?.email || 'Unknown',
        };
      });

      allTransactions.push(...simplifiedTransactions);

      offset = paging.offset + results.length;
      hasMore = offset < paging.total;
      if (hasMore) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    } while (hasMore);

    return { success: true, data: allTransactions, rawData: allRawData };
  } catch (error) {
    console.error('Failed to fetch Mercado Pago transactions', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error while fetching data.',
      rawData: allRawData,
    };
  }
}
