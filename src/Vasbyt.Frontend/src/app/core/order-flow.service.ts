const TOKEN_KEY = 'vasbyt.orderToken';
const SAME_ADDRESS_KEY = 'vasbyt.sameAddressForAll';

import { Injectable } from '@angular/core';

/**
 * The bits of the registration flow that have to survive a page reload.
 *
 * Before the account exists — which is only on entrant #1's form — the order token is the browser's
 * only handle on the order, so it cannot live in memory alone.
 */
@Injectable({ providedIn: 'root' })
export class OrderFlowService {
  get token(): string | null {
    return read(TOKEN_KEY);
  }

  set token(value: string | null) {
    write(TOKEN_KEY, value);
  }

  /** Set by the toggle on entrant #1; later entrants prefill their address from the first person. */
  get sameAddressForAll(): boolean {
    return read(SAME_ADDRESS_KEY) === 'true';
  }

  set sameAddressForAll(value: boolean) {
    write(SAME_ADDRESS_KEY, value ? 'true' : null);
  }
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    // ponytail: storage blocked means no resume-after-refresh. The flow itself still works.
  }
}
