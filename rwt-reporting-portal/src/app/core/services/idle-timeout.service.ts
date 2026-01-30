import { Injectable, NgZone, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Subject, Subscription, fromEvent, merge } from 'rxjs';
import { debounceTime, tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class IdleTimeoutService {
  private platformId = inject(PLATFORM_ID);

  // Timeout configuration (in milliseconds)
  private readonly WARNING_TIME = 20 * 60 * 1000;  // 20 minutes
  private readonly LOGOUT_TIME = 25 * 60 * 1000;   // 25 minutes
  private readonly STORAGE_KEY = 'lastActivityTime';

  private warningSubject = new Subject<number>();
  private logoutSubject = new Subject<void>();
  private warningDismissedSubject = new Subject<void>();

  private lastActivity = Date.now();
  private warningTimer: ReturnType<typeof setTimeout> | null = null;
  private logoutTimer: ReturnType<typeof setTimeout> | null = null;
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private eventSubscription: Subscription | null = null;
  private isActive = false;
  private isWarningShown = false;

  public warning$ = this.warningSubject.asObservable();
  public logout$ = this.logoutSubject.asObservable();
  public warningDismissed$ = this.warningDismissedSubject.asObservable();

  constructor(private ngZone: NgZone) {
    // Restore last activity time from storage on service init
    if (isPlatformBrowser(this.platformId)) {
      this.restoreLastActivity();
    }
  }

  startWatching(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.isActive) return;

    this.isActive = true;
    this.isWarningShown = false;

    // Check if we should already be in warning or logged out state
    const idleTime = Date.now() - this.lastActivity;
    if (idleTime >= this.LOGOUT_TIME) {
      // Already timed out - log out immediately
      this.ngZone.run(() => {
        this.logoutSubject.next();
        this.stopWatching();
      });
      return;
    }

    this.setupEventListeners();
    this.startCheckInterval();
    this.resetTimers();
  }

  stopWatching(): void {
    this.isActive = false;
    this.isWarningShown = false;
    this.clearTimers();
    this.clearCheckInterval();
    this.clearEventListeners();
  }

  resetActivity(): void {
    if (!this.isActive) return;

    this.lastActivity = Date.now();
    this.persistLastActivity();
    this.isWarningShown = false;
    this.warningDismissedSubject.next();
    this.resetTimers();
  }

  private restoreLastActivity(): void {
    try {
      const stored = sessionStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const storedTime = parseInt(stored, 10);
        if (!isNaN(storedTime) && storedTime > 0) {
          this.lastActivity = storedTime;
        }
      }
    } catch (e) {
      // Storage not available, use current time
      this.lastActivity = Date.now();
    }
  }

  private persistLastActivity(): void {
    try {
      sessionStorage.setItem(this.STORAGE_KEY, this.lastActivity.toString());
    } catch (e) {
      // Storage not available, ignore
    }
  }

  private setupEventListeners(): void {
    this.clearEventListeners();

    this.ngZone.runOutsideAngular(() => {
      this.eventSubscription = merge(
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
          // Only reset if warning is not shown (user must click "Stay Active")
          if (!this.isWarningShown) {
            this.lastActivity = Date.now();
            this.persistLastActivity();
            this.resetTimers();
          }
        })
      )
      .subscribe();
    });
  }

  private clearEventListeners(): void {
    if (this.eventSubscription) {
      this.eventSubscription.unsubscribe();
      this.eventSubscription = null;
    }
  }

  private startCheckInterval(): void {
    this.clearCheckInterval();

    this.ngZone.runOutsideAngular(() => {
      this.checkInterval = setInterval(() => {
        if (!this.isActive) return;

        const idleTime = Date.now() - this.lastActivity;

        if (idleTime >= this.LOGOUT_TIME) {
          this.ngZone.run(() => {
            this.logoutSubject.next();
            this.stopWatching();
          });
        } else if (idleTime >= this.WARNING_TIME && !this.isWarningShown) {
          this.isWarningShown = true;
          const remainingSeconds = Math.floor((this.LOGOUT_TIME - idleTime) / 1000);
          this.ngZone.run(() => {
            this.warningSubject.next(remainingSeconds);
          });
        } else if (this.isWarningShown && idleTime >= this.WARNING_TIME) {
          // Update countdown while warning is shown
          const remainingSeconds = Math.floor((this.LOGOUT_TIME - idleTime) / 1000);
          this.ngZone.run(() => {
            this.warningSubject.next(remainingSeconds);
          });
        }
      }, 1000);
    });
  }

  private clearCheckInterval(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  private resetTimers(): void {
    this.clearTimers();

    const idleTime = Date.now() - this.lastActivity;
    const timeUntilWarning = Math.max(0, this.WARNING_TIME - idleTime);
    const timeUntilLogout = Math.max(0, this.LOGOUT_TIME - idleTime);

    if (timeUntilWarning > 0) {
      this.warningTimer = setTimeout(() => {
        if (!this.isWarningShown) {
          this.isWarningShown = true;
          const remainingSeconds = Math.floor((this.LOGOUT_TIME - this.WARNING_TIME) / 1000);
          this.ngZone.run(() => {
            this.warningSubject.next(remainingSeconds);
          });
        }
      }, timeUntilWarning);
    }

    if (timeUntilLogout > 0) {
      this.logoutTimer = setTimeout(() => {
        this.ngZone.run(() => {
          this.logoutSubject.next();
          this.stopWatching();
        });
      }, timeUntilLogout);
    }
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
