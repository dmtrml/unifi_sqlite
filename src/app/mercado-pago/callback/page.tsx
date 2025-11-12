
'use client';

import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { exchangeCodeForToken } from '../actions';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import AppLayout from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useUser } from '@/firebase';

type LogEntry = {
  step: string;
  status: 'pending' | 'success' | 'error';
  message: string;
  data?: any;
};

export default function MercadoPagoCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useUser();
  const [logs, setLogs] = React.useState<LogEntry[]>([]);
  const [isComplete, setIsComplete] = React.useState(false);
  const [errorState, setErrorState] = React.useState<string | null>(null);

  const addLog = (entry: Omit<LogEntry, 'status'>, status: LogEntry['status']) => {
    setLogs(prev => [...prev, { ...entry, status }]);
  };

  React.useEffect(() => {
    const processAuthorization = async () => {
      const code = searchParams.get('code');
      const error = searchParams.get('error');

      if (error) {
        addLog({ step: "Authorization", message: `Authorization error: ${searchParams.get('error_description') || error}` }, 'error');
        setErrorState("Authorization failed.");
        setIsComplete(true);
        return;
      }

      if (!code) {
        addLog({ step: "Authorization Code", message: "Authorization code not found in URL." }, 'error');
        setErrorState("Authorization code missing.");
        setIsComplete(true);
        return;
      }

      if (!user?.uid) {
        addLog({ step: "Authentication", message: "User not authenticated." }, 'error');
        setErrorState("Please sign in before connecting Mercado Pago.");
        setIsComplete(true);
        return;
      }
      
      addLog({ step: "Authorization Code", message: `Code received: ${code}` }, 'success');

      // Step 2: Exchange code for token
      addLog({ step: "Token Exchange", message: "Sending code to server to exchange for token..." }, 'pending');
      
      const result = await exchangeCodeForToken(code, user.uid);

      if (result.success) {
        addLog({ 
          step: "Token Exchange", 
          message: "Token successfully received and saved!", 
          data: result.data 
        }, 'success');
        setIsComplete(true);
        setTimeout(() => router.push('/mercado-pago'), 3000);
      } else {
        addLog({ 
          step: "Token Exchange", 
          message: `Token exchange failed: ${result.error}`, 
          data: result.data 
        }, 'error');
        setErrorState(result.error || "An unknown error occurred during token exchange.");
        setIsComplete(true);
      }
    };

    // Run only once
    if (logs.length === 0) {
      processAuthorization();
    }
  }, [searchParams, router, logs.length, user]);

  const renderLogIcon = (status: LogEntry['status']) => {
    switch (status) {
      case 'pending': return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
      case 'success': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error': return <XCircle className="h-5 w-5 text-destructive" />;
    }
  };

  return (
    <AppLayout>
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-4 lg:gap-6 lg:p-6">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>Connecting to Mercado Pago</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              {logs.map((log, index) => (
                <li key={index} className="flex items-start gap-4">
                  <div className="mt-1">{renderLogIcon(log.status)}</div>
                  <div className="flex-1">
                    <p className="font-semibold">{log.step}</p>
                    <p className="text-sm text-muted-foreground">{log.message}</p>
                    {log.data && (
                      <pre className="mt-2 w-full overflow-x-auto rounded-md bg-muted p-4 text-xs">
                        <code>{JSON.stringify(log.data, null, 2)}</code>
                      </pre>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {isComplete && (
              <div className="mt-6 text-center">
                {errorState ? (
                  <p className="text-destructive">An error occurred. Please try again.</p>
                ) : (
                  <p className="text-green-600">Success! You will be redirected in 3 seconds...</p>
                )}
                <Button asChild className="mt-4">
                  <Link href="/mercado-pago">Back to Import Page</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </AppLayout>
  );
}
