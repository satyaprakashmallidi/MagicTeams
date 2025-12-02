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
import { ghlClient } from "@/lib/ghl-client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { GHLContact, GHLUser } from "@/lib/types";

interface GHLCalendar {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  eventColor?: string;
  calendarType: string;
}



interface GHLNewBookingProps {
  calendars: GHLCalendar[];
  onClose: () => void;
  onBookingConfirmed: () => void;
}

export default function GHLNewBooking({
  calendars,
  onClose,
  onBookingConfirmed,
}: GHLNewBookingProps) {
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<GHLContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [teamMembers, setTeamMembers] = useState<GHLUser[]>([]);
  const [loadingTeamMembers, setLoadingTeamMembers] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState<string>("");
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm();

  const watchedCalendarId = watch("calendarId");

  // Fetch contacts and team members when component mounts
  useEffect(() => {
    fetchContacts();
    fetchTeamMembers();
  }, []);

  // Generate time slots from 8:00 AM to 6:00 PM
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

  const fetchContacts = async () => {
    try {
      setLoadingContacts(true);
      const contacts = await ghlClient.getAllContacts();
      setContacts(contacts);
    } catch (error) {
      console.error("Error fetching contacts:", error);
      toast({
        title: "Error",
        description: "Failed to fetch contacts",
        variant: "destructive",
      });
    } finally {
      setLoadingContacts(false);
    }
  };

  const fetchTeamMembers = async () => {
    try {
      setLoadingTeamMembers(true);
      const users = await ghlClient.getAllUsersByLocationId();

      // Users from GHL API are already in the correct format
      setTeamMembers(users);
    } catch (error) {
      console.error("Error fetching team members:", error);
      toast({
        title: "Error",
        description: "Failed to fetch team members",
        variant: "destructive",
      });
    } finally {
      setLoadingTeamMembers(false);
    }
  };

  const onSubmit = async (data: any) => {
    try {
      setLoading(true);

      // Validate required fields
      if (!data.calendarId) {
        throw new Error("Please select a calendar");
      }
      if (!data.contactId) {
        throw new Error("Please select a contact");
      }
      if (!selectedDate) {
        throw new Error("Please select a date");
      }
      if (!selectedTime) {
        throw new Error("Please select a time slot");
      }

      // Combine selected date and time
      const [hours, minutes] = selectedTime.split(':').map(Number);
      const startTime = new Date(selectedDate);
      startTime.setHours(hours, minutes, 0, 0);

      const appointmentPayload = {
        title: data.title || "GHL Appointment",
        calendarId: data.calendarId,
        contactId: data.contactId,
        startTime: startTime.toISOString(),
        appointmentStatus: "confirmed",
        meetingLocationType: "custom",
        assignedUserId: data.assignedUserId || data.contactId, // Use assigned user or fallback to contact
        toNotify: true,
        ignoreFreeSlotValidation: true, // Allow booking at any time
      };

      console.log("Creating GHL appointment with payload:", appointmentPayload);

      const result = await ghlClient.createEvent(appointmentPayload);
      
      toast({ 
        title: "Success", 
        description: "Appointment created successfully!" 
      });
      
      onBookingConfirmed();
      onClose();
    } catch (error: any) {
      console.error("Error creating appointment:", error);

      // Extract GHL API error details if available
      let errorMessage = "Failed to create appointment";
      if (error.message) {
        // Check for specific GHL errors
        if (error.message.includes("The user id not part of calendar team")) {
          errorMessage = "The user is not part of the calendar team. Please select a different calendar or contact your administrator.";
        } else if (error.message.includes("Unprocessable Entity")) {
          errorMessage = "Unable to create appointment. Please check your selections and try again.";
        } else {
          errorMessage = error.message;
        }
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New GHL Appointment</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Calendar and Team Member - 2 Column Layout */}
          <div className="grid grid-cols-2 gap-4">
            {/* Calendar Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Calendar *
              </label>
              <Select
                onValueChange={(value) => setValue("calendarId", value)}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a calendar" />
                </SelectTrigger>
                <SelectContent>
                  {calendars.filter(cal => cal.isActive).map((calendar) => (
                    <SelectItem key={calendar.id} value={calendar.id}>
                      {calendar.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.calendarId && (
                <span className="text-red-500 text-sm">Calendar is required</span>
              )}
            </div>

            {/* Team Member Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Team Member
              </label>
              <Select
                onValueChange={(value) => setValue("assignedUserId", value)}
                disabled={loading || loadingTeamMembers}
              >
                <SelectTrigger>
                  <SelectValue placeholder={
                    loadingTeamMembers ? "Loading team members..." :
                    "Select a team member"
                  } />
                </SelectTrigger>
                <SelectContent>
                  {teamMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{member.name}</span>
                        {/* {member.email && (
                          <span className="text-xs text-gray-500">{member.email}</span>
                        )}
                        {member.phone && (
                          <span className="text-xs text-gray-400">{member.phone}</span>
                        )} */}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Title and Contact - 2 Column Layout */}
          <div className="grid grid-cols-2 gap-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Title
              </label>
              <Input
                {...register("title")}
                placeholder="Appointment title"
                disabled={loading}
              />
            </div>

            {/* Contact Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contact *
              </label>
              <Select
                onValueChange={(value) => setValue("contactId", value)}
                disabled={loading || loadingContacts}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingContacts ? "Loading contacts..." : "Select a contact"} />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map((contact) => {
                    const displayName = contact.contactName ||
                      (contact.firstName && contact.lastName ? `${contact.firstName} ${contact.lastName}` :
                       contact.firstName || contact.email || "Unnamed Contact");

                    return (
                      <SelectItem key={contact.id} value={contact.id}>
                        <span className="font-medium">{displayName}</span>
                        {contact.email && (
                          <span className="text-xs text-gray-500 block">{contact.email}</span>
                        )}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {errors.contactId && (
                <span className="text-red-500 text-sm">Contact is required</span>
              )}
            </div>
          </div>

          {/* Date and Time Selection */}
          <div className="space-y-4">
            {/* Date Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Appointment Date *
              </label>
              <Input
                type="date"
                value={selectedDate ? format(selectedDate, "yyyy-MM-dd") : ""}
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedDate(new Date(e.target.value));
                  } else {
                    setSelectedDate(undefined);
                  }
                }}
                min={format(new Date(), "yyyy-MM-dd")}
                disabled={loading}
                className="w-full"
              />
              {!selectedDate && (
                <span className="text-red-500 text-sm">Date is required</span>
              )}
            </div>

            {/* Time Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Appointment Time *
              </label>
              <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto border rounded-md p-3">
                {timeSlots.map((slot) => (
                  <button
                    key={slot.value}
                    type="button"
                    onClick={() => setSelectedTime(slot.value)}
                    className={cn(
                      "px-3 py-2 text-sm border rounded-md transition-colors text-center",
                      selectedTime === slot.value
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    )}
                    disabled={loading}
                  >
                    {slot.display}
                  </button>
                ))}
              </div>
              {!selectedTime && (
                <span className="text-red-500 text-sm">Please select a time</span>
              )}
            </div>
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
                      Creating...
                    </>
                  ) : (
                    "Create Appointment"
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