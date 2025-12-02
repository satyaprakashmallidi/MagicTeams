"use client"
import { useState } from 'react'
import { useRouter } from 'next/navigation';
import { useCalendar } from '@/hooks/use-calendar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icons';
import { useGHLCalendar } from '@/hooks/use-ghl-calendar';

export default function CalendarPage() {

  const router = useRouter();
  const { calendarAccounts, connectCalendar, isLoadingAccounts } = useCalendar();
  const { connection: ghlConnection, connectGHL, isLoadingConnection: isLoadingGHL } = useGHLCalendar();
  const [integrating, setIntegrating] = useState(false);

  const hasGoogleCalendars = calendarAccounts.length > 0;

  const handleAddCalendar = async () => {
    setIntegrating(true);
    try {
      await connectCalendar();
    } catch (error) {
      console.error("Failed to connect calendar:", error);
    } finally {
      setIntegrating(false);
    }
  };



  // Show loader while checking connection statuses
  if (isLoadingAccounts || isLoadingGHL) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold text-foreground mb-3">Calendar Integrations</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Connect your favorite calendar service to manage appointments and schedule meetings seamlessly
            </p>
          </div>

          {/* Loading Skeleton */}
          <div className="grid lg:grid-cols-3 md:grid-cols-2 gap-6">
            {[1, 2, 3].map((index) => (
              <Card key={index} className="border-0 overflow-hidden animate-pulse">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-200 rounded-lg w-10 h-10" />
                      <div className="h-6 bg-gray-200 rounded w-32" />
                    </div>
                  </div>
                  <div className="mt-3 h-4 bg-gray-200 rounded w-3/4" />
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 bg-gray-200 rounded-full" />
                      <div className="h-4 bg-gray-200 rounded w-24" />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 bg-gray-200 rounded-full" />
                      <div className="h-4 bg-gray-200 rounded w-28" />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 bg-gray-200 rounded-full" />
                      <div className="h-4 bg-gray-200 rounded w-32" />
                    </div>
                    <div className="h-12 bg-gray-200 rounded-lg w-full mt-6" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Icon name="loader2" className="h-6 w-6 animate-spin text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Checking calendar connections...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header Section */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-foreground mb-3">Calendar Integrations</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Connect your favorite calendar service to manage appointments and schedule meetings seamlessly
          </p>
        </div>

        {/* Calendar Options Grid */}
        <div className="grid lg:grid-cols-3 md:grid-cols-2 gap-6">
        {/* Google Calendar Option */}
        <Card className="hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-0 overflow-hidden">
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/>
                  </svg>
                </div>
                <CardTitle className="text-xl">Google Calendar</CardTitle>
              </div>
              {hasGoogleCalendars && (
                <span className="px-2 py-1 text-xs font-semibold bg-green-100 text-green-700 rounded-full">Connected</span>
              )}
            </div>
            <CardDescription className="mt-3">
              {hasGoogleCalendars
                ? "Access and manage your Google Calendar events"
                : "Sync with Google Calendar for seamless scheduling"
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Icon name="check-circle" className="h-4 w-4 text-green-500" />
                <span>Two-way sync</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Icon name="check-circle" className="h-4 w-4 text-green-500" />
                <span>Real-time updates</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Icon name="check-circle" className="h-4 w-4 text-green-500" />
                <span>Multiple calendar support</span>
              </div>

              {hasGoogleCalendars ? (
                <Button
                  onClick={() => router.push('/dashboard/calendar/google')}
                  className="w-full mt-6"
                  size="lg"
                >
                  <Icon name="calendar" className="h-4 w-4 mr-2" />
                  Open Calendar
                </Button>
              ) : (
                <Button
                  onClick={handleAddCalendar}
                  className="w-full mt-6 bg-blue-600 hover:bg-blue-700"
                  size="lg"
                  disabled={integrating}
                >
                  {integrating ? (
                    <>
                      <Icon name="loader2" className="h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Icon name="link" className="h-4 w-4" />
                      Connect Google
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Cal.com Calendar Option */}
        <Card className="hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-0 overflow-hidden">
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <svg className="w-6 h-6 text-purple-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"/>
                  </svg>
                </div>
                <CardTitle className="text-xl">Cal.com</CardTitle>
              </div>
            </div>
            <CardDescription className="mt-3">
              Professional scheduling with Cal.com integration
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Icon name="check-circle" className="h-4 w-4 text-green-500" />
                <span>Booking pages</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Icon name="check-circle" className="h-4 w-4 text-green-500" />
                <span>Team scheduling</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Icon name="check-circle" className="h-4 w-4 text-green-500" />
                <span>Availability management</span>
              </div>

              <Button
                onClick={() => router.push('/dashboard/calendar/calcom')}
                className="w-full mt-6 "
                size="lg"
              >
                <Icon name="calendar" className="h-4 w-4 mr-2" />
                Open Cal.com
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* GHL Calendar Option */}
        <Card className="hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-0 overflow-hidden">
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <svg className="w-6 h-6 text-orange-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/>
                  </svg>
                </div>
                <CardTitle className="text-xl">GoHighLevel</CardTitle>
              </div>
              {ghlConnection.isConnected && (
                <span className="px-2 py-1 text-xs font-semibold bg-green-100 text-green-700 rounded-full">Connected</span>
              )}
            </div>
            <CardDescription className="mt-3">
              {ghlConnection.isConnected
                ? "Manage your GHL appointments and calendars"
                : "Connect GoHighLevel for CRM-integrated scheduling"
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Icon name="check-circle" className="h-4 w-4 text-green-500" />
                <span>CRM integration</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Icon name="check-circle" className="h-4 w-4 text-green-500" />
                <span>Contact management</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Icon name="check-circle" className="h-4 w-4 text-green-500" />
                <span>Automated workflows</span>
              </div>

              <Button
                onClick={() => {
                  if (ghlConnection.isConnected) {
                    router.push('/dashboard/calendar/ghl');
                  } else {
                    connectGHL();
                  }
                }}
                className="w-full mt-6"
                size="lg"
              >
                <Icon name="calendar" className="h-4 w-4 mr-2" />
                {ghlConnection.isConnected ? "Open GHL Calendar" : "Connect GHL"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

        {/* Help Section */}
        <div className="mt-12 text-center">
          <p className="text-sm text-gray-500">
            Need help connecting your calendar?
            <a href="https://docs.magicteams.ai" className="ml-2 text-blue-600 hover:text-blue-700 font-medium">
              View Documentation
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}