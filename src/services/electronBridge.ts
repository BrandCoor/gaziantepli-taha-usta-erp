/** Electron preload köprüsü (window.electronAPI). Tarayıcıda (PWA/dev) yoktur. */
interface ElectronAPI {
  isElectron: boolean;
  invoke(channel: string, payload?: unknown): Promise<any>;
  send(channel: string): void;
}

const api = (): ElectronAPI | undefined => (typeof window !== 'undefined' ? (window as any).electronAPI : undefined);

export const isElectronApp = (): boolean => !!api()?.isElectron;

export async function ipcInvoke(channel: string, payload?: unknown): Promise<any> {
  const a = api();
  if (!a) throw new Error('Masaüstü uygulaması dışında kullanılamaz');
  return a.invoke(channel, payload);
}

export function ipcSend(channel: string): void {
  api()?.send(channel);
}
