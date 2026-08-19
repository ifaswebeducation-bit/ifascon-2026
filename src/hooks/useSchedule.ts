'use client';

import { useEffect, useState } from 'react';
import { ScheduleEvent } from '@/lib/types';
import { parseRawData } from '@/lib/scheduleEngine'; // We will add this to scheduleEngine next!

export function useSchedule() {
  const [appData, setAppData] = useState<Record<string, { title: string; events: ScheduleEvent[] }>>({});
  const [globalQuizzes, setGlobalQuizzes] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/schedule');
        const data = await res.json();
        
        // We will do the final parsing of the raw arrays here on the client
        // to save server bandwidth. We will add parseRawData to scheduleEngine.ts soon.
        setAppData(data.halls);
        setGlobalQuizzes(data.quizzes);
      } catch (e) {
        console.error("Could not load schedule", e);
      } finally {
        setLoading(false);
      }
    }
    
    load();
    
    // Auto-refresh the data every 60 seconds silently in the background
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  return { appData, globalQuizzes, loading };
}
