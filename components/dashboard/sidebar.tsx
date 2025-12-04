"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import { useUser } from "@/hooks/use-user";
import { usePricing } from "@/hooks/use-pricing";
import { useBranding } from "@/contexts/branding-context";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useSidebar } from "@/hooks/use-layout";
import { usePricingToolsStore } from "@/store/use-pricing-store";

interface NavItem {
  name: string;
  icon: string;
  path?: string;
  active: boolean;
  badge?: {
    count: number;
    variant: "default" | "destructive" | "outline" | "secondary";
  };
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export function Sidebar() {
  const supabase = createClient();
  const pathname = usePathname();
  const {
    time: timeRem,
    setTime: setTimeRem,
    callStarted,
    userType
  } = usePricing();

  // Get raw values from store for initialization
  const agencyTimeStore = usePricingToolsStore(state => state.agencyTime);
  const directTimeStore = usePricingToolsStore(state => state.directTime);

  const [localCollapsed, setLocalCollapsed] = useState(false);

  // Local state for live updates (Agency & Direct)
  const [localTimes, setLocalTimes] = useState({
    agency: agencyTimeStore,
    direct: directTimeStore
  });

  const [time, setTime] = useState(timeRem); // Total time (legacy/display)
  const [timeInterval, setTimeInterval] = useState<NodeJS.Timeout | null>(null);
  const { user } = useUser();
  const { branding } = useBranding();
  const [pinnedItems, setPinnedItems] = useState<string[]>([]);
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);

  // Use layout context if available, fallback to local state (Liskov Substitution Principle)
  let collapsed: boolean;
  let setCollapsed: (collapsed: boolean) => void;

  try {
    const layoutSidebar = useSidebar();
    collapsed = layoutSidebar.sidebarCollapsed;
    setCollapsed = layoutSidebar.setSidebarCollapsed;
  } catch {
    // Fallback to local state if not within LayoutProvider (maintains backward compatibility)
    collapsed = localCollapsed;
    setCollapsed = setLocalCollapsed;
  }

  // Load pinned items from localStorage
  useEffect(() => {
    const savedPinnedItems = localStorage.getItem('sidebar-pinned-items');
    if (savedPinnedItems) {
      setPinnedItems(JSON.parse(savedPinnedItems));
    }
  }, []);

  // Get agency name from branding context or fallback to user metadata
  const getAgencyName = () => {
    if (branding?.agency_name) {
      return branding.agency_name;
    }
    if (user) {
      const metadata = user.user_metadata;
      if (metadata && metadata.agency_name) {
        return metadata.agency_name;
      }
    }
    return "MAGIC TEAMS";
  };

  // Sync local state with store when call is NOT started (or initially)
  useEffect(() => {
    if (!callStarted) {
      setLocalTimes({
        agency: agencyTimeStore,
        direct: directTimeStore
      });
      setTime(timeRem);
    }
  }, [agencyTimeStore, directTimeStore, timeRem, callStarted]);

  // Live update logic
  useEffect(() => {
    const updateTime = async () => {
      if (callStarted) {
        setTimeInterval(
          setInterval(() => {
            // Update total time
            setTime((prevTime) => Math.max(0, prevTime - 1));

            // Update specific balances with priority logic (Agency -> Direct)
            setLocalTimes((prev) => {
              if (prev.agency > 0) {
                return { ...prev, agency: prev.agency - 1 };
              } else if (prev.direct > 0) {
                return { ...prev, direct: prev.direct - 1 };
              }
              return prev;
            });
          }, 1000)
        );
      }

      if (!callStarted && timeInterval) {
        clearInterval(timeInterval);
        setTimeRem(time);
        // We don't manually update agency/direct store here; 
        // that happens via updateTimeRemaining in the call logic which calls the backend.
      }
    };

    updateTime();
    return () => {
      if (timeInterval) clearInterval(timeInterval);
    };
  }, [callStarted]);

  const confirmSignOut = async () => {
    try {
      await fetch("/api/auth/signout", { method: "POST" });
      await supabase.auth.signOut();
      if (typeof window !== "undefined") window.location.href = "/login";
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const handleSignOut = () => {
    setShowSignOutDialog(true);
  };

  const togglePin = (itemName: string) => {
    const newPinnedItems = pinnedItems.includes(itemName)
      ? pinnedItems.filter(name => name !== itemName)
      : [...pinnedItems, itemName];

    setPinnedItems(newPinnedItems);
    localStorage.setItem('sidebar-pinned-items', JSON.stringify(newPinnedItems));
  };

  const isPinned = (itemName: string) => pinnedItems.includes(itemName);

  const clearAllPins = () => {
    setPinnedItems([]);
    localStorage.setItem('sidebar-pinned-items', JSON.stringify([]));
  };

  // ❌ FILTER: Remove "Buy Minutes" for agency users
  const isAgencyUser = userType === 'agency' || user?.user_metadata?.agency_id;

  const navigationSections: NavSection[] = [
    {
      title: "AI & Automation",
      items: [
        {
          name: "AI Assistant",
          icon: "bot",
          path: "/dashboard/aiassistant",
          active: pathname === "/dashboard/aiassistant",
        },
        {
          name: "Voice Library",
          icon: "mic",
          path: "/dashboard/voicelibrary",
          active: pathname === "/dashboard/voicelibrary",
        },
        {
          name: "Knowledge Base",
          icon: "book-open",
          path: "/dashboard/knowledge-base",
          active: pathname === "/dashboard/knowledge-base",
        },
        {
          name: "Tools",
          icon: "layers",
          path: "/dashboard/tools",
          active: pathname === "/dashboard/tools",
        },
        {
          name: "Webhooks",
          icon: "globe",
          path: "/dashboard/webhooks",
          active: pathname === "/dashboard/webhooks",
        },
      ],
    },
    {
      title: "Communications",
      items: [
        {
          name: "Group Call",
          icon: "users",
          path: "/dashboard/group-call",
          active: pathname.startsWith("/dashboard/group-call"),
        },
        {
          name: "Twilio Settings",
          icon: "external-link",
          path: "/dashboard/twilio",
          active: pathname === "/dashboard/twilio",
        },
        {
          name: "Individual Calls",
          icon: "phone",
          path: "/dashboard/history",
          active: pathname === "/dashboard/history",
        },
        {
          name: "Bulk Campaigns",
          icon: "phone-call",
          path: "/dashboard/bulk-call-history",
          active: pathname === "/dashboard/bulk-call-history",
        },
      ],
    },
    {
      title: "Scheduling",
      items: [
        {
          name: "Calendar",
          icon: "calendar",
          path: "/dashboard/calendar",
          active: pathname === "/dashboard/calendar",
        },
        {
          name: "Appointment Tools",
          path: "/dashboard/appointment-tools",
          icon: "calendar-plus",
          active: pathname === "/dashboard/appointment-tools",
        },
        // {
        //   name: "GHL Calendar",
        //   icon: "calendar",
        //   path: "/dashboard/ghl-calendar",
        //   active: pathname === "/dashboard/ghl-calendar",
        // }
      ],
    },
    {
      title: "Insights",
      items: [
        {
          name: "Analytics Dashboard",
          icon: "trending-up",
          path: "/dashboard/analytics",
          active: pathname === "/dashboard/analytics",
        },
      ],
    },
    {
      title: "Account",
      items: [
        // ❌ COMMENTED OUT: Buy Minutes section hidden
        // ...(!isAgencyUser ? [{
        //   name: "Buy Minutes",
        //   icon: "credit-card",
        //   path: "/dashboard/buy-minutes",
        //   active: pathname === "/dashboard/buy-minutes",
        // }] : []),
        {
          name: "Settings",
          icon: "settings",
          path: "/dashboard/settings",
          active: pathname === "/dashboard/settings",
        },
        {
          name: "Support",
          icon: "message-circle",
          path: "/dashboard/support",
          active: pathname === "/dashboard/support",
        },
      ],
    },
  ];

  // Get pinned items from all sections (MOVED, not copied)
  const getPinnedItems = () => {
    const allItems = navigationSections.flatMap(section => section.items);
    return allItems.filter(item => isPinned(item.name));
  };

  // Get navigation sections with pinned items REMOVED (following DRY principle)
  const getFilteredNavigationSections = () => {
    return navigationSections.map(section => ({
      ...section,
      items: section.items.filter(item => !isPinned(item.name))
    })).filter(section => section.items.length > 0); // Remove empty sections
  };

  const convertToMinutes = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  return (
    <TooltipProvider>
      <Card className={cn(
        "border-r flex flex-col h-screen transition-all duration-300 ease-in-out",
        "rounded-none bg-background",
        collapsed ? "w-[60px]" : "w-[240px]"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          {!collapsed && (
            <h2 className="text-xl font-bold text-primary">{getAgencyName().toLocaleUpperCase()}</h2>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCollapsed(!collapsed)}
                className={cn("hover:bg-accent", collapsed && "ml-auto")}
              >
                <Icon
                  name="chevronLeft"
                  className={cn(
                    "h-4 w-4 transition-transform duration-300",
                    collapsed && "rotate-180"
                  )}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{collapsed ? "Expand sidebar" : "Collapse sidebar"}</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Pinned Items Section */}
        {getPinnedItems().length > 0 && (
          <div className={cn(
            "border-b",
            collapsed ? "px-1 py-2" : "px-2 py-3 bg-muted/30"
          )}>
            {!collapsed && (
              <div className="flex items-center justify-between px-2 mb-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Pinned
                </h3>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={clearAllPins}
                      className="h-5 w-5 p-0 hover:bg-accent hover:text-destructive transition-colors"
                    >
                      <Icon name="x-circle" className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Clear all pins</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            )}
            <div className="space-y-1">
              {getPinnedItems().map((item) => (
                <div key={`pinned-${item.name}`} className="relative group">
                  {collapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link href={item.path || "/dashboard/aiassistant"}>
                          <Button
                            variant={item.active ? "secondary" : "ghost"}
                            className="w-full justify-center gap-2 mb-1 relative hover:bg-accent px-2"
                          >
                            <Icon name={item.icon} className="h-4 w-4 shrink-0" />
                          </Button>
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        <p>{item.name}</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <Link href={item.path || "/dashboard/aiassistant"}>
                      <Button
                        variant={item.active ? "secondary" : "ghost"}
                        className="w-full justify-start gap-2 mb-1 relative hover:bg-accent px-4"
                      >
                        <Icon name={item.icon} className="h-4 w-4 shrink-0" />
                        <span>{item.name}</span>
                        {item.badge && (
                          <Badge
                            variant={item.badge.variant}
                            className="absolute right-2"
                          >
                            {item.badge.count}
                          </Badge>
                        )}
                      </Button>
                    </Link>
                  )}
                  {!collapsed && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        togglePin(item.name);
                      }}
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 opacity-0 group-hover:opacity-100 hover:bg-accent transition-opacity"
                      title="Unpin item"
                    >
                      <Icon name="pin" className="h-3 w-3 text-primary" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Navigation Items */}
        <nav className="flex-1 py-4 overflow-y-auto scrollbar-hide">
          <div className="space-y-4 px-2">
            {getFilteredNavigationSections().map((section) => (
              <div key={section.title}>
                {!collapsed && (
                  <h3 className="px-2 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {section.title}
                  </h3>
                )}
                <div className="space-y-1">
                  {section.items.map((item) => (
                    <div key={item.name} className="relative group">
                      {collapsed ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Link href={item.path || "/dashboard/aiassistant"}>
                              <Button
                                variant={item.active ? "secondary" : "ghost"}
                                className="w-full justify-center gap-2 mb-1 relative hover:bg-accent px-2"
                              >
                                <Icon name={item.icon} className="h-4 w-4 shrink-0" />
                              </Button>
                            </Link>
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            <p>{item.name}</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <Link href={item.path || "/dashboard/aiassistant"}>
                          <Button
                            variant={item.active ? "secondary" : "ghost"}
                            className="w-full justify-start gap-2 mb-1 relative hover:bg-accent px-4"
                          >
                            <Icon name={item.icon} className="h-4 w-4 shrink-0" />
                            <span>{item.name}</span>
                            {item.badge && (
                              <Badge
                                variant={item.badge.variant}
                                className="absolute right-2"
                              >
                                {item.badge.count}
                              </Badge>
                            )}
                          </Button>
                        </Link>
                      )}
                      {!collapsed && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            togglePin(item.name);
                          }}
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 opacity-0 group-hover:opacity-100 hover:bg-accent transition-all duration-200"
                          title="Pin to top"
                        >
                          <Icon name="pin" className="h-3 w-3 text-muted-foreground hover:text-primary transition-colors" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </nav>



        {/* Footer */}
        <div className="p-4 border-t">
          {!collapsed && (
            <div className="mb-4 text-sm space-y-2">
              <div className="flex flex-col gap-1">
                {/* Agency Minutes */}
                {(userType === 'agency' || userType === 'both') && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Icon name="clock" className="h-4 w-4" />
                    <span>
                      Agency Minutes: {convertToMinutes(localTimes.agency)}
                    </span>
                  </div>
                )}

                {/* Direct Minutes */}
                {(userType === 'direct' || userType === 'both') && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Icon name="clock" className="h-4 w-4" />
                    <span>
                      Direct Minutes: {convertToMinutes(localTimes.direct)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-full h-10 flex items-center justify-center hover:bg-accent text-foreground border border-transparent hover:border-border"
                  onClick={handleSignOut}
                >
                  <Icon name="logOut" className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Sign Out</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 hover:bg-accent text-foreground border border-transparent hover:border-border"
              onClick={handleSignOut}
            >
              <Icon name="logOut" className="h-4 w-4" />
              <span>Sign Out</span>
            </Button>
          )}

          {/* Sign Out Confirmation Dialog */}
          <Dialog open={showSignOutDialog} onOpenChange={setShowSignOutDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Sign Out</DialogTitle>
                <DialogDescription>
                  Are you sure you want to sign out? You'll need to log in again to access your account.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowSignOutDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setShowSignOutDialog(false);
                    confirmSignOut();
                  }}
                >
                  Sign Out
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </Card>
    </TooltipProvider>
  );
}