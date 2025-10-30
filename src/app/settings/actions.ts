
'use server';
import 'server-only';
import { headers } from 'next/headers';
import admin from 'firebase-admin';
import { format } from "date-fns";
import type { Account, Category, Transaction } from "@/lib/types";

// Helper to get the initialized Firebase Admin app
function getFirebaseAdminApp() {
    // Check if the app is already initialized to avoid re-initializing
    if (admin.apps.length > 0) {
        return admin.app();
    }

    // Try to initialize using the service account key from environment variables
    // This is the most reliable method in various environments including Firebase Studio
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
        // Fall through to the default initialization
    }
    
    // If the key is not available, fall back to default credentials
    // This works in Google Cloud environments (like App Hosting) automatically
    try {
        return admin.initializeApp();
    } catch (error: any) {
        console.error("Firebase Admin default initialization failed:", error.message);
        throw new Error("Could not initialize Firebase Admin SDK. Ensure credentials are set correctly.");
    }
}


export async function exportTransactions(): Promise<string> {
    const headersList = headers();
    const userId = headersList.get('X-Uid');

    if (!userId) {
        throw new Error("User is not authenticated.");
    }
    
    const app = getFirebaseAdminApp();
    const db = app.firestore();
    
    // Fetch all data in parallel
    const [transactionsSnap, accountsSnap, categoriesSnap] = await Promise.all([
        db.collection(`users/${userId}/transactions`).get(),
        db.collection(`users/${userId}/accounts`).get(),
        db.collection(`users/${userId}/categories`).get()
    ]);

    const accounts = accountsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));
    const categories = categoriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
    const transactions = transactionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
    
    const getAccount = (id?: string) => accounts.find(a => a.id === id);
    const getCategory = (id?: string) => categories.find(c => c.id === id);

    const csvHeaders = [
      "Date", "Description", "Type", "Amount", "Currency", "Category", 
      "Account", "From Account", "To Account", "Amount Sent", "Amount Received"
    ].join(",");

    const csvRows = transactions.map(t => {
      const date = t.date ? format((t.date as unknown as admin.firestore.Timestamp).toDate(), "yyyy-MM-dd") : '';
      const description = `"${t.description?.replace(/"/g, '""') || ''}"`;
      const type = t.transactionType;
      
      let row: (string | number | undefined)[] = [date, description, type];

      if (type === 'transfer') {
        const fromAccount = getAccount(t.fromAccountId);
        const toAccount = getAccount(t.toAccountId);
        row.push(
          '', // Amount
          '', // Currency
          '', // Category
          '', // Account
          fromAccount?.name || 'N/A',
          toAccount?.name || 'N/A',
          t.amountSent,
          t.amountReceived
        );
      } else {
        const account = getAccount(t.accountId);
        const category = getCategory(t.categoryId);
        row.push(
          t.amount,
          account?.currency || '',
          category?.name || 'Uncategorized',
          account?.name || 'N/A',
          '', // From Account
          '', // To Account
          '', // Amount Sent
          ''  // Amount Received
        );
      }
      return row.join(",");
    });

    return [csvHeaders, ...csvRows].join("\n");
}

