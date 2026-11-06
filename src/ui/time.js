// ระยะเวลาแบบอ่านง่าย เช่น "2 ชม. 5 นาที"
export function thaiDuration(ms) {
  const minutes = Math.max(1, Math.round(ms / 60000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  return [days && `${days} วัน`, hours && `${hours} ชม.`, minutes % 60 && `${minutes % 60} นาที`].filter(Boolean).join(' ');
}

export const relative = (ms) => `<t:${Math.floor(ms / 1000)}:R>`;
