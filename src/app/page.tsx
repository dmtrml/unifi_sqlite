import Dashboard from "@/components/dashboard"
import AppLayout from "@/components/layout"

export default function HomePage() {
  return (
    <AppLayout>
      <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
        <div className="flex items-center">
          <h1 className="text-lg font-semibold md:text-2xl">Dashboard</h1>
        </div>
        <Dashboard />
      </main>
    </AppLayout>
  )
}
