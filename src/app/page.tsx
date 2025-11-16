import Dashboard from "@/components/dashboard"
import AppLayout from "@/components/layout"

export default function HomePage() {
  return (
    <AppLayout>
      <main className="flex flex-1 flex-col gap-4 pb-4 pt-[0.25rem] pl-4 pr-4 lg:gap-6 lg:pb-6 lg:pl-6 lg:pr-6 lg:pt-[0.5rem]">
        <Dashboard />
      </main>
    </AppLayout>
  )
}
