import { Sidebar } from '@/components/dashboard/sidebar'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { LayoutProvider } from '@/hooks/use-layout'

const DashboardLayout = ({ children }: { children: React.ReactNode}) => {
  return (
    <LayoutProvider>
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col h-screen overflow-hidden">
          <DashboardHeader />
          <main className="overflow-auto h-full">
            {children}
          </main>
        </div>
      </div>
    </LayoutProvider>
  )
}

export default DashboardLayout
