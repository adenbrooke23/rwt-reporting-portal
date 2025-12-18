import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationModule, ButtonModule } from 'carbon-components-angular';
import { ConfirmationNotificationService, ConfirmationRequest } from '../../../core/services/confirmation.service';
import { Observable, Subject } from 'rxjs';

@Component({
  selector: 'app-confirmation-notification',
  imports: [CommonModule, NotificationModule, ButtonModule],
  templateUrl: './confirmation-notification.component.html',
  styleUrl: './confirmation-notification.component.scss'
})
export class ConfirmationNotificationComponent implements OnInit {
  private confirmationService = inject(ConfirmationNotificationService);

  confirmation$!: Observable<ConfirmationRequest | null>;

  ngOnInit(): void {
    this.confirmation$ = this.confirmationService.confirmation$;
  }

  getNotificationType(type: string): 'error' | 'info' | 'warning' {
    // Map to Carbon types
    if (type === 'danger') return 'error';
    if (type === 'info') return 'info';
    return 'warning';
  }

  getActions(request: ConfirmationRequest): any[] {
    const cancelSubject = new Subject<any>();
    const confirmSubject = new Subject<any>();

    cancelSubject.subscribe(() => {
      this.confirmationService.resolve(false);
    });

    confirmSubject.subscribe(() => {
      this.confirmationService.resolve(true);
    });

    return [
      {
        text: request.cancelText,
        click: cancelSubject
      },
      {
        text: request.confirmText,
        click: confirmSubject
      }
    ];
  }
}
