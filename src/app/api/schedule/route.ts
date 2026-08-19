import { NextResponse } from 'next/server';
import Papa from 'papaparse';
import { SHEET_LINKS, cleanText, normalizeHallId } from '@/lib/scheduleEngine';
import { ScheduleEvent } from '@/lib/types';

// This tells Next.js to keep this data fresh for 60 seconds.
export const revalidate = 60; 

export async function GET() {
  try {
    const appData: Record<string, { title: string; events: ScheduleEvent[] }> = {};
    const globalQuizzes: ScheduleEvent[] = [];

    // Fetch all sheets in parallel to make it extremely fast
    const fetchPromises = Object.entries(SHEET_LINKS).map(async ([key, link]) => {
      const res = await fetch(link);
      if (!res.ok) return;
      const csvText = await res.text();
      const parsed = Papa.parse(csvText, { header: false, skipEmptyLines: true }).data as string[][];

      if (key === 'quizzes') {
        let colOffset = 0;
        if (parsed.length > 1 && (/^\d{1,4}$/.test(cleanText(parsed[1][0])) || cleanText(parsed[1][0]).includes('/'))) {
          colOffset = 1;
        }
        parsed.forEach((r, idx) => {
          if (idx === 0 || !r || r.length < 3) return;
          const rawTitle = cleanText(r[2 + colOffset]);
          if (!rawTitle || rawTitle.toLowerCase() === 'question' || rawTitle.toLowerCase() === 'title') return;

          globalQuizzes.push({
            id: `quiz_${idx}`,
            type: 'quiz',
            hall_id: normalizeHallId(r[0 + colOffset]),
            parent_session: cleanText(r[1 + colOffset]) || 'General',
            title: rawTitle,
            options: [cleanText(r[3 + colOffset]), cleanText(r[4 + colOffset]), cleanText(r[5 + colOffset]), cleanText(r[6 + colOffset])].filter(Boolean),
            correct: cleanText(r[7 + colOffset]),
            time: '', display_time: '', speaker: '' // placeholders for quiz
          });
        });
      } else {
        // Just store the raw parsed rows for now to keep it simple, 
        // the frontend will parse them into events using our engine
        appData[key] = { title: key, events: parsed as any }; 
      }
    });

    await Promise.all(fetchPromises);

    return NextResponse.json({ halls: appData, quizzes: globalQuizzes });
  } catch (error) {
    console.error("Failed to fetch schedule from Google Sheets:", error);
    return NextResponse.json({ error: "Failed to fetch schedule" }, { status: 500 });
  }
}
