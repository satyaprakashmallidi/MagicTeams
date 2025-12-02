'use client'

import { usePathname } from 'next/navigation'
import { dashboardNav } from '@/config/dashboard'
import { useUser } from '@/hooks/use-user'
import { Icon } from '../ui/icons'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { Separator } from '@/components/ui/separator'

export function DashboardHeader() {
  const pathname = usePathname()
  const currentRoute = dashboardNav.find(item => item.href === pathname)

  return (
    <header className="sticky top-0 z-40 border-b bg-background p-1">
      <div className="flex h-16 items-center justify-between py-4">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold uppercase p-6">
            {currentRoute?.title || 'Dashboard'}
          </h1>
        </div>
        <div className="p-6 flex gap-4 items-center">
          {/* <ThemeToggle /> */}
          {/* <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-2 text-muted-foreground">
            <Icon name='mail' className="h-5 w-5" />
            <span>{user?.email}</span>
          </div> */}
        </div>
      </div>
    </header>
  )
}
