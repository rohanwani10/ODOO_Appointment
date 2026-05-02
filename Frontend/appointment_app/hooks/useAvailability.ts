import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

export function useAvailability() {
  const [availability, setAvailability] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchAvailability() {
      try {
        const data = await apiFetch('/api/services/availability');
        setAvailability(data);
      } catch (error) {
        console.error('Failed to fetch availability', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchAvailability();
  }, []);

  return { availability, isLoading };
}
