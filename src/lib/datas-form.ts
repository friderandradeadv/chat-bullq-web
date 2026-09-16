/**
 * Data local → valor de <input type="date"> / <input type="datetime-local">.
 *
 * SEMPRE local, nunca `toISOString().slice(0,10)`: no fuso do Brasil o ISO é
 * UTC e joga tudo o que acontece depois das 21h para o dia seguinte.
 * Mora aqui porque agenda, ficha do processo e os diálogos compartilhados de
 * tarefa/prazo/evento precisam da MESMA conversão.
 */
const pad = (n: number) => String(n).padStart(2, '0');

export const toDateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const toDatetimeLocal = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
