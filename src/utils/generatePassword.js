// 0/O/1/I/L など見分けにくい文字を除いた文字集合
const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateSchedulePassword(length = 6) {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return out;
}
