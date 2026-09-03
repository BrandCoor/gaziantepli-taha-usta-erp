export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  duration?: number;
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
  private listeners: Listener[] = [];

  public subscribe(fn: Listener) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(fn => fn());
  }

  public getToasts(): ToastItem[] {
    return this.toasts;
  }

  public getActiveConfirm(): ConfirmDialogOptions | null {
    return this.activeConfirm;
  }

  public showToast(type: ToastType, title: string, message: string, duration: number = 3500) {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const toast: ToastItem = { id, type, title, message, duration };
    this.toasts.push(toast);
    this.notifyListeners();

    if (duration > 0) {
      setTimeout(() => {
        this.removeToast(id);
      }, duration);
    }
  }

  public success(title: string, message: string) {
    this.showToast('success', title, message);
  }

  public error(title: string, message: string) {
    this.showToast('error', title, message, 4500);
  }

  public warning(title: string, message: string) {
    this.showToast('warning', title, message, 4000);
  }

  public info(title: string, message: string) {
    this.showToast('info', title, message);
  }

  public removeToast(id: string) {
    this.toasts = this.toasts.filter(t => t.id !== id);
    this.notifyListeners();
  }

  public confirm(options: ConfirmDialogOptions) {
    this.activeConfirm = options;
    this.notifyListeners();
  }

  public closeConfirm() {
    this.activeConfirm = null;
    this.notifyListeners();
  }
}

export const notify = new NotificationService();