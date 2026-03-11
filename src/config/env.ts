export const API_BASE = import.meta.env['VITE_API_URL'] ?? '';

const proto = location.protocol === 'https:' ? 'wss' : 'ws';
export const WS_BASE = import.meta.env['VITE_WS_URL'] ?? `${proto}://${location.host}`;
