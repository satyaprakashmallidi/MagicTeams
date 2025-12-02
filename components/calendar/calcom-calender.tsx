import {
  useEffect,
  useState,
  useMemo,
  useCallback,
  ComponentType,
} from "react";
import { View, dateFnsLocalizer, CalendarProps } from "react-big-calendar";
import format from "date-fns/format";
import parse from "date-fns/parse";
import startOfWeek from "date-fns/startOfWeek";
import getDay from "date-fns/getDay";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import CalcomModal from "@/components/calendar/calcom-modal";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { Icon } from "@/components/ui/icons";
import dynamic from "next/dynamic";
import CalcomNewBooking from "@/components/calendar/calcom-newbooking";
import CalcomViewBooking from "@/components/calendar/calcom-viewbooking";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { getAllBookings, getUserInfo } from "@/lib/calcom-functions";
import { CalComBooking, CalComUserInfo } from "@/lib/types";

interface CalendarEvent {
  id: number;
  title: string;
  start: Date;
  end: Date;
  resource: CalComBooking;
}

const DynamicCalendar = dynamic(
  () =>
    import("react-big-calendar").then(
      (mod) => mod.Calendar as ComponentType<CalendarProps>
    ),
  { ssr: false }
);

const locales = {
  "en-US": require("date-fns/locale/en-US"),
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

export default function CalcomCalender({
  backToCalendar,
}: {
  backToCalendar: () => void;
}) {
  const router = useRouter();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [initialCheckComplete, setInitialCheckComplete] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<View>("month");
  const [date, setDate] = useState(new Date());
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isViewBookingModalOpen, setIsViewBookingModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<CalComBooking | null>(
    null
  );

  // ------adding new
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isCheckingApiKey, setIsCheckingApiKey] = useState(false);


  const [bookings, setBookings] = useState<CalComBooking[]>([]);
  const [userInfo, setUserInfo] = useState<CalComUserInfo | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);


  useEffect(()=>{
    // console.log("useEffect of calender on mount!")
    getApiKey();
  }, [])

  useEffect(()=>{

    if(apiKey){
      // console.log(" useEffect and apiKey is", apiKey)
      fetchUserInfo(apiKey);
      fetchBookings(apiKey);
    }
  }, [apiKey]);


  const getApiKey = async () => {
    try {
      setIsCheckingApiKey(true);
      setError(null);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return false;

      const { data, error } = await supabase
        .from("user_calcom_credentials")
        .select("api_key")
        .eq("user_id", user.id)
        .single();

      if (error || !data?.api_key) {
       
        toast({
          title: "Error",
          description: "No Cal.com API key found" + error?.message,
          variant: "destructive",
        });
        return;
      }

      if(data.api_key){
        setApiKey(data.api_key);
      }

      return true;
    } catch (err: any) {
      console.error("Error getting Cal.com API key:", err);

      toast({
        title: "Error",
        description: "Error getting Cal.com API key" + err.message,
        variant: "destructive",
      });
    } finally {
      setIsCheckingApiKey(false);
      setInitialCheckComplete(true);
    }
  };

  const fetchBookings = async(key:string)=>{
    try {
      const isValid = await isCalcomAPIValid(key);
      if (!isValid) return;

      setIsLoading(true);
      setError(null);
      const bookings = await getAllBookings(key || "");
      setBookings(bookings);
      setIsLoading(false);
    } catch (err: any) {
      setError("Error fetching bookings" + err.message);
      toast({
        title: "Error",
        description: "Error fetching bookings" + err.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  const fetchUserInfo = async(key:string)=>{
    const isValid = await isCalcomAPIValid(key);
      if (!isValid) return;

    try {
      setIsLoading(true);
      setError(null);
      const userInfo = await getUserInfo(key || "");
      setUserInfo(userInfo);
      setIsLoading(false);
    } catch (err: any) {
      setError("Error fetching user info" + err.message);
      toast({
        title: "Error",
        description: "Error fetching user info" + err.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  const handlePostConnect = async (newApiKey: string) => {
    setApiKey(newApiKey);
    const isValid = await isCalcomAPIValid(newApiKey);
    if (!isValid) return;
    await Promise.all([
      fetchUserInfo(newApiKey),
      fetchBookings(newApiKey),
    ]);
  };

  const isCalcomAPIValid = async (key: string): Promise<boolean> => {
    try {
      const response = await fetch(`https://api.cal.com/v1/event-types?apiKey=${key}`, {
        method: "GET",
      });
      const data = await response.json();
      if (data?.error) {
        toast({
          title: "Error",
          description: "Cal.com API Key is invalid.",
          variant: "destructive",
        });
        return false;
      }
  
      return true;
    } catch (err) {
      console.error("Unexpected error while checking API validity:", err);
      toast({
        title: "Error",
        description: "Please use a valid Cal.com API key.",
        variant: "destructive",
      });
      return false;
    }
  };
  

  const events: CalendarEvent[] = useMemo(() => {
    if (!Array.isArray(bookings)) return []; // safety guard
    return bookings.map((booking) => ({
      id: booking.id,
      title: booking.title,
      start: booking.startTime, 
      end: booking.endTime,     
      resource: booking,
    }));
  }, [bookings]);

 

  const handleRefresh = async () => {
    setRefreshing(true);
    if(!apiKey) return
    await fetchBookings(apiKey);
    setRefreshing(false);
  };

  const handleEventSelect = (event: any) => {
    setSelectedBooking(event.resource);
    setIsViewBookingModalOpen(true);
  };

  if (!initialCheckComplete || isCheckingApiKey) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <Icon
          name="loader-2"
          className="h-8 w-8 animate-spin text-blue-600 mb-4"
        />
        <h2 className="text-xl font-medium">Checking Cal.com credentials</h2>
      </div>
    );
  }

  return (
    <div className="p-4">
      <Card className="mb-6">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Cal.com Calendar</CardTitle>
              <CardDescription className="mt-2">
                {userInfo && `Cal.com email: ${userInfo.email} | Username: ${userInfo.username}`}
              </CardDescription>
            </div>
            <div className="flex space-x-2">
              <Button
                variant="ghost"
                onClick={backToCalendar}
                className="flex items-center gap-2"
              >
                <Icon name="left-arrow" className="h-4 w-4" />
                Back to Calendar
              </Button>
              <Button onClick={() => setIsModalOpen(true)} variant="outline">
                {apiKey ? "Reconnect Cal.com" : "Connect Cal.com"}
              </Button>
              <Button
                onClick={() => setIsBookingModalOpen(true)}
                variant="default"
              >
                Book Event
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading || refreshing ? (
            <div className="flex justify-center items-center h-[600px]">
              <div className="flex flex-col items-center">
                <Icon
                  name="loader-2"
                  className="h-8 w-8 animate-spin text-blue-600 mb-4"
                />
                <p className="text-lg font-medium">
                  Loading your Cal.com bookings...
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="p-4 border border-red-300 bg-red-50 text-red-700 rounded-md">
              <p className="font-medium">Error:</p>
              <p>{error}</p>
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col justify-center items-center h-[600px] text-center p-6 border-2 border-dashed rounded-lg">
              <h3 className="text-xl font-medium mb-2">No bookings found</h3>
              {!apiKey ? (
                <p className="text-muted-foreground">
                  Connect your Cal.com account to view your bookings
                </p>
              ) : (
                <p className="text-muted-foreground">
                  You don't have any bookings in your Cal.com calendar
                </p>
              )}
            </div>
          ) : (
            <div className="h-[600px]">
              <DynamicCalendar
                localizer={localizer}
                events={events}
                startAccessor="start"
                endAccessor="end"
                views={["month", "week", "day"]}
                step={60}
                showMultiDayTimes
                selectable
                style={{ height: "calc(100% - 16px)" }}
                view={view}
                onView={setView}
                date={date}
                onNavigate={setDate}
                defaultView="month"
                popup
                toolbar={true}
                min={new Date(0, 0, 0, 6, 0, 0)}
                max={new Date(0, 0, 0, 23, 59, 59)}
                onSelectEvent={handleEventSelect}
                eventPropGetter={(event: any) => {
                  const isCancelled =
                    event.resource?.status?.toLowerCase() === "cancelled";
                  return {
                    style: {
                      backgroundColor: isCancelled ? "#ef4444" : "#369722",
                      borderRadius: "4px",
                      color: "#FFFFFF",
                      border: "none",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                      padding: "2px 4px",
                      opacity: isCancelled ? 0.7 : 1,
                    },
                  };
                }}
              />
            </div>
          )}
        </CardContent>
        {apiKey && events.length > 0 && (
          <CardFooter className="justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {events.length} bookings from Cal.com
            </div>
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              {refreshing ? (
                <>
                  <Icon name="loader-2" className="h-4 w-4 animate-spin mr-2" />
                  Refreshing...
                </>
              ) : (
                "Refresh"
              )}
            </Button>
          </CardFooter>
        )}
      </Card>

      <CalcomModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
        }}
        onConnectSuccess={handlePostConnect}
      />
      {isBookingModalOpen && (
        <CalcomNewBooking
          apiKey={apiKey!}
          username={userInfo?.username || ""}
          onClose={() => setIsBookingModalOpen(false)}
          onBookingConfirmed={() => {
            setIsBookingModalOpen(false);
            handleRefresh();
          }}
        />
      )}
      {isViewBookingModalOpen && selectedBooking && (
        <CalcomViewBooking
          booking={selectedBooking}
          apiKey={apiKey!}
          onClose={() => {
            setIsViewBookingModalOpen(false);
            setSelectedBooking(null);
          }}
          onBookingCancelled={() => {
            setIsViewBookingModalOpen(false);
            setSelectedBooking(null);
            handleRefresh();
          }}
        />
      )}
    </div>
  );
}
