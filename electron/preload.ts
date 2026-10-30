import { contextBridge, ipcRenderer } from 'electron';

// Sayfaya yalnızca bu izin listesindeki kanallar açılır; Node.js/Electron'un geri kalanı gizli kalır.
const INVOKE_CHANNELS = new Set([
  'get-system-usb-printers', 'print-network-ticket', 'print-usb-receipt', 'print-hardware-test',
  'app-info', 'backup-save', 'backup-list', 'backup-read', 'backup-open-folder', 'backup-choose-secondary', 'backup-clear-secondary', 'log-tail', 'log-renderer-error',
  'kv-load-all', 'kv-set', 'kv-remove', 'kv-clear', 'kv-import', 'kv-info',
]);
const SEND_CHANNELS = new Set(['window-minimize', 'window-toggle-fullscreen', 'window-close']);

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  invoke: (channel: string, payload?: unknown): Promise<unknown> => {
    if (!INVOKE_CHANNELS.has(channel)) return Promise.reject(new Error('İzin verilmeyen kanal: ' + channel));
    return ipcRenderer.invoke(channel, payload);
  },
  send: (channel: string): void => {
    if (SEND_CHANNELS.has(channel)) ipcRenderer.send(channel);
  },
});
