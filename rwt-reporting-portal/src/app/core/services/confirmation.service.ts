import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { filter, take } from 'rxjs/operators';

export type ConfirmationType = 'warning' | 'danger' | 'info';

export interface ConfirmationRequest {
  id: string;
  type: ConfirmationType;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
}

interface ConfirmationResult {
  id: string;
  confirmed: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ConfirmationNotificationService {
  private confirmationSubject = new BehaviorSubject<ConfirmationRequest | null>(null);
  private resultSubject = new BehaviorSubject<ConfirmationResult | null>(null);

  public confirmation$ = this.confirmationSubject.asObservable();

  /**
   * Show a confirmation notification and wait for user response
   */
  async confirm(
    type: ConfirmationType,
    title: string,
    message: string,
    confirmText: string = 'Confirm',
    cancelText: string = 'Cancel'
  ): Promise<boolean> {
    const request: ConfirmationRequest = {
      id: this.generateId(),
      type,
      title,
      message,
      confirmText,
      cancelText
    };

    this.confirmationSubject.next(request);

    // Wait for result
    const result = await firstValueFrom(
      this.resultSubject.pipe(
        filter(r => r !== null && r.id === request.id),
        take(1)
      )
    );

    // Clear confirmation
    this.confirmationSubject.next(null);

    return result?.confirmed || false;
  }

  /**
   * Resolve the current confirmation
   */
  resolve(confirmed: boolean): void {
    const current = this.confirmationSubject.value;
    if (current) {
      this.resultSubject.next({
        id: current.id,
        confirmed
      });
    }
  }

  /**
   * Convenience method for warning confirmations
   */
  warning(title: string, message: string, confirmText?: string): Promise<boolean> {
    return this.confirm('warning', title, message, confirmText);
  }

  /**
   * Convenience method for danger confirmations
   */
  danger(title: string, message: string, confirmText?: string): Promise<boolean> {
    return this.confirm('danger', title, message, confirmText);
  }

  private generateId(): string {
    return `confirm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
