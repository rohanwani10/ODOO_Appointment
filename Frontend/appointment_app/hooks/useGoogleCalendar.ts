import { useCallback, useState } from "react";
import { apiFetch } from "@/lib/api";

export interface Calendar {
    id: string;
    summary: string;
    description?: string;
    timeZone?: string;
    primary?: boolean;
}

export function useGoogleCalendar() {
    const [calendars, setCalendars] = useState<Calendar[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const getCalendarList = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await apiFetch<{
                items: Calendar[];
            }>("/api/auth/google/calendar/list");

            setCalendars(response.items || []);
            return response.items || [];
        } catch (err) {
            const errorMessage =
                err instanceof Error
                    ? err.message
                    : "Failed to fetch calendars";
            setError(errorMessage);
            console.error("Get calendar list error:", err);
            return [];
        } finally {
            setIsLoading(false);
        }
    }, []);

    const createEvent = useCallback(
        async (eventData: {
            title: string;
            description?: string;
            start_time: string;
            end_time: string;
            attendees?: Array<{ email: string }>;
            meet_enabled?: boolean;
        }) => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await apiFetch<{
                    success: boolean;
                    event_id: string;
                    event_url: string;
                    meet_link?: string;
                    created_at: string;
                }>("/api/auth/google/calendar/event", {
                    method: "POST",
                    body: JSON.stringify(eventData),
                });

                if (!response.success) {
                    throw new Error("Failed to create calendar event");
                }

                return response;
            } catch (err) {
                const errorMessage =
                    err instanceof Error
                        ? err.message
                        : "Failed to create calendar event";
                setError(errorMessage);
                console.error("Create event error:", err);
                throw err;
            } finally {
                setIsLoading(false);
            }
        },
        []
    );

    const getMeetLink = useCallback(async (eventId: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await apiFetch<{
                meet_link: string;
            }>(`/api/auth/google/meet/${eventId}`);

            return response.meet_link;
        } catch (err) {
            const errorMessage =
                err instanceof Error ? err.message : "Failed to get Meet link";
            setError(errorMessage);
            console.error("Get Meet link error:", err);
            return null;
        } finally {
            setIsLoading(false);
        }
    }, []);

    return {
        calendars,
        isLoading,
        error,
        getCalendarList,
        createEvent,
        getMeetLink,
    };
}
