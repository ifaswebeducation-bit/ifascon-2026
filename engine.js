// ==============================================
// CORE DATA ENGINE (engine.js)
// Handles all Supabase connections, Google Sheet parsing, and time calculations.
// ==============================================

const supabaseUrl = 'https://iiqxxxamsprzhzggsrer.supabase.co';
const supabaseKey = 'sb_publishable_eYTrqO8dPDZj0mjbv3Csqg_dMrY2h3k';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

const sheetLinks = {
    'quizzes': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTRQ3g-iv-ZNPmsFq_zInPnhzbraxuMfJNEHsUro3i7C_eNIHWmAc261FSqBcmuNFmDlLVl0-8jKNJ_/pub?gid=1820023798&single=true&output=csv', 
    'ao': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTRQ3g-iv-ZNPmsFq_zInPnhzbraxuMfJNEHsUro3i7C_eNIHWmAc261FSqBcmuNFmDlLVl0-8jKNJ_/pub?gid=189655281&single=true&output=csv',
    '22a': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTRQ3g-iv-ZNPmsFq_zInPnhzbraxuMfJNEHsUro3i7C_eNIHWmAc261FSqBcmuNFmDlLVl0-8jKNJ_/pub?gid=0&single=true&output=csv',
    '22b': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTRQ3g-iv-ZNPmsFq_zInPnhzbraxuMfJNEHsUro3i7C_eNIHWmAc261FSqBcmuNFmDlLVl0-8jKNJ_/pub?gid=660947078&single=true&output=csv',
    '23a': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTRQ3g-iv-ZNPmsFq_zInPnhzbraxuMfJNEHsUro3i7C_eNIHWmAc261FSqBcmuNFmDlLVl0-8jKNJ_/pub?gid=1579973346&single=true&output=csv',
    '23b': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTRQ3g-iv-ZNPmsFq_zInPnhzbraxuMfJNEHsUro3i7C_eNIHWmAc261FSqBcmuNFmDlLVl0-8jKNJ_/pub?gid=239334255&single=true&output=csv'
};

const configTitles = {
    'ao_seminar': "21st August' 2026 - AO Trauma Foot & Ankle Seminar",
    'workshop_diabetic': "21st August' 2026 - Diabetic Foot Workshop",
    'workshop_mis': "21st August' 2026 - MIS Workshop",
    '22a': "22nd August' 2026 - Day 1 Hall A",
    '22b': "22nd August' 2026 - Day 1 Hall B",
    '23a': "23rd August' 2026 - Day 2 Hall A",
    '23b': "23rd August' 2026 - Day 2 Hall B"
};

const buttonLabels = {
    'ao_seminar': "21 Aug: AO Seminar", 'workshop_diabetic': "21 Aug: Diabetic Foot", 'workshop_mis': "21 Aug: MIS",
    '22a': "22 Aug: Hall A", '22b': "22 Aug: Hall B", '23a': "23 Aug: Hall A", '23b': "23 Aug: Hall B"
};

const allHallsList = Object.keys(configTitles);
const CACHE_KEY = 'ifascon_schedule_cache_v30'; 

let appData = {};
let globalQuizzes = [];
let quizStartTimeStamp = null;
let manualOverrideIndex = null;
let liveHall = new URLSearchParams(window.location.search).get('hall') || '22a';
if (liveHall === 'ao') liveHall = 'ao_seminar';
if (liveHall === 'ao_workshops') liveHall = 'workshop_diabetic';

async function fetchLiveSchedule(isBackground = false) {
    let fetchedData = {};
    let quizzesLoaded = [];
    
    for (const [key, link] of Object.entries(sheetLinks)) {
        try {
            const response = await fetch(link);
            const csvText = await response.text();
            let parsedCsv = Papa.parse(csvText, { header: false }).data;
            
            if (key === 'quizzes') {
                quizzesLoaded = parseQuizData(parsedCsv);
            } else if (key === 'ao') {
                const allAo = parseRawData(parsedCsv, "21 Aug");
                let sem = [], dia = [], mis = [];
                let isWs = false, track = 'diabetic';
                allAo.forEach(ev => {
                    let matchStr = `${ev.title} ${ev.time} ${ev.parent_session}`.toLowerCase();
                    if (/\b(workshop|16:15|16\.15)\b/i.test(matchStr)) isWs = true;
                    if (isWs) {
                        if (matchStr.includes('diabetic') || matchStr.includes('nebula')) track = 'diabetic';
                        else if (matchStr.includes('mis') || matchStr.includes('arthrex')) track = 'mis';
                        if (track === 'diabetic') { ev.hall = "Diabetic Foot Hall"; dia.push(ev); }
                        else { ev.hall = "MIS Hall"; mis.push(ev); }
                    } else { ev.hall = "AO Seminar Hall"; sem.push(ev); }
                });
                fetchedData['ao_seminar'] = { title: configTitles['ao_seminar'], events: sem };
                fetchedData['workshop_diabetic'] = { title: configTitles['workshop_diabetic'], events: dia };
                fetchedData['workshop_mis'] = { title: configTitles['workshop_mis'], events: mis };
            } else {
                fetchedData[key] = { title: configTitles[key], events: parseRawData(parsedCsv, configTitles[key]) };
            }
        } catch(err) { console.error("Error fetching " + key, err); }
    }
    
    if (Object.keys(fetchedData).length > 0) {
        appData = fetchedData;
        globalQuizzes = quizzesLoaded;
        localStorage.setItem(CACHE_KEY, JSON.stringify({ halls: appData, quizzes: globalQuizzes }));
        if (!isBackground && document.getElementById('loadingState')) {
            document.getElementById('loadingState').classList.add('hidden');
            if (typeof initLiveKiosk === "function") initLiveKiosk();
        } else if (typeof updateLiveDisplay === "function") { 
            updateLiveDisplay(); 
        }
    }
}

function parseQuizData(rows) {
    let list = [];
    rows.forEach(r => {
        if(!r[0] || r[0].toLowerCase().includes('question')) return;
        list.push({ type: 'quiz', title: r[0].trim(), options: [r[1], r[2], r[3], r[4]].map(x => (x || "").trim()).filter(Boolean), correct: (r[5] || "").trim() });
    });
    return list;
}

function parseRawData(rows, hallTitle) {
    let events = [], current_session = "";
    rows.forEach(r => {
        while(r.length < 12) r.push("");
        r = r.map(x => (x || "").trim());
        let col0 = r[0], col1 = r[1], col2 = r[2], col3 = r[3];
        let colTitle = r[4] || r[5] || "", colSpeaker = r[4] ? r[5] : r[6];
        let colChair1 = r[4] ? r[6] : r[7], colChair2 = r[4] ? r[7] : r[8], colChair3 = r[4] ? r[8] : r[9];
        let row_text = r.join(" ").toLowerCase();

        if (row_text.includes("position:absolute") || row_text.includes("docs-drivelogo") || row_text.includes("<!doctype html>")) return; 
        if (col0.toLowerCase().includes("duration") && col1.toLowerCase().includes("from")) return;
        if (!col0 && !col1 && !col2 && !col3 && !colTitle) return;

        const breaks = ["break", "lunch", "banquet", "gbm", "valedictory", "inauguration", "registration"];
        let isBreakRow = breaks.some(b => row_text.includes(b)) && !row_text.includes("symposium") && !row_text.includes("session");
        
        if (isBreakRow || /\btea\b|\bcoffee\b/.test(row_text)) {
            let text = colTitle || col3 || col0;
            if (row_text.includes("registration")) text = "Registration";
            else if (row_text.includes("lunch")) text = "Lunch";
            else if (/\btea\b|\bcoffee\b/.test(row_text)) text = "Tea / Coffee Break";
            
            let adLink = r.find(c => c.toLowerCase().includes('http')) || "";
            // FIXED: Forced speaker and chairperson arrays to empty string for all breaks/registration
            events.push({ type: 'break', title: text, time: (col1 && col2) ? `${col1} - ${col2}` : (col1 || col0), speaker: '', chairpersons: '', hall: hallTitle, parent_session: '', adLink: adLink });
            return;
        }

        let isQA = col3.toLowerCase().includes("q&a") || colTitle.toLowerCase().includes("discussion");
        let isPlenary = col3.toLowerCase().includes("plenary") || colTitle.toLowerCase().includes("plenary");
        let isSession = false, isOration = false;
        
        if (row_text.includes('oration')) { isSession = true; isOration = true; } 
        else if (!isQA && !isPlenary) {
            if (!col1 && !col2 && !col0) isSession = true; 
            else if (!col0 && col1 && col2 && !colTitle) isSession = true; 
            else if (col3 && !colTitle && !colSpeaker) isSession = true; 
            else if (row_text.includes('symposium') || row_text.includes('session') || row_text.includes('workshop')) isSession = true;
        }

        if (isSession) {
            let topic = colTitle || col3 || (isOration ? "Oration" : "Session");
            if (colTitle && col3 && colTitle.toLowerCase() !== col3.toLowerCase()) {
                if (colTitle.toLowerCase().includes(col3.toLowerCase())) topic = colTitle;
                else if (col3.toLowerCase().includes(colTitle.toLowerCase())) topic = col3;
                else topic = col3 + ": " + colTitle;
            }
            let chairsArr = [isOration ? "" : colSpeaker, colChair1, colChair2, colChair3].filter(c => c && !["nan", "speaker", "chairperson"].includes(c.toLowerCase()));
            current_session = topic; 
            events.push({ type: 'session', isOration: isOration, time: (col1 && col2) ? `${col1} - ${col2}` : (col1 || col0), title: topic, speaker: isOration ? (colSpeaker || "") : chairsArr.join(", "), chairpersons: isOration ? chairsArr.join(", ") : "", hall: hallTitle, parent_session: current_session });
            return;
        }

        if (col1 || colTitle || isQA || isPlenary) {
            let speaker = ["nan", "tbd"].includes(colSpeaker.toLowerCase()) ? "" : colSpeaker;
            let time_display = (col1 && col2) ? `${col1} - ${col2}` : col1;
            
            // FIXED: Duration parsing no longer deletes text. It grabs exact string.
            if (col0 && !col0.toLowerCase().includes("duration")) {
                time_display = time_display ? `${time_display} (${col0.trim()})` : col0.trim();
            }

            let displayTitle = (isQA && !colTitle) ? col3 : (colTitle || col3);
            events.push({ type: 'presentation', time: time_display, tag: (isQA && !colTitle) ? "Discussion" : col3, title: displayTitle, speaker: speaker, hall: hallTitle, parent_session: current_session });
        }
    });
    return events;
}

function parseTimeToMinutes(timeStr) {
    if (!timeStr) return null;
    const parts = timeStr.split('-')[0].trim().split(/[.:]/);
    if (parts.length < 2) return null;
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

function getLiveStatus(events) {
    const playableEvents = events.filter(e => e.type === 'presentation' || e.type === 'break' || e.isOration);
    
    if (manualOverrideIndex !== null) {
        if (manualOverrideIndex < 0 && globalQuizzes.length > 0) {
            return { currentEvent: globalQuizzes[Math.abs(manualOverrideIndex) - 1], nextEvent: playableEvents[0] || null };
        }
        return { currentEvent: playableEvents[manualOverrideIndex] || null, nextEvent: playableEvents[manualOverrideIndex + 1] || null };
    }
    
    const currentMins = new Date().getHours() * 60 + new Date().getMinutes();
    let currentEvent = null, nextEvent = null;

    for (let i = 0; i < playableEvents.length; i++) {
        const ev = playableEvents[i];
        const evStart = parseTimeToMinutes(ev.time);
        let evEnd = (ev.time && ev.time.includes('-')) ? parseTimeToMinutes(ev.time.split('-')[1].trim()) : (evStart !== null ? evStart + 15 : null);
        
        if (evStart !== null && evEnd !== null) {
            if (currentMins >= evStart && currentMins < evEnd) {
                currentEvent = ev; 
                if (ev.type === 'break' && i > 0 && playableEvents[i-1].type !== 'break') {
                    currentEvent = playableEvents[i-1];
                }
                if (i + 1 < playableEvents.length) nextEvent = playableEvents[i + 1]; 
                break;
            } else if (currentMins < evStart && !nextEvent) { nextEvent = ev; }
        }
    }
    return { currentEvent, nextEvent };
}

function subscribeToHall(hall_id) {
    if (window.currentSubscription) supabaseClient.removeChannel(window.currentSubscription);
    supabaseClient.from('hall_states').select('override_index, quiz_start_time').eq('hall_id', hall_id).single().then(({ data }) => {
        if (data) { manualOverrideIndex = data.override_index; quizStartTimeStamp = data.quiz_start_time; }
        if (typeof updateLiveDisplay === "function") updateLiveDisplay();
    });
    window.currentSubscription = supabaseClient.channel('custom-hall-channel-' + hall_id)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'hall_states', filter: `hall_id=eq.${hall_id}` },
            (payload) => { 
                manualOverrideIndex = payload.new.override_index; 
                quizStartTimeStamp = payload.new.quiz_start_time;
                if (typeof updateLiveDisplay === "function") updateLiveDisplay(); 
            }
        ).subscribe();
}
