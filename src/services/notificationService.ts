// Gaziantepli Taha Usta - Özel Lüks Bildirim & Modal Servisi

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
}

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel?: () => void;
}

type Listener = () => void;

class NotificationService {
  private toasts: ToastItem[] = [];
  private activeConfirm: ConfirmDialogOptions | null = null;
  private listeners: Set<Listener> = new Set();

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  public getToasts(): ToastItem[] {
    return this.toasts;
  }

  public getActiveConfirm(): ConfirmDialogOptions | null {
    return this.activeConfirm;
  }

  // ŞIK TOAST BİLDİRİMİ
  public showToast(title: string, message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success', duration: number = 3500) {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const newToast: ToastItem = { id, type, title, message };
    this.toasts.push(newToast);
    this.notify();

    setTimeout(() => {
      this.removeToast(id);
    }, duration);
  }

  public removeToast(id: string) {
    this.toasts = this.toasts.filter(t => t.id !== id);
    this.notify();
  }

  // ÖZEL ONAY MODALI (CONFIRM YERİNE)
  public confirm(options: ConfirmDialogOptions) {
    this.activeConfirm = options;
    this.notify();
  }

  public closeConfirm() {
    this.activeConfirm = null;
    this.notify();
  }

  public success(title: string, message: string) {
    this.showToast(title, message, 'success');
  }

  public error(title: string, message: string) {
    this.showToast(title, message, 'error');
  }

  public warning(title: string, message: string) {
    this.showToast(title, message, 'warning');
  }
}

export const notify = new NotificationService();
