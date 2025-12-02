"use client";

import { useRouter } from "next/navigation";
import CalcomCalender from "@/components/calendar/calcom-calender";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";

export default function CalcomCalendarPage() {
  const router = useRouter();

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b bg-background">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => router.push('/dashboard/calendar')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <Icon name="arrow-left" className="h-4 w-4" />
            Back to Calendars
          </Button>
          <div className="h-6 w-px bg-border" />
          <h1 className="text-xl font-semibold text-foreground">Cal.com Calendar</h1>
        </div>
      </div>
      <div className="flex-1">
        <CalcomCalender backToCalendar={() => router.push('/dashboard/calendar')} />
      </div>
    </div>
  );
}