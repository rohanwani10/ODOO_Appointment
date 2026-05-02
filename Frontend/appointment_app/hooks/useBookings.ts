import { useState, useEffect } from 'react';
import { Booking } from '@/types/booking';
import { apiFetch } from '@/lib/api';

export function useBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchBookings() {
      try {
        const data = await apiFetch<Booking[]>('/api/appointments');
        setBookings(data);
      } catch (error) {
        console.error('Failed to fetch bookings', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchBookings();
  }, []);

  return { bookings, isLoading };
}
