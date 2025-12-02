"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/ui/icons";
import { useToast } from "@/hooks/use-toast";
import {
  cancelCalComBooking,
  rescheduleCalcomBooking,
} from "@/lib/calcom-functions";
import { format } from "date-fns";

interface CalcomViewBookingProps {
  booking: any;
  apiKey: string;
  onClose: () => void;
  onBookingCancelled: () => void;
}

export default function CalcomViewBooking({
  booking,
  apiKey,
  onClose,
  onBookingCancelled,
}: CalcomViewBookingProps) {
  const [loading, setLoading] = useState(false);
  const [rescheduleMode, setRescheduleMode] = useState(false);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [newDateTime, setNewDateTime] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");
  const { toast } = useToast();

  const onSelectReschedule = () => {
    setNewDateTime("");
    setRescheduleReason("");
    setRescheduleMode(true);
  };

  const handleCancelBooking = async () => {
    if (!booking?.uid) {
      toast({
        title: "Error",
        description: "Booking UID not found",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      await cancelCalComBooking(booking.uid, apiKey);

      toast({
        title: "Success",
        description: "Booking cancelled successfully",
      });

      onBookingCancelled();
      onClose();
    } catch (error: any) {
      console.error("Error cancelling booking:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to cancel booking",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRescheduleBooking = async () => {
    if (!booking?.uid) {
      toast({
        title: "Error",
        description: "Booking UID not found",
        variant: "destructive",
      });
      return;
    }

    if (!newDateTime) {
      toast({
        title: "Error",
        description: "Please select a new date and time",
        variant: "destructive",
      });
      return;
    }

    try {
      setRescheduleLoading(true);

      // Convert the datetime-local input to ISO string
      const newStartTime = new Date(newDateTime).toISOString();

      await rescheduleCalcomBooking(
        booking.uid,
        apiKey,
        newStartTime,
        "admin",
        rescheduleReason
      );

      toast({
        title: "Success",
        description: "Booking rescheduled successfully",
      });

      // Reset reschedule mode and refetch booking
      setRescheduleMode(false);
      setNewDateTime("");
      setRescheduleReason("");
      onBookingCancelled(); // This will trigger a refetch
      onClose();
    } catch (error: any) {
      console.error("Error rescheduling booking:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to reschedule booking",
        variant: "destructive",
      });
    } finally {
      setRescheduleLoading(false);
    }
  };

  const isCancelled = booking?.status?.toLowerCase() === "cancelled";

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Booking Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700">Title</label>
              <p className="text-sm text-gray-900">
                {booking?.title || "No title"}
              </p>
            </div>

            <div className="border-t border-gray-200"></div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Start Time
                </label>
                <p className="text-sm text-gray-900">
                  {booking?.startTime
                    ? format(new Date(booking.startTime), "PPP p")
                    : "Not specified"}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">
                  End Time
                </label>
                <p className="text-sm text-gray-900">
                  {booking?.endTime
                    ? format(new Date(booking.endTime), "PPP p")
                    : "Not specified"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Duration
                </label>
                <p className="text-sm text-gray-900">
                  {booking?.startTime && booking?.endTime
                    ? `${Math.round(
                        (new Date(booking.endTime).getTime() -
                          new Date(booking.startTime).getTime()) /
                          (1000 * 60)
                      )} minutes`
                    : booking?.duration
                    ? `${booking.duration} minutes`
                    : "Not specified"}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">
                  Attendees
                </label>
                <div className="text-sm text-gray-900">
                  {booking?.attendees && booking.attendees.length > 0
                    ? booking.attendees.map((attendee: any, index: number) => (
                        <div key={index}>
                          {attendee.name} ({attendee.email})
                        </div>
                      ))
                    : "No attendees"}
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 my-1"></div>

            {booking?.description && (
              <>
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <p className="text-sm text-gray-900">{booking.description}</p>
                </div>

                <div className="border-t border-gray-200 my-3"></div>
              </>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Status
                </label>
                <p
                  className={`text-sm capitalize ${
                    isCancelled ? "text-red-600 font-medium" : "text-gray-900"
                  }`}
                >
                  {booking?.status || "Unknown"}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">
                  Booking ID
                </label>
                <p className="text-sm text-gray-500 font-mono">
                  {booking?.uid || booking?.id || "Not available"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Reschedule Form */}
        {rescheduleMode && (
          <div className="border-t pt-4 space-y-4 mb-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Date & Time
                </label>
                <Input
                  type="datetime-local"
                  value={newDateTime}
                  onChange={(e) => setNewDateTime(e.target.value)}
                  disabled={rescheduleLoading}
                  className="w-full"
                  min={new Date().toISOString().slice(0, 16)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reschedule Reason
                </label>
                <Input
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  placeholder="Type your reason..."
                  disabled={rescheduleLoading}
                  className="w-full"
                  type="text"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleRescheduleBooking}
                  disabled={rescheduleLoading || !newDateTime}
                >
                  {rescheduleLoading ? (
                    <>
                      <Icon
                        name="loader2"
                        className="h-4 w-4 animate-spin mr-2"
                      />
                      Rescheduling...
                    </>
                  ) : (
                    <>
                      <Icon name="calendar" className="h-4 w-4 mr-2" />
                      Confirm Reschedule
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* //there is some issue with the calcom cancel event api  */}
        <DialogFooter className="gap-2 sm:gap-0">
          <div className="flex items-center justify-between w-full">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading || rescheduleLoading}
            >
              Close
            </Button>

            <div className="flex gap-2">
              <Button
                onClick={onSelectReschedule}
                disabled={loading || rescheduleLoading || isCancelled}
                variant="secondary"
              >
                <Icon name="calendar" className="h-4 w-4 mr-2" />
                Reschedule
              </Button>

              <Button
                variant="destructive"
                onClick={handleCancelBooking}
                disabled={loading || rescheduleLoading || isCancelled}
              >
                {isCancelled ? (
                  <>
                    <Icon name="x-circle" className="h-4 w-4 mr-2" />
                    Cancelled Already
                  </>
                ) : loading ? (
                  <>
                    <Icon
                      name="loader2"
                      className="h-4 w-4 animate-spin mr-2"
                    />
                    Cancelling...
                  </>
                ) : (
                  <>
                    <Icon name="x-circle" className="h-4 w-4 mr-2" />
                    Cancel Event
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
