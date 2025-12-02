"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Icon } from "@/components/ui/icons";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createCalComBooking, getAllEvents } from "@/lib/calcom-functions";
import { CalComEventType } from "@/lib/types";

interface CalcomNewBookingProps {
  apiKey: string;
  username: string;
  onClose: () => void;
  onBookingConfirmed: () => void;
}

export default function CalcomNewBooking({
  apiKey,
  username,
  onClose,
  onBookingConfirmed,
}: CalcomNewBookingProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm();

  const selectedEventTypeId = watch("eventTypeId");

  const [userEvents, setUserEvents] = useState<CalComEventType[]>([]);

  useEffect(() => {
    fetchUserEvents();
  }, []);

  const fetchUserEvents = async () => {
    try {
      setLoading(true);
      const events = await getAllEvents(apiKey, username);
      // console.log("events in the new booking are : ", events);
      setUserEvents(events);
    } catch (error) {
      console.error("Error fetching user events:", error);
      toast({
        title: "Error",
        description: "Failed to fetch event types",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: any) => {
    try {
      setLoading(true);

      const selectedEventType = userEvents.find(
        (et) => et.eventId === Number(data.eventTypeId)
      );
      if (!selectedEventType) {
        throw new Error("Selected event type not found");
      }

      // Calculate end time based on start time + event duration
      const startTime = new Date(data.start);
      const endTime = new Date(
        startTime.getTime() + selectedEventType.lengthInMinutes * 60000
      );

      const bookingPayload = {
        eventTypeId: selectedEventType.id,
        start: startTime.toISOString(),
        end: endTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: "en",
        metadata: {},
        attendee: {
          name: data.name,
          email: data.email || "test@example.com", // Use a default email since field is commented out
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        bookingFieldsResponses: {
          notes: data.description || undefined,
        },
      };

      console.log("the payload for the booking is ", bookingPayload);
      await createCalComBooking(bookingPayload, apiKey);

      toast({ title: "Success", description: "Booking created successfully." });
      onBookingConfirmed();
      onClose();
    } catch (error: any) {
      console.error("Error creating booking:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create booking",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedEventTypeId) {
      const selected = userEvents.find(
        (et) => et.eventId === Number(selectedEventTypeId)
      );
      if (selected && watch("start")) {
        const startTime = new Date(watch("start"));
        const endTime = new Date(
          startTime.getTime() + selected.lengthInMinutes * 60000
        );
        setValue("end", endTime.toISOString().slice(0, 16));
      }
    }
  }, [selectedEventTypeId, userEvents, watch, setValue]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Book New Event</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Event Type
            </label>
            <Select
              onValueChange={(value) => setValue("eventTypeId", value)}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select an event type" />
              </SelectTrigger>
              <SelectContent>
                {userEvents.map((eventType) => (
                  <SelectItem
                    key={eventType.eventId}
                    value={String(eventType.eventId)}
                  >
                    {eventType.title} ({eventType.lengthInMinutes} min)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {errors.eventTypeId && (
              <span className="text-red-500 text-sm">
                Event type is required
              </span>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Name
            </label>
            <Input
              {...register("name", { required: true })}
              placeholder="name"
              disabled={loading}
            />
            {errors.name && (
              <span className="text-red-500 text-sm">Name is required</span>
            )}
          </div>

          {/* <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <Input
              type="email"
              {...register('email', { required: true })}
              placeholder="Attendee's email"
              disabled={loading}
            />
            {errors.email && <span className="text-red-500 text-sm">A valid email is required</span>}
          </div> */}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Start
              </label>
              <Input
                type="datetime-local"
                {...register("start", { required: true })}
                disabled={loading}
              />
              {errors.start && (
                <span className="text-red-500 text-sm">
                  Start time is required
                </span>
              )}
            </div>
            {/* <div>
              <label className="block text-sm font-medium text-gray-700">End</label>
              <Input
                type="datetime-local"
                {...register('end', { required: true })}
                disabled={loading || !!selectedEventTypeId} // Disable if event type is selected, as it's auto-calculated
              />
              {errors.end && <span className="text-red-500 text-sm">End time is required</span>}
            </div> */}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Description (Optional)
            </label>
            <Textarea
              {...register("description")}
              placeholder="Booking notes"
              disabled={loading}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <div className="flex items-center justify-end w-full">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <Icon
                        name="loader2"
                        className="h-4 w-4 animate-spin mr-2"
                      />
                      Booking...
                    </>
                  ) : (
                    "Book Event"
                  )}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
