import { useState, useEffect, useRef } from 'react';
import { getEventBus, EventType } from '../../core/EventBus';

export function useAutoRefresh(
  eventTypes: EventType[],
  loadData: () => Promise<void>,
  debounceMs: number = 500
) {
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  const refreshTimerRef = useRef<NodeJS.Timeout>();
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    const subscription = getEventBus().subscribeMany(eventTypes, async () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }

      refreshTimerRef.current = setTimeout(async () => {
        if (!isMountedRef.current) return;

        setIsAutoRefreshing(true);
        try {
          await loadData();
        } catch (error) {
          console.error('Auto-refresh error:', error);
        } finally {
          if (isMountedRef.current) {
            setIsAutoRefreshing(false);
          }
        }
      }, debounceMs);
    });

    return () => {
      isMountedRef.current = false;
      subscription.unsubscribe();
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, [eventTypes, loadData, debounceMs]);

  return { isAutoRefreshing };
}
