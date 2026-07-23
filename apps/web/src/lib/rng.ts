/** Krypto-basierter Zufall für die pure Würfel-Engine. */
export function cryptoRng(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] ?? 0) / 2 ** 32;
}
