"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Icon } from "@/components/ui/icons";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useCalendar } from "@/hooks/use-calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AppointmentToolDetailsProps {
  toolId: string;
}

interface AppointmentType {
  name?: string;
  duration?: number;
  title?: string;
  lengthInMinutes?: number;
  slug?: string;
  eventId?: string;
  description?: string;
}

interface BusinessHours {
  monday: { enabled: boolean; start: string; end: string };
  tuesday: { enabled: boolean; start: string; end: string };
  wednesday: { enabled: boolean; start: string; end: string };
  thursday: { enabled: boolean; start: string; end: string };
  friday: { enabled: boolean; start: string; end: string };
  saturday: { enabled: boolean; start: string; end: string };
  sunday: { enabled: boolean; start: string; end: string };
}

interface AppointmentTool {
  id: string;
  name: string;
  description?: string;
  calendar_account_id?: string;
  calendar_email?: string;
  ghl_calendar_id?: string;
  staffid_ghl?: string;
  business_hours: BusinessHours;
  appointment_types: AppointmentType[];
  prompt_template: string;
  appointment_duration: number;
  created_at: string;
  is_calcom?: boolean;
  is_ghl?: boolean;
}

export function AppointmentToolDetails({
  toolId,
}: AppointmentToolDetailsProps) {
  const { toast } = useToast();
  const [tool, setTool] = useState<AppointmentTool | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("general");
  const [editMode, setEditMode] = useState(false);
  const [localTool, setLocalTool] = useState<Partial<AppointmentTool> | null>(
    null
  );
  const { calendarAccounts } = useCalendar();

  useEffect(() => {
    fetchTool();
  }, [toolId]);

  const fetchTool = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("appointment_tools")
        .select("*")
        .eq("id", toolId)
        .single();

      if (error) throw error;

      // Parse the JSON strings
      const parsedData = {
        ...data,
        appointment_types:
          typeof data.appointment_types === "string"
            ? JSON.parse(data.appointment_types)
            : data.appointment_types,
        business_hours:
          typeof data.business_hours === "string"
            ? JSON.parse(data.business_hours)
            : data.business_hours,
      };

      setTool(parsedData);
      setLocalTool(parsedData);
    } catch (error) {
      console.error("Error fetching appointment tool:", error);
      toast({
        title: "Error",
        description: "Failed to load appointment tool details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (field: string, value: any) => {
    setLocalTool((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleBusinessHoursChange = (
    day: string,
    updates: Partial<{ enabled: boolean; start: string; end: string }>
  ) => {
    if (!localTool || !localTool.business_hours) return;

    const updatedBusinessHours = JSON.parse(
      JSON.stringify(localTool.business_hours)
    );

    updatedBusinessHours[day] = {
      ...updatedBusinessHours[day],
      ...updates,
    };

    setLocalTool({
      ...localTool,
      business_hours: updatedBusinessHours as BusinessHours,
    });
  };

  const handleAppointmentTypeChange = (
    index: number,
    field: keyof AppointmentType,
    value: string | number
  ) => {
    if (!localTool || !localTool.appointment_types) return;

    // Create a safe copy
    const updatedTypes = JSON.parse(
      JSON.stringify(localTool.appointment_types)
    );

    // Update the specific type
    updatedTypes[index] = {
      ...updatedTypes[index],
      [field]: value,
    };

    // Update the state with type assertion
    setLocalTool({
      ...localTool,
      appointment_types: updatedTypes as AppointmentType[],
    });
  };

  const handleAddAppointmentType = () => {
    if (!localTool) return;

    const updatedTypes = localTool.appointment_types
      ? [...localTool.appointment_types, { name: "New Type", duration: 30 }]
      : [{ name: "New Type", duration: 30 }];

    setLocalTool({
      ...localTool,
      appointment_types: updatedTypes as AppointmentType[],
    });
  };

  const handleRemoveAppointmentType = (index: number) => {
    if (!localTool || !localTool.appointment_types) return;

    const updatedTypes = localTool.appointment_types.filter(
      (_, i) => i !== index
    );

    setLocalTool({
      ...localTool,
      appointment_types: updatedTypes,
    });
  };

  const handleSave = async () => {
    if (!localTool) return;

    try {
      setLoading(true);

      const { error } = await supabase
        .from("appointment_tools")
        .update({
          name: localTool.name,
          description: localTool.description,
          calendar_account_id: localTool.calendar_account_id,
          calendar_email: localTool.calendar_email,
          business_hours: localTool.business_hours,
          appointment_types: localTool.appointment_types,
          prompt_template: localTool.prompt_template,
        })
        .eq("id", toolId);

      if (error) throw error;

      setTool(localTool as AppointmentTool);
      setEditMode(false);

      toast({
        title: "Success",
        description: "Changes saved successfully",
      });
    } catch (error) {
      console.error("Error saving changes:", error);
      toast({
        title: "Error",
        description: "Failed to save changes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <Skeleton className="h-[200px]" />
          <Skeleton className="h-[200px]" />
        </div>
      </div>
    );
  }

  if (!tool) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="text-center">
          <Icon
            name="alertTriangle"
            className="h-12 w-12 text-amber-500 mx-auto mb-4"
          />
          <h3 className="text-lg font-medium">Appointment Tool Not Found</h3>
          <p className="text-muted-foreground mt-2">
            The appointment tool you're looking for doesn't exist or has been
            deleted.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 h-full overflow-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-primary/10 p-2 rounded-lg">
              <Icon name="calendar" className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">{tool.name}</h1>
          </div>
          <p className="text-muted-foreground">
            {tool.description || "No description provided"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {editMode ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setLocalTool(tool);
                  setEditMode(false);
                }}
                size="lg"
              >
                Cancel
              </Button>

              <Button
                onClick={handleSave}
                disabled={saving}
                size="lg"
                className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary"
              >
                {saving ? (
                  <>
                    <Icon name="loader" className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Icon name="save" className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button
              onClick={() => setEditMode(true)}
              size="lg"
              className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary flex items-center gap-2"
            >
              <Icon name="pencil" className="h-4 w-4" />
              Edit Tool
            </Button>
          )}
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-8"
      >
        <TabsList className="bg-background p-1 border border-border rounded-lg w-full max-w-2xl mx-auto">
          <TabsTrigger value="general" className="flex-1 py-3">
            <div className="flex items-center justify-center gap-2">
              <Icon name="settings" className="h-4 w-4" />
              General
            </div>
          </TabsTrigger>
          <TabsTrigger value="business-hours" className="flex-1 py-3">
            <div className="flex items-center justify-center gap-2">
              <Icon name="clock" className="h-4 w-4" />
              Business Hours
            </div>
          </TabsTrigger>
          <TabsTrigger value="appointment-types" className="flex-1 py-3">
            <div className="flex items-center justify-center gap-2">
              <Icon name="calendar" className="h-4 w-4" />
              Appointment Types
            </div>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon name="settings" className="h-5 w-5 text-primary" />
                General Settings
              </CardTitle>
              <CardDescription>
                Configure your appointment tool settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Tool Name</Label>
                {editMode ? (
                  <Input
                    id="name"
                    value={localTool?.name || ""}
                    onChange={(e) => handleFieldChange("name", e.target.value)}
                  />
                ) : (
                  <p className="text-foreground">{localTool?.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                {editMode ? (
                  <Textarea
                    id="description"
                    value={localTool?.description || ""}
                    onChange={(e) =>
                      handleFieldChange("description", e.target.value)
                    }
                    className="min-h-[100px]"
                  />
                ) : (
                  <p className="text-foreground">
                    {localTool?.description || "No description provided"}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                {localTool?.is_calcom ? (
                  <Label>Cal.com Account</Label>
                ) : localTool?.is_ghl ? (
                  <Label>GHL Calendar ID</Label>
                ) : (
                  <Label>Calendar Account</Label>
                )}
                {editMode && !localTool?.is_calcom && !localTool?.is_ghl ? (
                  <div className="flex items-center gap-3">
                    <Icon name="mail" className="h-5 w-5 text-primary" />
                    <Select
                      value={localTool?.calendar_account_id || ""}
                      onValueChange={(value) => {
                        const selectedAccount = calendarAccounts.find(
                          (acc) => acc.id === value
                        );
                        handleFieldChange("calendar_account_id", value);
                        handleFieldChange(
                          "calendar_email",
                          selectedAccount?.calendar_email || ""
                        );
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a calendar account" />
                      </SelectTrigger>
                      <SelectContent>
                        {calendarAccounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.calendar_email}
                          </SelectItem>
                        ))}
                        {calendarAccounts.length === 0 && (
                          <SelectItem value="" disabled>
                            No calendar accounts connected
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    {localTool?.is_calcom ? (
                      <p className="text-foreground"></p>
                    ) : localTool?.is_ghl ? (
                      <>
                        <Icon name="calendar" className="h-5 w-5 text-green-600" />
                        <p className="text-foreground">
                          {localTool?.ghl_calendar_id || "No GHL calendar ID"}
                        </p>
                      </>
                    ) : (
                      <>
                        <Icon name="mail" className="h-5 w-5 text-primary" />
                        <p className="text-foreground">
                          {localTool?.calendar_email ||
                            "No calendar account selected"}
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="business-hours" className="space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon name="clock" className="h-5 w-5 text-primary" />
                Business Hours
              </CardTitle>
              <CardDescription>
                {tool?.is_ghl ? (
                  <>
                    Business hours are managed by your GoHighLevel calendar.{" "}
                    <span className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 cursor-pointer">
                      Please update them in your GHL dashboard.
                    </span>
                  </>
                ) : (
                  "Set your availability for appointments"
                )}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {editMode && !tool?.is_ghl ? (
                <div className="space-y-4 max-w-3xl">
                  {Object.entries(localTool?.business_hours || {}).map(
                    ([day, hours]) => (
                      <div
                        key={day}
                        className="flex items-center space-x-4 p-4 rounded-lg bg-muted border border-border"
                      >
                        <div className="w-40 flex items-center space-x-3">
                          <Switch
                            checked={hours.enabled}
                            onCheckedChange={() =>
                              handleBusinessHoursChange(day, {
                                enabled: !hours.enabled,
                              })
                            }
                          />
                          <span className="text-sm font-medium capitalize">
                            {day}
                          </span>
                        </div>

                        {hours.enabled ? (
                          <div className="flex items-center space-x-2 flex-1">
                            <Input
                              type="time"
                              value={hours.start}
                              onChange={(e) =>
                                handleBusinessHoursChange(day, {
                                  start: e.target.value,
                                })
                              }
                              className="w-32"
                            />
                            <span>-</span>
                            <Input
                              type="time"
                              value={hours.end}
                              onChange={(e) =>
                                handleBusinessHoursChange(day, {
                                  end: e.target.value,
                                })
                              }
                              className="w-32"
                            />
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Closed</span>
                        )}
                      </div>
                    )
                  )}
                </div>
              ) : (
                <div className="space-y-4 max-w-3xl">
                  {Object.entries(tool.business_hours).map(([day, hours]) => (
                    <div
                      key={day}
                      className="flex items-center space-x-4 p-4 rounded-lg bg-muted border border-border"
                    >
                      <div className="w-40">
                        <span className="text-sm font-medium capitalize">
                          {day}
                        </span>
                      </div>

                      {hours.enabled ? (
                        <div className="flex items-center space-x-2">
                          <Badge
                            variant="outline"
                            className="text-sm font-normal py-1 px-3"
                          >
                            {hours.start} - {hours.end}
                          </Badge>
                        </div>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="text-sm font-normal py-1 px-3"
                        >
                          Closed
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appointment-types" className="space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Icon name="calendar" className="h-5 w-5 text-primary" />
                  Appointment Types
                </CardTitle>
                <CardDescription className="my-2">
                  {tool?.is_calcom
                    ? "Event types are managed from your Cal.com dashboard"
                    : tool?.is_ghl
                    ? "Appointment types are managed by your GoHighLevel calendar settings"
                    : "Define the types of appointments customers can book"}
                </CardDescription>
              </div>

              {editMode && !tool?.is_calcom && !tool?.is_ghl && (
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleAddAppointmentType}
                  className="flex items-center gap-2"
                >
                  <Icon name="plus" className="h-4 w-4" />
                  Add Type
                </Button>
              )}
            </CardHeader>

            <CardContent>
              {tool?.is_calcom ? (
                // Cal.com event types - read-only with dashboard link
                <div className="space-y-4">
                  {editMode && (
                    <div className="">
                      <div className="flex items-start gap-3">
                        <Icon
                          name="info"
                          className="h-5 w-5 text-muted-foreground mt-0.5"
                        />
                        <div className="flex-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              window.open(
                                "https://app.cal.com/event-types",
                                "_blank"
                              )
                            }
                            className="flex items-center gap-2 bg-background border-border text-foreground hover:bg-accent"
                          >
                            <Icon name="external-link" className="h-4 w-4" />
                            Update from Cal.com Dashboard
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(tool?.appointment_types || []).map((type, index) => (
                      <Card
                        key={index}
                        className="border border-border shadow-sm hover:shadow-md transition-shadow"
                      >
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">
                              {tool?.is_calcom ? type.name : type.name}
                            </CardTitle>
                            <Badge className="bg-primary/10 text-primary hover:bg-primary/20">
                              {tool?.is_calcom ? type.duration : type.duration}{" "}
                              min
                            </Badge>
                          </div>
                          {type.eventId && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Event ID: {type.eventId}
                            </div>
                          )}
                        </CardHeader>
                      </Card>
                    ))}
                    {(!tool?.appointment_types ||
                      tool.appointment_types.length === 0) && (
                      <div className="col-span-full text-center py-8">
                        <div className="bg-muted rounded-lg p-6 border border-border">
                          <Icon
                            name="calendar"
                            className="h-8 w-8 text-muted-foreground mx-auto mb-3"
                          />
                          <h3 className="text-sm font-medium text-foreground mb-1">
                            No Event Types Found
                          </h3>
                          <p className="text-sm text-muted-foreground mb-4">
                            Create event types from your Cal.com dashboard
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              window.open(
                                "https://app.cal.com/event-types",
                                "_blank"
                              )
                            }
                            className="flex items-center gap-2"
                          >
                            <Icon name="external-link" className="h-4 w-4" />
                            Go to Cal.com Dashboard
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : tool?.is_ghl ? (
                // GHL appointment types - read-only, managed by GHL calendar
                <div className="space-y-4">
                  {editMode && (
                    <div className="">
                      <div className="flex items-start gap-3">
                        <Icon
                          name="info"
                          className="h-5 w-5 text-muted-foreground mt-0.5"
                        />
                        <div className="flex-1">
                          {/* <p className="text-sm text-gray-600 mb-3">
                            Appointment types are managed by your GoHighLevel calendar settings.
                            Changes should be made in your GHL dashboard.
                          </p> */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              window.open(
                                "https://app.gohighlevel.com/",
                                "_blank"
                              )
                            }
                            className="flex items-center gap-2 bg-background border-border text-foreground hover:bg-accent"
                          >
                            <Icon name="external-link" className="h-4 w-4" />
                            Open GHL Dashboard
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(tool?.appointment_types || []).map((type, index) => (
                      <Card
                        key={index}
                        className="border border-border shadow-sm hover:shadow-md transition-shadow"
                      >
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">
                              {type.name}
                            </CardTitle>
                            <Badge className="bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/30">
                              {type.duration} min
                            </Badge>
                          </div>
                          {type.description && (
                            <CardDescription className="text-xs text-muted-foreground mt-1">
                              {type.description}
                            </CardDescription>
                          )}
                        </CardHeader>
                      </Card>
                    ))}
                    {(!tool?.appointment_types ||
                      tool.appointment_types.length === 0) && (
                      <div className="col-span-full text-center py-8">
                        <div className="bg-muted rounded-lg p-6 border border-border">
                          <Icon
                            name="calendar"
                            className="h-8 w-8 text-muted-foreground mx-auto mb-3"
                          />
                          <h3 className="text-sm font-medium text-foreground mb-1">
                            No Appointment Types Found
                          </h3>
                          <p className="text-sm text-muted-foreground mb-4">
                            Configure appointment types in your GHL calendar settings
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              window.open(
                                "https://app.gohighlevel.com/",
                                "_blank"
                              )
                            }
                            className="flex items-center gap-2"
                          >
                            <Icon name="external-link" className="h-4 w-4" />
                            Go to GHL Dashboard
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                // Google Calendar appointment types - editable
                <>
                  {editMode ? (
                    <div className="space-y-4">
                      {(localTool?.appointment_types || []).map(
                        (type, index) => (
                          <Card
                            key={index}
                            className="border border-border shadow-sm"
                          >
                            <CardContent className="pt-6 pb-4">
                              <div className="flex items-start justify-between mb-4">
                                <div className="flex-1 space-y-6">
                                  <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                      <Label htmlFor={`type-name-${index}`}>
                                        Name
                                      </Label>
                                      <Input
                                        id={`type-name-${index}`}
                                        value={type.name || ""}
                                        onChange={(e) =>
                                          handleAppointmentTypeChange(
                                            index,
                                            "name",
                                            e.target.value
                                          )
                                        }
                                      />
                                    </div>

                                    <div className="space-y-2">
                                      <Label htmlFor={`type-duration-${index}`}>
                                        Duration (minutes)
                                      </Label>
                                      <Input
                                        id={`type-duration-${index}`}
                                        type="number"
                                        value={type.duration || 30}
                                        onChange={(e) =>
                                          handleAppointmentTypeChange(
                                            index,
                                            "duration",
                                            parseInt(e.target.value)
                                          )
                                        }
                                        min={5}
                                        step={5}
                                      />
                                    </div>
                                  </div>
                                </div>

                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() =>
                                    handleRemoveAppointmentType(index)
                                  }
                                  disabled={
                                    !localTool?.appointment_types ||
                                    localTool.appointment_types.length <= 1
                                  }
                                  className="text-muted-foreground hover:text-red-500"
                                >
                                  <Icon name="trash" className="h-4 w-4" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        )
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {(tool?.appointment_types || []).map((type, index) => (
                        <Card
                          key={index}
                          className="border border-border shadow-sm hover:shadow-md transition-shadow"
                        >
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-base">
                                {type.name}
                              </CardTitle>
                              <Badge className="bg-primary/10 text-primary hover:bg-primary/20">
                                {type.duration} min
                              </Badge>
                            </div>
                          </CardHeader>
                        </Card>
                      ))}
                      {(!tool?.appointment_types ||
                        tool.appointment_types.length === 0) && (
                        <div className="col-span-full text-center py-8">
                          <div className="bg-muted rounded-lg p-6 border border-border">
                            <Icon
                              name="calendar"
                              className="h-8 w-8 text-muted-foreground mx-auto mb-3"
                            />
                            <h3 className="text-sm font-medium text-foreground mb-1">
                              No Appointment Types
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              Click edit to add your first appointment type
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
