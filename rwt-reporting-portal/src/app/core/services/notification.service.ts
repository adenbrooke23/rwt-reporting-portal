import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type NotificationType = 'error' | 'info' | 'info-square' | 'success' | 'warning' | 'warning-alt';

export interface ToastNotification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number;
  timestamp: Date;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notificationsSubject = new BehaviorSubject<ToastNotification[]>([]);
  public notifications$ = this.notificationsSubject.asObservable();

  private defaultDuration = 5000;

  
  success(title: string, message?: string, duration?: number): void {
    this.show('success', title, message, duration);
  }

  
  info(title: string, message?: string, duration?: number): void {
    this.show('info', title, message, duration);
  }

  
  warning(title: string, message?: string, duration?: number): void {
    this.show('warning', title, message, duration);
  }

  
  error(title: string, message?: string, duration?: number): void {
    this.show('error', title, message, duration);
  }

  
  private show(type: NotificationType, title: string, message?: string, duration?: number): void {
    const notification: ToastNotification = {
      id: this.generateId(),
      type,
      title,
      message,
      duration: duration || this.defaultDuration,
      timestamp: new Date()
    };

    const currentNotifications = this.notificationsSubject.value;
    this.notificationsSubject.next([...currentNotifications, notification]);

    if (notification.duration && notification.duration > 0) {
      setTimeout(() => {
        this.remove(notification.id);
      }, notification.duration);
    }
  }

  
  remove(id: string): void {
    const currentNotifications = this.notificationsSubject.value;
    this.notificationsSubject.next(
      currentNotifications.filter(n => n.id !== id)
    );
  }

  
  clearAll(): void {
    this.notificationsSubject.next([]);
  }

  
  private generateId(): string {
    return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
