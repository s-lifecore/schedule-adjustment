export function parseTimeRangeToMinutes(range) {
  const parts = (range || '').split('-');
  if (parts.length !== 2) return null;
  const toMin = (t) => {
    const m = t.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  };
  const s = toMin(parts[0]);
  const e = toMin(parts[1]);
  if (s === null || e === null) return null;
  return [s, e];
}

export function minToLabel(min) {
  min = Math.max(0, Math.min(1440, min));
  const h = Math.floor(min / 60);
  const m = min % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

export function formatDateLabel(dateStr) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const d = new Date(dateStr + 'T00:00:00');
    const wd = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
    return `${d.getMonth() + 1}/${d.getDate()}(${wd})`;
  }
  return dateStr;
}

export function getDateSlots(response, dateStr) {
  const entry = (response.timeSlots || []).find(ts => ts.date === dateStr);
  const slots = (entry && entry.timeSlots) || [];
  return [...slots].sort((a, b) => {
    const rangeA = parseTimeRangeToMinutes(a.timeRange);
    const rangeB = parseTimeRangeToMinutes(b.timeRange);
    return (rangeA ? rangeA[0] : Infinity) - (rangeB ? rangeB[0] : Infinity);
  });
}
