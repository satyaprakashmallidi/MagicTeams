"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GHLCalendarView } from "@/components/ghl-calendar/ghl-calendar-view";
import { useGHLCalendar } from "@/hooks/use-ghl-calendar";
import { Icon } from "@/components/ui/icons";
import { ghlClient } from "@/lib/ghl-client";
import { GHLContact } from "@/lib/types";

export default function GHLCalendarPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"calendar" | "contacts">("calendar");
  const [contacts, setContacts] = useState<GHLContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactsError, setContactsError] = useState<string | null>(null);

  const { connection, isLoadingConnection, connectGHL, disconnectGHL } = useGHLCalendar();

  const fetchContacts = async () => {
    setLoadingContacts(true);
    setContactsError(null);

    try {
      const contacts = await ghlClient.getAllContacts();
      setContacts(contacts);
    } catch (error) {
      console.error("Error fetching GHL contacts:", error);
      setContactsError(
        error instanceof Error ? error.message : "Failed to fetch contacts"
      );
    } finally {
      setLoadingContacts(false);
    }
  };

  // Load contacts when connected and contacts tab is active
  useEffect(() => {
    if (connection.isConnected && activeTab === "contacts" && contacts.length === 0) {
      fetchContacts();
    }
  }, [connection.isConnected, activeTab]);

  // Handle URL parameters for success/error messages
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const disconnected = urlParams.get('disconnected');
    const error = urlParams.get('error');

    if (disconnected === 'true') {
      // Clean up the URL
      window.history.replaceState({}, '', window.location.pathname);
    }

    if (error === 'disconnect_failed') {
      // Clean up the URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  if (isLoadingConnection) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <Icon name="loader2" className="h-8 w-8 animate-spin text-blue-600 mb-4" />
        <h2 className="text-xl font-medium">Checking GHL connection...</h2>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header with Tabs */}
      <div className="bg-gradient-to-r from-white to-gray-50 border-b border-gray-200 shadow-sm">
        <div className="max-w-[1800px] mx-auto">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  onClick={() => router.push('/dashboard/calendar')}
                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
                >
                  <Icon name="arrow-left" className="h-4 w-4" />
                  Back to Calendars
                </Button>
                <div className="h-6 w-px bg-border" />
                <h1 className="text-2xl font-bold text-foreground">GoHighLevel Integration</h1>
              </div>
              {connection.isConnected && (
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg">
                    <Icon name="check-circle" className="w-4 h-4" />
                    <span className="text-sm font-medium">Connected to GHL</span>
                  </div>
                  <Button
                    variant="outline"
                    onClick={disconnectGHL}
                    className="text-sm"
                  >
                    Disconnect
                  </Button>
                </div>
              )}
            </div>

            {/* Tab Navigation */}
            {connection.isConnected && (
              <div className="flex space-x-1">
                <button
                  onClick={() => setActiveTab("calendar")}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === "calendar"
                      ? "bg-blue-100 text-blue-700"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon name="calendar" className="w-4 h-4" />
                    Calendar
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab("contacts")}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === "contacts"
                      ? "bg-blue-100 text-blue-700"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon name="users" className="w-4 h-4" />
                    Contacts ({contacts.length})
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1">
        {activeTab === "calendar" ? (
          <GHLCalendarView
            isConnected={connection.isConnected}
            onConnect={connectGHL}
          />
        ) : (
          <div className="p-6">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">GHL Contacts</h2>
                <Button onClick={fetchContacts} disabled={loadingContacts}>
                  {loadingContacts ? (
                    <>
                      <Icon name="loader2" className="w-4 h-4 animate-spin mr-2" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <Icon name="refresh-cw" className="w-4 h-4 mr-2" />
                      Refresh Contacts
                    </>
                  )}
                </Button>
              </div>

              {loadingContacts ? (
                <div className="py-8 text-center">
                  <Icon name="loader2" className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
                  <p>Loading contacts...</p>
                </div>
              ) : contactsError ? (
                <div className="py-4 text-red-500">
                  <p>Error: {contactsError}</p>
                  <Button
                    variant="outline"
                    className="mt-2"
                    onClick={fetchContacts}
                  >
                    Try Again
                  </Button>
                </div>
              ) : contacts.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {contacts.map((contact, index) => {
                    const name =
                      contact.contactName ||
                      (contact.firstName && contact.lastName
                        ? `${contact.firstName} ${contact.lastName}`
                        : contact.firstName || "No Name");

                    return (
                      <div
                        key={contact.id || index}
                        className="border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
                      >
                        <div className="font-semibold text-lg mb-2">{name}</div>
                        {contact.type && (
                          <div className="text-xs font-medium bg-gray-100 text-gray-800 px-2 py-0.5 rounded inline-block mb-2">
                            {contact.type.toUpperCase()}
                          </div>
                        )}
                        {contact.email && (
                          <div className="flex items-center gap-2 text-gray-700 mb-1">
                            <Icon name="mail" className="w-4 h-4" />
                            <span className="text-sm">{contact.email}</span>
                          </div>
                        )}
                        {contact.phone && (
                          <div className="flex items-center gap-2 text-gray-700 mb-1">
                            <Icon name="phone" className="w-4 h-4" />
                            <span className="text-sm">{contact.phone}</span>
                          </div>
                        )}
                        {(contact.city || contact.state || contact.country) && (
                          <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
                            <Icon name="map-pin" className="w-4 h-4" />
                            <span>
                              {[contact.city, contact.state, contact.country]
                                .filter(Boolean)
                                .join(", ")}
                            </span>
                          </div>
                        )}
                        {contact.dateAdded && (
                          <div className="text-gray-500 text-xs mb-2">
                            Added:{" "}
                            {new Date(contact.dateAdded).toLocaleDateString()}
                          </div>
                        )}
                        {contact.tags && contact.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {contact.tags.slice(0, 3).map((tag, i) => (
                              <span
                                key={`${tag}-${i}`}
                                className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs"
                              >
                                {tag}
                              </span>
                            ))}
                            {contact.tags.length > 3 && (
                              <span className="text-xs text-gray-500">
                                +{contact.tags.length - 3} more
                              </span>
                            )}
                          </div>
                        )}
                        {contact.source && (
                          <div className="text-xs text-green-700">
                            Source: {contact.source}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-gray-500">
                  <Icon name="users" className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p>No contacts found.</p>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}