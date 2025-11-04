
'use server';

import { z } from 'zod';
import { headers } from "next/headers";
import admin from "firebase-admin";

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
  coupon_amount: z.number().default(0),
  status: z.string(),
  currency_id: z.string(),
  payer: z.object({ email: z.string().nullable() }).nullable(),
  operation_type: z.string(),
  transaction_details: z.object({ 
    net_received_amount: z.number().optional().nullable(),
    total_paid_amount: z.number().optional().nullable(),
  }).optional().nullable(),
  fee_details: z.array(MercadoPagoFeeDetailSchema).optional().nullable(),
  point_of_interaction: z.object({
    business_info: z.object({
        unit: z.string().optional().nullable(),
    }).optional().nullable(),
  }).optional().nullable(),
  collector_id: z.number().optional().nullable(),
  collector: z.object({ id: z.number() }).optional().nullable(),
});

// Helper to get the initialized Firebase Admin app
function getFirebaseAdminApp() {
    if (admin.apps.length > 0) {
        return admin.app();
    }
    
    try {
        const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
        if (serviceAccountKey) {
            const credentials = JSON.parse(serviceAccountKey);
            return admin.initializeApp({
                credential: admin.credential.cert(credentials),
            });
        }
    } catch (error) {
        console.error("Failed to initialize Firebase Admin with service account key:", error);
    }
    
    try {
        return admin.initializeApp();
    } catch (error: any) {
        console.error("Firebase Admin default initialization failed:", error.message);
        throw new Error("Could not initialize Firebase Admin SDK. Ensure credentials are set correctly.");
    }
}


export async function exchangeCodeForToken(code: string): Promise<{ success: boolean, data?: any, error?: string }> {
  // This is a placeholder. In the next step, we'll implement the actual API call.
  console.log("Exchanging code:", code);
  await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network request
  return { success: true, data: { message: "Token exchange successful (simulated)." } };
}


export async function getMercadoPagoTransactions(): Promise<
  | { success: true; data: any[]; rawData: any[] }
  | { success: false; error: string; rawData?: any[] }
> {
  const headersList = headers();
  const userId = headersList.get('X-Uid');

  if (!userId) {
    return { success: false, error: 'User not authenticated.' };
  }

  const adminApp = getFirebaseAdminApp();
  const userDoc = await adminApp.firestore().doc(`users/${userId}`).get();
  const userData = userDoc.data();

  const accessToken = userData?.mercadoPagoAccessToken;

  if (!accessToken) return { success: false, error: 'Mercado Pago account not connected.' };

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
        console.error('Mercado Pago API Error:', rawData);
        throw new Error(`Mercado Pago API Error: ${rawData.message || 'Could not fetch data.'}`);
      }
      
      const parseResult = z.object({ results: z.array(MercadoPagoTransactionSchema), paging: z.any() }).safeParse(rawData);
      
      if (!parseResult.success) {
          console.error("Zod validation error:", parseResult.error.errors);
          return { success: false, error: `Invalid data received from Mercado Pago.`, rawData: allRawData };
      }

      const results = parseResult.data.results || [];
      const paging = rawData.paging || { offset: 0, total: 0 };
      
      const simplifiedTransactions = results.map((tx: any) => {
        let type: 'income' | 'expense' | 'transfer' | 'funding' | 'unknown' = 'unknown';

        switch (tx.operation_type) {
          case 'regular_payment':
            type = 'expense';
            break;
          case 'money_transfer':
            if (tx.collector_id) {
              type = 'income'; 
            } else {
              type = 'expense';
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
          date: tx.date_created,
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

      allTransactions.push(...simplifiedTransactions);
      
      offset = paging.offset + results.length;
      hasMore = offset < paging.total;
      
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }

    } while (hasMore);

    return { success: true, data: allTransactions, rawData: allRawData };
  } catch (error) {
    console.error('Failed to fetch Mercado Pago transactions:', error);
    if (error instanceof Error) {
      return { success: false, error: `Internal server error: ${error.message}`, rawData: allRawData };
    }
    return { success: false, error: 'An unknown error occurred.', rawData: allRawData };
  }
}
