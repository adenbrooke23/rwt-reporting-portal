import { Injectable, NgZone, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Subject, fromEvent, merge, timer } from 'rxjs';
import { debounceTime, tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class IdleTimeoutService {
  private platformId = inject(PLATFORM_ID);
  private readonly WARNING_TIME = 20 * 60 * 1000; // 20 minutes
  private readonly LOGOUT_TIME = 25 * 60 * 1000;  // 25 minutes

  private warningSubject = new Subject<number>();
  private logoutSubject = new Subject<void>();
  private lastActivity = Date.now();
  private warningTimer: any;
  private logoutTimer: any;
  private isActive = false;

  public warning$ = this.warningSubject.asObservable();
  public logout$ = this.logoutSubject.asObservable();

  constructor(private ngZone: NgZone) {}

  startWatching(): void {
    // Only watch for idle in browser environment
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.isActive) return;

    this.isActive = true;
    this.resetTimers();

    this.ngZone.runOutsideAngular(() => {
      merge(
        fromEvent(document, 'mousemove'),
        fromEvent(document, 'mousedown'),
        fromEvent(document, 'keypress'),
        fromEvent(document, 'scroll'),
        fromEvent(document, 'touchstart'),
        fromEvent(document, 'click')
      )
      .pipe(
        debounceTime(1000),
        tap(() => {
          this.lastActivity = Date.now();
          this.resetTimers();
        })
      )
      .subscribe();

      this.checkIdleStatus();
    });
  }

  stopWatching(): void {
    this.isActive = false;
    this.clearTimers();
  }

  resetActivity(): void {
    this.lastActivity = Date.now();
    this.resetTimers();
  }

  private checkIdleStatus(): void {
    setInterval(() => {
      if (!this.isActive) return;

      const idleTime = Date.now() - this.lastActivity;

      if (idleTime >= this.LOGOUT_TIME) {
        this.ngZone.run(() => {
          this.logoutSubject.next();
          this.stopWatching();
        });
      } else if (idleTime >= this.WARNING_TIME) {
        const remainingSeconds = Math.floor((this.LOGOUT_TIME - idleTime) / 1000);
        this.ngZone.run(() => {
          this.warningSubject.next(remainingSeconds);
        });
      }
    }, 1000);
  }

  private resetTimers(): void {
    this.clearTimers();

    this.warningTimer = setTimeout(() => {
      const remainingSeconds = Math.floor((this.LOGOUT_TIME - this.WARNING_TIME) / 1000);
      this.ngZone.run(() => {
        this.warningSubject.next(remainingSeconds);
      });
    }, this.WARNING_TIME);

    this.logoutTimer = setTimeout(() => {
      this.ngZone.run(() => {
        this.logoutSubject.next();
        this.stopWatching();
      });
    }, this.LOGOUT_TIME);
  }

  private clearTimers(): void {
    if (this.warningTimer) {
      clearTimeout(this.warningTimer);
      this.warningTimer = null;
    }
    if (this.logoutTimer) {
      clearTimeout(this.logoutTimer);
      this.logoutTimer = null;
    }
  }
}
