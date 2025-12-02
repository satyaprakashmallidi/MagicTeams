"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { MainContent } from "./main-content";
import { Icon } from "@/components/ui/icons";

interface DashboardLayoutProps {
  user: any;
  router: any;
}



export function DashboardLayout({ user, router }: DashboardLayoutProps) {
  const [currentView, setCurrentView] = useState();

  return (
    <div className="flex h-screen bg-background">
      <Sidebar  />
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-background shadow-sm border-b border-border flex-shrink-0">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16 items-center">
              <h1 className="text-xl font-semibold text-foreground">
                {/* {currentView.toLocaleUpperCase().replace("-", " ")} */}
              </h1>
              <div className="flex items-center gap-2">
                <Icon name="mail" className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{user?.email}</span>
              </div>
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-auto">
          <MainContent user={user} currentView={currentView} />
        </div>
      </div>
    </div>
  );
}
