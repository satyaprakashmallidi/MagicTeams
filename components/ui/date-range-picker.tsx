"use client"

import * as React from "react"
import { addDays, format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DateRangePickerProps {
  from: Date
  to: Date
  onSelect: (range: DateRange | undefined) => void
  className?: string
}

export function DateRangePicker({
  className,
  from,
  to,
  onSelect,
}: DateRangePickerProps) {
  const [date, setDate] = React.useState<DateRange | undefined>({
    from: from,
    to: to,
  })

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-full justify-start text-left font-normal h-10 px-3 py-2",
              "bg-background hover:bg-accent hover:text-accent-foreground",
              "border border-input shadow-sm transition-colors",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
            {date?.from ? (
              date.to ? (
                <span className="flex-1 truncate">
                  {format(date.from, "LLL dd, y")} - {format(date.to, "LLL dd, y")}
                </span>
              ) : (
                format(date.from, "LLL dd, y")
              )
            ) : (
              <span>Pick a date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-auto p-0" 
          align="start"
          sideOffset={8}
        >
          <div className="p-3 border-b">
            <h3 className="font-medium text-sm">Select Date Range</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Choose start and end dates
            </p>
          </div>
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={(range) => {
              setDate(range)
              onSelect(range)
            }}
            onDayClick={(day) => {
              setDate({
                from: day,
                to: day,
              })
              onSelect({
                from: day,
                to: day,
              })
              onSelect({
                from: day,
                to: day,
              })
            }}
            numberOfMonths={2}
            className="p-3"
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
