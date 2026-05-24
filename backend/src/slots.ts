import type { Appointment, SiteProfile, TimeSlot } from "./types.js";

function parseTime(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function isWorkDay(site: SiteProfile, dateStr: string): boolean {
  const day = new Date(`${dateStr}T12:00:00`).getDay();
  const days = site.workDays.split(",").map((d) => Number(d.trim()));
  return days.includes(day);
}

export function getAvailableSlots(
  site: SiteProfile,
  dateStr: string,
  booked: Appointment[]
): TimeSlot[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return [];
  if (!isWorkDay(site, dateStr)) return [];

  const start = parseTime(site.workStart);
  const end = parseTime(site.workEnd);
  const duration = site.slotDuration;

  if (end <= start || duration <= 0) return [];

  const bookedTimes = new Set(
    booked
      .filter((a) => a.date === dateStr && a.siteSlug === site.slug && a.status !== "rejected")
      .map((a) => a.time)
  );

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const slots: TimeSlot[] = [];
  for (let t = start; t + duration <= end; t += duration) {
    const time = formatTime(t);
    let available = !bookedTimes.has(time);

    if (dateStr === todayStr && t <= nowMinutes) {
      available = false;
    }

    slots.push({ time, available });
  }

  return slots;
}
