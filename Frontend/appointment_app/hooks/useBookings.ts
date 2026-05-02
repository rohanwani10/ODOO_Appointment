import { useState, useEffect, useCallback } from 'react';
import { Booking } from '@/types/booking';
import { apiFetch } from '@/lib/api';

export function useBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBookings = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await apiFetch<Booking[]>('/api/appointments');
      setBookings(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch bookings');
      console.error('Failed to fetch bookings', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  return { bookings, isLoading, error, refetch: fetchBookings };
}
