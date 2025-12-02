'use client';

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { CalendarAccount } from "@/hooks/use-calendar";
import { useState } from "react";

interface CalendarHeaderProps {
  calendarAccounts: CalendarAccount[];
  selectedAccounts: Set<string>;
  onAccountToggle: (accountId: string) => void;
  onAddEvent: () => void;
  onAddCalendar: () => void;
  integrating?: boolean;
}

export function CalendarHeader({
  calendarAccounts,
  selectedAccounts,
  onAccountToggle,
  onAddEvent,
  onAddCalendar,
  integrating = false,
}: CalendarHeaderProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  return (
    <div className="flex items-center space-x-4">
      {/* Calendar Accounts Dropdown */}
      <div className="relative">
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className={`
            inline-flex items-center gap-2 px-4 py-2.5 
            bg-white rounded-lg border border-gray-200 
            hover:bg-gray-50 active:bg-gray-100
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
            transition-all duration-200
            ${isDropdownOpen ? 'bg-gray-50 ring-2 ring-blue-500' : ''}
          `}
        >
          <Icon name="calendar" className="w-4 h-4 text-gray-600" />
          <span className="text-sm font-medium text-gray-700">Calendar Accounts</span>
          <Icon 
            name={isDropdownOpen ? "chevron-up" : "chevron-down"} 
            className="w-4 h-4 text-gray-400"
          />
        </button>

        {/* Dropdown Panel */}
        {isDropdownOpen && (
          <div className="absolute left-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
            <div className="p-3">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <span className="text-sm font-semibold text-gray-900">Calendar Accounts</span>
              </div>
              <div className="mt-2 space-y-1">
                {calendarAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center px-3 py-2 hover:bg-gray-50 rounded-md cursor-pointer"
                    onClick={() => onAccountToggle(account.id)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedAccounts.has(account.id)}
                      onChange={() => {}} // Handle change through parent div click
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-3 text-sm text-gray-700">
                      {account.calendar_email}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
