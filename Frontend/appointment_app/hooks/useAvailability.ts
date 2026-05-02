import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';

export interface AvailableSlot {
  start_time: string;
  end_time: string;
  resource_id: number;
  resource_name: string;
  available_capacity: number;
}

export function useAvailability(serviceId: number | null, date: string | null) {
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSlots = useCallback(async () => {
    if (!serviceId || !date) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await apiFetch<AvailableSlot[]>(
        `/api/services/${serviceId}/availability`,
        { params: { date } }
      );
      setSlots(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch availability');
      setSlots([]);
    } finally {
      setIsLoading(false);
    }
  }, [serviceId, date]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  return { slots, isLoading, error, refetch: fetchSlots };
}
