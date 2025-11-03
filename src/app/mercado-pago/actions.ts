'use server';

import { z } from 'zod';
import type { SimplifiedTransaction } from './page';

/**
 * Определяет структуру ответа от API Mercado Pago для одной транзакции.
 * Мы включаем только те поля, которые нам действительно нужны.
 */
const MercadoPagoTransactionSchema = z.object({
  id: z.number(),
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

/**
 * Определяет структуру полного ответа от API поиска платежей Mercado Pago.
 */
const MercadoPagoResponseSchema = z.object({
  results: z.array(MercadoPagoTransactionSchema),
});

/**
 * Серверная функция для получения и обработки транзакций из Mercado Pago.
 * @param accessToken Секретный ключ доступа (Access Token) из вашего кабинета разработчика Mercado Pago.
 * @returns Объект с результатом: либо массив упрощенных транзакций, либо сообщение об ошибке.
 */
export async function getMercadoPagoTransactions(accessToken: string): Promise<{ success: true; data: SimplifiedTransaction[] } | { success: false; error: string }> {
  
  if (!accessToken) {
    return { success: false, error: 'Access Token не предоставлен.' };
  }

  const MERCADO_PAGO_API_URL = 'https://api.mercadolibre.com/collections/search';

  try {
    const response = await fetch(`${MERCADO_PAGO_API_URL}?sort=date_created&criteria=desc`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store', // Не кэшируем запросы к API
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Mercado Pago API Error:', errorData);
      return { success: false, error: `Ошибка API Mercado Pago: ${errorData.message || 'Не удалось получить данные.'}` };
    }

    const rawData = await response.json();
    
    // Валидируем полученные данные с помощью Zod
    const parsedResponse = MercadoPagoResponseSchema.safeParse(rawData);

    if (!parsedResponse.success) {
        console.error('Validation Error:', parsedResponse.error);
        return { success: false, error: 'Получены некорректные данные от Mercado Pago.' };
    }

    // Преобразуем данные от API в наш упрощенный формат
    const simplifiedTransactions = parsedResponse.data.results.map((tx) => ({
      id: tx.id,
      date: tx.date_approved || tx.date_created,
      description: tx.description || 'Нет описания',
      amount: tx.transaction_amount,
      currency: tx.currency_id,
      // Определяем тип транзакции. В Mercado Pago все является "платежами",
      // для простоты будем считать все "approved" платежи доходом.
      type: 'income' as const, 
      status: tx.status,
      payer: tx.payer?.email || 'Неизвестно',
    }));

    return { success: true, data: simplifiedTransactions };

  } catch (error) {
    console.error('Failed to fetch Mercado Pago transactions:', error);
    if (error instanceof Error) {
        return { success: false, error: `Внутренняя ошибка сервера: ${error.message}` };
    }
    return { success: false, error: 'Произошла неизвестная ошибка.' };
  }
}
