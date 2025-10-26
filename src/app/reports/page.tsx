"use client"

import AppLayout from "@/components/layout"

function ReportsPageContent() {
  return (
    <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">Reports</h1>
      </div>
      <div>
        <p className="text-muted-foreground">
            Here you can analyze your financial data with detailed reports.
        </p>
      </div>
    </main>
  );
}

export default function ReportsPage() {
  return (
    <AppLayout>
      <ReportsPageContent />
    </AppLayout>
  )
}
