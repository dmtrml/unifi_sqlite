import type {Metadata} from 'next';
import './globals.css';
import { Inter, Space_Grotesk } from 'next/font/google';
import { Toaster } from "@/components/ui/toaster"
import { ThemeProvider } from '@/components/theme-provider';
import { DevAuthProvider } from '@/lib/auth-context';

const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-inter' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-space-grotesk' });

export const metadata: Metadata = {
  title: 'BudgetWise',
  description: 'Take control of your finances with BudgetWise.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${spaceGrotesk.variable} font-body antialiased`}>
        <DevAuthProvider>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </DevAuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
