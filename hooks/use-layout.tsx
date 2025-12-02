'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { usePathname } from 'next/navigation';

// Interface Segregation Principle - Define clear, focused interfaces
interface LayoutState {
  sidebarCollapsed: boolean;
  headerMinimized: boolean;
}

interface LayoutActions {
  setSidebarCollapsed: (collapsed: boolean) => void;
  setHeaderMinimized: (minimized: boolean) => void;
  toggleSidebar: () => void;
  toggleHeader: () => void;
}

interface LayoutConfig {
  isFullscreenMode: boolean;
  autoCollapsePaths: string[];
}

// Single Responsibility Principle - Context only manages layout state
interface LayoutContextType extends LayoutState, LayoutActions, LayoutConfig {}

// Strategy pattern for different layout behaviors (Open-Closed Principle)
interface LayoutStrategy {
  shouldAutoCollapse(pathname: string): boolean;
  getDefaultState(pathname: string): LayoutState;
}

class DefaultLayoutStrategy implements LayoutStrategy {
  private autoCollapsePaths = ['/dashboard/group-call/start'];

  shouldAutoCollapse(pathname: string): boolean {
    return this.autoCollapsePaths.includes(pathname);
  }

  getDefaultState(pathname: string): LayoutState {
    return {
      sidebarCollapsed: this.shouldAutoCollapse(pathname),
      // headerMinimized: this.shouldAutoCollapse(pathname), // Commented out - don't collapse topbar
      headerMinimized: false,
    };
  }
}

// Context creation with proper defaults
const LayoutContext = createContext<LayoutContextType | null>(null);

// Provider component following Single Responsibility Principle
export function LayoutProvider({ 
  children,
  strategy = new DefaultLayoutStrategy() 
}: { 
  children: ReactNode;
  strategy?: LayoutStrategy;
}) {
  const pathname = usePathname();
  const [layoutState, setLayoutState] = useState<LayoutState>(() => 
    strategy.getDefaultState(pathname)
  );

  // Dependency Inversion Principle - Depend on abstraction (strategy), not concrete implementation
  const isFullscreenMode = strategy.shouldAutoCollapse(pathname);
  const autoCollapsePaths = ['/dashboard/group-call/start']; // Could be moved to strategy

  // Effect to handle path changes (respects existing user preferences unless in fullscreen mode)
  useEffect(() => {
    if (isFullscreenMode) {
      // Force collapse in fullscreen mode
      setLayoutState({
        sidebarCollapsed: true,
        // headerMinimized: true, // Commented out - don't collapse topbar
        headerMinimized: false,
      });
    }
    // Note: We don't auto-expand when leaving fullscreen mode to preserve user preference
  }, [isFullscreenMode]);

  // Actions following Command pattern
  const setSidebarCollapsed = (collapsed: boolean) => {
    setLayoutState(prev => ({ ...prev, sidebarCollapsed: collapsed }));
  };

  const setHeaderMinimized = (minimized: boolean) => {
    setLayoutState(prev => ({ ...prev, headerMinimized: minimized }));
  };

  const toggleSidebar = () => {
    setLayoutState(prev => ({ ...prev, sidebarCollapsed: !prev.sidebarCollapsed }));
  };

  const toggleHeader = () => {
    setLayoutState(prev => ({ ...prev, headerMinimized: !prev.headerMinimized }));
  };

  // Context value object
  const contextValue: LayoutContextType = {
    // State
    sidebarCollapsed: layoutState.sidebarCollapsed,
    headerMinimized: layoutState.headerMinimized,
    
    // Actions
    setSidebarCollapsed,
    setHeaderMinimized,
    toggleSidebar,
    toggleHeader,
    
    // Config
    isFullscreenMode,
    autoCollapsePaths,
  };

  return (
    <LayoutContext.Provider value={contextValue}>
      {children}
    </LayoutContext.Provider>
  );
}

// Custom hook following Single Responsibility Principle
export function useLayout() {
  const context = useContext(LayoutContext);
  
  if (!context) {
    throw new Error('useLayout must be used within a LayoutProvider');
  }
  
  return context;
}

// Additional hooks for specific concerns (Interface Segregation Principle)
export function useSidebar() {
  const { sidebarCollapsed, setSidebarCollapsed, toggleSidebar } = useLayout();
  return { sidebarCollapsed, setSidebarCollapsed, toggleSidebar };
}

export function useHeader() {
  const { headerMinimized, setHeaderMinimized, toggleHeader } = useLayout();
  return { headerMinimized, setHeaderMinimized, toggleHeader };
}

// Export the strategy interface for future extensions (Open-Closed Principle)
export type { LayoutStrategy };
export { DefaultLayoutStrategy };