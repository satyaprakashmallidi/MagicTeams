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
import { ghlClient } from "@/lib/ghl-client";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface GHLViewBookingProps {
  event: any;
  onClose: () => void;
  onEventUpdated: () => void;
}

export default function GHLViewBooking({
  event,
  onClose,
  onEventUpdated,
}: GHLViewBookingProps) {
  const [loading, setLoading] = useState(false);
  const [rescheduleMode, setRescheduleMode] = useState(false);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [newDate, setNewDate] = useState<Date>();
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [rescheduleReason, setRescheduleReason] = useState("");
  const { toast } = useToast();

  if (!event) {
    return null;
  }

  const onSelectReschedule = () => {
    setNewDate(undefined);
    setSelectedSlot("");
    setRescheduleReason("");
    setRescheduleMode(true);
  };

  // Generate time slots from 8:00 AM to 6:00 PM like in new booking
  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 8; hour <= 18; hour++) {
      // Add :00 slot
      const time00 = `${hour <= 12 ? hour : hour - 12}:00${hour < 12 ? 'AM' : 'PM'}`;
      const value00 = `${hour.toString().padStart(2, '0')}:00`;
      slots.push({ display: time00, value: value00 });

      // Add :30 slot (except for 6:30 PM)
      if (hour < 18) {
        const time30 = `${hour <= 12 ? hour : hour - 12}:30${hour < 12 ? 'AM' : 'PM'}`;
        const value30 = `${hour.toString().padStart(2, '0')}:30`;
        slots.push({ display: time30, value: value30 });
      }
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  const handleCancelAppointment = async () => {
    if (!event?.id) {
      toast({
        title: "Error",
        description: "Appointment ID not found",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      await ghlClient.deleteEvent(event.id);

      toast({
        title: "Success",
        description: "Appointment cancelled successfully",
      });

      onEventUpdated();
      onClose();
    } catch (error: any) {
      console.error("Error cancelling appointment:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to cancel appointment",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRescheduleAppointment = async () => {
    if (!event?.id) {
      toast({
        title: "Error",
        description: "Appointment ID not found",
        variant: "destructive",
      });
      return;
    }

    if (!newDate) {
      toast({
        title: "Error",
        description: "Please select a new date",
        variant: "destructive",
      });
      return;
    }

    if (!selectedSlot) {
      toast({
        title: "Error",
        description: "Please select a time slot",
        variant: "destructive",
      });
      return;
    }

    try {
      setRescheduleLoading(true);

      // Combine selected date and time
      const [hours, minutes] = selectedSlot.split(':').map(Number);
      const startTime = new Date(newDate);
      startTime.setHours(hours, minutes, 0, 0);

      // Calculate end time (assuming 30 minute duration)
      const endTime = new Date(startTime.getTime() + 30 * 60000);

      const newStartTime = startTime.toISOString();
      const newEndTime = endTime.toISOString();

      await ghlClient.updateEvent(event.id, {
        startTime: newStartTime,
        endTime: newEndTime,
        notes: rescheduleReason ? `Rescheduled: ${rescheduleReason}` : event.notes,
      });

      toast({
        title: "Success",
        description: "Appointment rescheduled successfully",
      });

      // Reset reschedule mode and refetch events
      setRescheduleMode(false);
      setNewDate(undefined);
      setSelectedSlot("");
      setRescheduleReason("");
      onEventUpdated();
      onClose();
    } catch (error: any) {
      console.error("Error rescheduling appointment:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to reschedule appointment",
        variant: "destructive",
      });
    } finally {
      setRescheduleLoading(false);
    }
  };

  const isCancelled = event?.appointmentStatus?.toLowerCase() === "cancelled";
  const isNoShow = event?.appointmentStatus?.toLowerCase() === "noshow";

  // Format date/time for display
  const formatDateTime = (dateString: string) => {
    if (!dateString) return "Not specified";
    try {
      return format(new Date(dateString), "PPP p");
    } catch {
      return dateString;
    }
  };

  // Calculate duration
  const calculateDuration = () => {
    if (event?.startTime && event?.endTime) {
      const start = new Date(event.startTime);
      const end = new Date(event.endTime);
      const durationMs = end.getTime() - start.getTime();
      const durationMinutes = Math.round(durationMs / (1000 * 60));
      return `${durationMinutes} minutes`;
    }
    return "Not specified";
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "confirmed":
        return "text-green-600";
      case "cancelled":
        return "text-red-600";
      case "showed":
        return "text-blue-600";
      case "noshow":
        return "text-orange-600";
      case "new":
        return "text-purple-600";
      default:
        return "text-gray-600";
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Appointment Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            {/* First Row: Title and Appointment ID */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Title</label>
                <p className="text-sm text-gray-900 font-medium">
                  {event?.title || "Untitled Appointment"}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">
                  Appointment ID
                </label>
                <p className="text-xs text-gray-500 font-mono">
                  {event?.id || "Not available"}
                </p>
              </div>
            </div>

            <div className="border-t border-gray-200"></div>

            {/* Second Row: Date and Duration */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Date
                </label>
                <p className="text-sm text-gray-900">
                  {event?.startTime ? format(new Date(event.startTime), "PPP") : "Not specified"}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">
                  Time & Duration
                </label>
                <p className="text-sm text-gray-900">
                  {event?.startTime ? format(new Date(event.startTime), "p") : "Not specified"} • {calculateDuration()}
                </p>
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="text-sm font-medium text-gray-700">
                Status
              </label>
              <p className={`text-sm capitalize font-medium ${getStatusColor(event?.appointmentStatus)}`}>
                {event?.appointmentStatus || "Unknown"}
              </p>
            </div>

            <div className="border-t border-gray-200"></div>

            {/* Location/Address */}
            {event?.address && (
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Location
                </label>
                <p className="text-sm text-gray-900">{event.address}</p>
              </div>
            )}

            {/* Meeting Type */}
            {event?.meetingLocationType && (
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Meeting Type
                </label>
                <p className="text-sm text-gray-900 capitalize">
                  {event.meetingLocationType.replace("_", " ")}
                </p>
              </div>
            )}

            {/* Notes */}
            {event?.notes && (
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Notes
                </label>
                <p className="text-sm text-gray-900 whitespace-pre-wrap">
                  {event.notes}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Reschedule Form */}
        {rescheduleMode && (
          <div className="border-t pt-4 space-y-4 mb-4">
            <div className="space-y-4">
              {/* Date Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Date *
                </label>
                <Input
                  type="date"
                  value={newDate ? format(newDate, "yyyy-MM-dd") : ""}
                  onChange={(e) => {
                    if (e.target.value) {
                      setNewDate(new Date(e.target.value));
                    } else {
                      setNewDate(undefined);
                    }
                    setSelectedSlot(""); // Reset time selection when date changes
                  }}
                  min={format(new Date(), "yyyy-MM-dd")}
                  disabled={rescheduleLoading}
                  className="w-full"
                />
                {!newDate && (
                  <span className="text-red-500 text-sm">Date is required</span>
                )}
              </div>

              {/* Time Selection */}
              {newDate && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Time *
                  </label>
                  <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto border rounded-md p-3">
                    {timeSlots.map((slot) => (
                      <button
                        key={slot.value}
                        type="button"
                        onClick={() => setSelectedSlot(slot.value)}
                        className={cn(
                          "px-3 py-2 text-sm border rounded-md transition-colors text-center",
                          selectedSlot === slot.value
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                        )}
                        disabled={rescheduleLoading}
                      >
                        {slot.display}
                      </button>
                    ))}
                  </div>
                  {!selectedSlot && (
                    <span className="text-red-500 text-sm">Please select a time</span>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reschedule Reason
                </label>
                <Input
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  placeholder="Optional reason for rescheduling..."
                  disabled={rescheduleLoading}
                  className="w-full"
                  type="text"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleRescheduleAppointment}
                  disabled={rescheduleLoading || !newDate || !selectedSlot}
                  className="flex-1"
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
                <Button
                  variant="outline"
                  onClick={() => setRescheduleMode(false)}
                  disabled={rescheduleLoading}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

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
              {!rescheduleMode && (
                <Button
                  onClick={onSelectReschedule}
                  disabled={loading || rescheduleLoading || isCancelled || isNoShow}
                  variant="secondary"
                >
                  <Icon name="calendar" className="h-4 w-4 mr-2" />
                  Reschedule
                </Button>
              )}

              <Button
                variant="destructive"
                onClick={handleCancelAppointment}
                disabled={loading || rescheduleLoading || isCancelled}
              >
                {isCancelled ? (
                  <>
                    <Icon name="x-circle" className="h-4 w-4 mr-2" />
                    Already Cancelled
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
                    Cancel Appointment
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