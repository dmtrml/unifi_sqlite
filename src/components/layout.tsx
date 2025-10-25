"use client"

import * as React from "react"
import Sidebar from "./sidebar"
import AppHeader from "./header"

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <Sidebar />
      <div className="flex flex-col">
        <AppHeader />
        {children}
      </div>
    </div>
  )
}
