"use client";

import { useEffect, useState } from "react";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import { useAuth } from "@/hooks/useAuth";

interface Event {
  title: string;
  start: string;
  end: string;
  description?: string;
  attendees?: Array<{ email: string }>;
  includeGoogleMeet?: boolean;
}

export function GoogleCalendarDashboard() {
  const { user, isLoading: userLoading } = useAuth();
  const { calendars, isLoading, error, getCalendarList, createEvent } =
    useGoogleCalendar();
  const [events, setEvents] = useState<Event[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    date: "",
    startTime: "",
    endTime: "",
    attendees: "",
    includeGoogleMeet: true,
  });

  // Load calendars on component mount
  useEffect(() => {
    if (!userLoading && user) {
      getCalendarList();
    }
  }, [user, userLoading, getCalendarList]);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const startDateTime = new Date(
        `${formData.date}T${formData.startTime}`,
      ).toISOString();
      const endDateTime = new Date(
        `${formData.date}T${formData.endTime}`,
      ).toISOString();

      const attendeesList = formData.attendees
        .split(",")
        .map((email) => ({ email: email.trim() }))
        .filter((item) => item.email);

      const result = await createEvent({
        title: formData.title,
        description: formData.description,
        start_time: startDateTime,
        end_time: endDateTime,
        attendees: attendeesList,
        meet_enabled: formData.includeGoogleMeet,
      });

      // Add to local state
      setEvents([
        ...events,
        {
          title: formData.title,
          start: startDateTime,
          end: endDateTime,
          description: formData.description,
          attendees: attendeesList,
        },
      ]);

      // Reset form
      setFormData({
        title: "",
        description: "",
        date: "",
        startTime: "",
        endTime: "",
        attendees: "",
        includeGoogleMeet: true,
      });
      setShowForm(false);

      // Show success message
      alert(
        `Event created successfully!${result.meet_link ? `\n\nGoogle Meet Link: ${result.meet_link}` : ""}`,
      );
    } catch (err) {
      alert(
        `Failed to create event: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    }
  };

  if (userLoading) {
    return <div className="p-4">Loading...</div>;
  }

  if (!user) {
    return <div className="p-4">Please log in first</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Google Calendar Integration</h1>

      {/* Connected Calendars */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Your Calendars</h2>
        {isLoading ? (
          <p className="text-gray-600">Loading calendars...</p>
        ) : error ? (
          <div className="bg-red-50 p-4 rounded border border-red-200">
            <p className="text-red-800">{error}</p>
          </div>
        ) : calendars.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {calendars.map((cal) => (
              <div
                key={cal.id}
                className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
              >
                <h3 className="font-semibold">{cal.summary}</h3>
                {cal.description && (
                  <p className="text-gray-600 text-sm mt-1">
                    {cal.description}
                  </p>
                )}
                {cal.primary && (
                  <span className="inline-block mt-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                    Primary Calendar
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600">No calendars found</p>
        )}
      </div>

      {/* Create Event Section */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Create Event</h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {showForm ? "Cancel" : "New Event"}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleCreateEvent} className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Event Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                required
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Meeting title"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={3}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Event description"
              />
            </div>

            {/* Date and Time */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Date *</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) =>
                    setFormData({ ...formData, date: e.target.value })
                  }
                  required
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Start Time *
                </label>
                <input
                  type="time"
                  value={formData.startTime}
                  onChange={(e) =>
                    setFormData({ ...formData, startTime: e.target.value })
                  }
                  required
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  End Time *
                </label>
                <input
                  type="time"
                  value={formData.endTime}
                  onChange={(e) =>
                    setFormData({ ...formData, endTime: e.target.value })
                  }
                  required
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Attendees */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Attendees (comma-separated emails)
              </label>
              <input
                type="text"
                value={formData.attendees}
                onChange={(e) =>
                  setFormData({ ...formData, attendees: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="john@example.com, jane@example.com"
              />
            </div>

            {/* Google Meet */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="googleMeet"
                checked={formData.includeGoogleMeet}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    includeGoogleMeet: e.target.checked,
                  })
                }
                className="w-4 h-4 rounded"
              />
              <label htmlFor="googleMeet" className="ml-2 text-sm">
                Include Google Meet
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {isLoading ? "Creating..." : "Create Event"}
            </button>
          </form>
        )}
      </div>

      {/* Recent Events */}
      {events.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Recent Events</h2>
          <div className="space-y-4">
            {events.map((event, index) => (
              <div
                key={index}
                className="p-4 border rounded-lg hover:bg-gray-50"
              >
                <h3 className="font-semibold">{event.title}</h3>
                {event.description && (
                  <p className="text-gray-600 text-sm mt-1">
                    {event.description}
                  </p>
                )}
                <p className="text-sm text-gray-500 mt-2">
                  {new Date(event.start).toLocaleString()} -{" "}
                  {new Date(event.end).toLocaleTimeString()}
                </p>
                {event.attendees && event.attendees.length > 0 && (
                  <p className="text-sm text-gray-600 mt-2">
                    Attendees: {event.attendees.map((a) => a.email).join(", ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
