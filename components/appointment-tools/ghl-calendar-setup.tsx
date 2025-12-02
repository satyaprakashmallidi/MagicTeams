import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Icon } from '@/components/ui/icons';
import { useToast } from '@/hooks/use-toast';
import { useGHLCalendar } from '@/hooks/use-ghl-calendar';
import { ghlClient } from '@/lib/ghl-client';
import { GHLCalendar, GHLUser } from '@/lib/types';

// Extended GHL Calendar interface for appointment tools with additional fields
interface ExtendedGHLCalendar extends GHLCalendar {
  slotDuration: number;
  slotDurationUnit: string;
  slotInterval: number;
  slotIntervalUnit: string;
  openHours: Array<{
    daysOfTheWeek: number[];
    hours: Array<{
      openHour: number;
      openMinute: number;
      closeHour: number;
      closeMinute: number;
    }>;
  }>;
}

interface GHLCalendarSetupProps {
  onCalendarSelected: (calendarData: {
    calendarId: string;
    staffId: string;
    businessHours: any;
    duration: number;
    calendarName: string;
    calendarDescription?: string;
  }) => void;
  onNext: () => void;
  onBack?: () => void;
}

export function GHLCalendarSetup({ onCalendarSelected, onNext, onBack }: GHLCalendarSetupProps) {
  const { toast } = useToast();
  const { connection } = useGHLCalendar();

  const [calendars, setCalendars] = useState<ExtendedGHLCalendar[]>([]);
  const [users, setUsers] = useState<GHLUser[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>('');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [selectedCalendar, setSelectedCalendar] = useState<ExtendedGHLCalendar | null>(null);

  const [loadingCalendars, setLoadingCalendars] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingCalendarDetails, setLoadingCalendarDetails] = useState(false);
  const [calendarsError, setCalendarsError] = useState<string | null>(null);
  const [usersError, setUsersError] = useState<string | null>(null);

  // Fetch calendars and users on component mount
  useEffect(() => {
    fetchCalendars();
    fetchUsers();
  }, []);

  const fetchCalendars = async () => {
    setLoadingCalendars(true);
    setCalendarsError(null);

    try {
      const calendars = await ghlClient.getAllCalendars();
      setCalendars(calendars as ExtendedGHLCalendar[]);
    } catch (error) {
      console.error('Error fetching GHL calendars:', error);
      setCalendarsError(error instanceof Error ? error.message : 'Failed to fetch calendars');
    } finally {
      setLoadingCalendars(false);
    }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    setUsersError(null);

    try {
      const users = await ghlClient.getAllUsersByLocationId();
      setUsers(users);
    } catch (error) {
      console.error('Error fetching GHL users:', error);
      setUsersError(error instanceof Error ? error.message : 'Failed to fetch staff members');
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchCalendarDetails = async (calendarId: string) => {
    setLoadingCalendarDetails(true);

    try {
      const calendar = await ghlClient.getCalendarById(calendarId);
      setSelectedCalendar(calendar as ExtendedGHLCalendar);
    } catch (error) {
      console.error('Error fetching calendar details:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to fetch calendar details',
        variant: "destructive",
      });
    } finally {
      setLoadingCalendarDetails(false);
    }
  };

  const handleCalendarSelect = (calendarId: string) => {
    setSelectedCalendarId(calendarId);
    fetchCalendarDetails(calendarId);
  };

  const formatBusinessHours = (openHours: ExtendedGHLCalendar['openHours']) => {
    const dayMapping = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const businessHours: any = {};

    // Initialize all days as disabled
    dayMapping.forEach(day => {
      businessHours[day] = { enabled: false, start: '09:00', end: '17:00' };
    });

    // Process the openHours from GHL format
    openHours.forEach(schedule => {
      schedule.daysOfTheWeek.forEach(dayIndex => {
        const dayName = dayMapping[dayIndex];
        if (schedule.hours && schedule.hours.length > 0) {
          const firstHour = schedule.hours[0];
          const startTime = `${String(firstHour.openHour).padStart(2, '0')}:${String(firstHour.openMinute).padStart(2, '0')}`;
          const endTime = `${String(firstHour.closeHour).padStart(2, '0')}:${String(firstHour.closeMinute).padStart(2, '0')}`;

          businessHours[dayName] = {
            enabled: true,
            start: startTime,
            end: endTime
          };
        }
      });
    });

    return businessHours;
  };

  const handleNext = () => {
    if (!selectedCalendarId || !selectedStaffId || !selectedCalendar) {
      toast({
        title: "Required Selections Missing",
        description: "Please select both a calendar and a staff member before proceeding.",
        variant: "destructive",
      });
      return;
    }

    const businessHours = formatBusinessHours(selectedCalendar.openHours);

    onCalendarSelected({
      calendarId: selectedCalendarId,
      staffId: selectedStaffId,
      businessHours,
      duration: selectedCalendar.slotDuration,
      calendarName: selectedCalendar.name,
      calendarDescription: selectedCalendar.description
    });

    onNext();
  };

  // This check is now handled by the parent wizard component

  return (
    <div className="space-y-6">
      {/* Calendar Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon name="calendar" className="h-5 w-5" />
            Select Calendar
          </CardTitle>
          <CardDescription>
            Choose which GoHighLevel calendar to use for appointments
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingCalendars ? (
            <div className="flex items-center justify-center py-6">
              <Icon name="loader2" className="h-6 w-6 animate-spin mr-2" />
              Loading calendars...
            </div>
          ) : calendarsError ? (
            <div className="text-center py-6">
              <Icon name="alert-circle" className="h-8 w-8 text-red-500 mx-auto mb-2" />
              <p className="text-red-600 mb-4">{calendarsError}</p>
              <Button variant="outline" onClick={fetchCalendars}>
                <Icon name="refresh-cw" className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          ) : calendars.length === 0 ? (
            <div className="text-center py-6">
              <Icon name="calendar" className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">No calendars found in your GHL account.</p>
            </div>
          ) : (
            <Select value={selectedCalendarId} onValueChange={handleCalendarSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Select a calendar" />
              </SelectTrigger>
              <SelectContent>
                {calendars.map((calendar) => (
                  <SelectItem key={calendar.id} value={calendar.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{calendar.name}</span>
                      {calendar.description && (
                        <span className="text-sm text-muted-foreground">{calendar.description}</span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {calendar.slotDuration} {calendar.slotDurationUnit} slots • {calendar.calendarType}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {/* Staff Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon name="users" className="h-5 w-5" />
            Assign Staff Member
          </CardTitle>
          <CardDescription>
            Select the staff member who will handle these appointments.{' '}
            <br></br>
            <span className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 cursor-pointer">
              You can add or view staff in Settings &gt; My Staff in your GHL dashboard
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingUsers ? (
            <div className="flex items-center justify-center py-6">
              <Icon name="loader2" className="h-6 w-6 animate-spin mr-2" />
              Loading staff members...
            </div>
          ) : usersError ? (
            <div className="text-center py-6">
              <Icon name="alert-circle" className="h-8 w-8 text-red-500 mx-auto mb-2" />
              <p className="text-red-600 mb-4">{usersError}</p>
              <Button variant="outline" onClick={fetchUsers}>
                <Icon name="refresh-cw" className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-6">
              <Icon name="users" className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground mb-4">No staff members found in your GHL account.</p>
              <Button
                variant="outline"
                onClick={() => window.open('https://app.gohighlevel.com/settings/team', '_blank')}
              >
                <Icon name="external-link" className="h-4 w-4 mr-2" />
                Manage Staff in GHL
              </Button>
            </div>
          ) : (
            <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a staff member" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    <span className="font-medium">{user.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {/* Calendar Details Preview */}
      {selectedCalendar && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon name="info" className="h-5 w-5" />
              Calendar Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingCalendarDetails ? (
              <div className="flex items-center justify-center py-6">
                <Icon name="loader2" className="h-6 w-6 animate-spin mr-2" />
                Loading calendar details...
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Calendar Name:</span>
                    <p className="text-sm">{selectedCalendar.name}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Slot Duration:</span>
                    <p className="text-sm">{selectedCalendar.slotDuration} {selectedCalendar.slotDurationUnit}</p>
                  </div>
                </div>

                <div>
                  <span className="text-sm font-medium text-muted-foreground block mb-2">Business Hours:</span>
                  <div className="space-y-1">
                    {selectedCalendar.openHours.map((schedule, index) => (
                      <div key={index} className="text-sm">
                        {schedule.daysOfTheWeek.map(day => {
                          const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                          return days[day];
                        }).join(', ')}: {
                          schedule.hours.map(h => {
                            const formatTime = (hour: number, minute: number) => {
                              const period = hour >= 12 ? 'PM' : 'AM';
                              const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
                              return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
                            };
                            return `${formatTime(h.openHour, h.openMinute)} - ${formatTime(h.closeHour, h.closeMinute)}`;
                          }).join(', ')
                        }
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        {onBack && (
          <Button variant="outline" onClick={onBack}>
            <Icon name="arrow-left" className="h-4 w-4 mr-2" />
            Back
          </Button>
        )}
        <Button
          onClick={handleNext}
          disabled={!selectedCalendarId || !selectedStaffId || loadingCalendarDetails}
          className="ml-auto"
        >
          Next
          <Icon name="arrow-right" className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}