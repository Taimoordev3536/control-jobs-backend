/**
 * Convert HH:MM format to minutes
 * @param duration - Duration in HH:MM format or number
 * @returns Duration in minutes
 */
export function convertDurationToMinutes(duration: string | number | undefined | null): number {
  if (!duration) return 0;
  
  // If already a number, return it
  if (typeof duration === 'number') return duration;
  
  // If string, parse HH:MM format
  const durationStr = String(duration).trim();
  if (!durationStr) return 0;
  
  // Check if it's in HH:MM format
  const match = durationStr.match(/^(\d{1,2}):(\d{2})$/);
  if (match) {
    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    return hours * 60 + minutes;
  }
  
  // Otherwise try to parse as number
  const parsed = parseInt(durationStr, 10);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Convert minutes to HH:MM format
 * @param minutes - Duration in minutes
 * @returns Duration in HH:MM format
 */
export function convertMinutesToDuration(minutes: number | undefined | null): string {
  if (!minutes || minutes <= 0) return '00:00';
  
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}
