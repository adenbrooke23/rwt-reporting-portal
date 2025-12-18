import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-idle-warning-modal',
  imports: [CommonModule],
  templateUrl: './idle-warning-modal.component.html',
  styleUrl: './idle-warning-modal.component.scss'
})
export class IdleWarningModalComponent {
  @Input() remainingSeconds: number = 0;
  @Output() stayActive = new EventEmitter<void>();

  get minutesRemaining(): number {
    return Math.floor(this.remainingSeconds / 60);
  }

  get secondsRemaining(): number {
    return this.remainingSeconds % 60;
  }

  onStayActive(): void {
    this.stayActive.emit();
  }
}
