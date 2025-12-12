export function toUTCDate(minutesFromNow: number, asISOString = false) {
  const utcTime = new Date(Date.now() + minutesFromNow * 60 * 1000);
  return asISOString ? utcTime.toISOString() : utcTime;
}
