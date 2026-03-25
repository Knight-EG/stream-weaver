import { useEffect, useCallback, useRef } from 'react';

const FOCUSABLE_SELECTOR = '[data-focusable="true"]';
const FOCUS_GROUP_SELECTOR = '[data-focus-group]';

interface FocusableRect {
  el: HTMLElement;
  rect: DOMRect;
  cx: number;
  cy: number;
}

function getFocusableElements(): FocusableRect[] {
  return Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null)
    .map(el => {
      const rect = el.getBoundingClientRect();
      return { el, rect, cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 };
    });
}

function findNextFocusable(
  current: FocusableRect,
  direction: 'up' | 'down' | 'left' | 'right',
  elements: FocusableRect[]
): HTMLElement | null {
  let best: HTMLElement | null = null;
  let bestScore = Infinity;

  // Check if current element specifies a focus group to constrain navigation
  const group = current.el.closest(FOCUS_GROUP_SELECTOR);

  for (const target of elements) {
    if (target.el === current.el) continue;

    // If in a focus group, prefer same group (but don't strictly require it)
    const sameGroup = group && group.contains(target.el);
    const groupBonus = sameGroup ? 0 : 500;

    const dx = target.cx - current.cx;
    const dy = target.cy - current.cy;

    let valid = false;
    let primaryDist = 0;
    let secondaryDist = 0;

    switch (direction) {
      case 'up':
        valid = dy < -5;
        primaryDist = Math.abs(dy);
        secondaryDist = Math.abs(dx);
        break;
      case 'down':
        valid = dy > 5;
        primaryDist = Math.abs(dy);
        secondaryDist = Math.abs(dx);
        break;
      case 'left':
        valid = dx < -5;
        primaryDist = Math.abs(dx);
        secondaryDist = Math.abs(dy);
        break;
      case 'right':
        valid = dx > 5;
        primaryDist = Math.abs(dx);
        secondaryDist = Math.abs(dy);
        break;
    }

    if (!valid) continue;

    // Score: primary distance + weighted secondary + group penalty
    const score = primaryDist + secondaryDist * 0.4 + groupBonus;
    if (score < bestScore) {
      bestScore = score;
      best = target.el;
    }
  }

  return best;
}

export function useSpatialNavigation() {
  const elementsCache = useRef<FocusableRect[]>([]);
  const cacheTimeout = useRef<number>(0);

  const refreshCache = useCallback(() => {
    elementsCache.current = getFocusableElements();
    clearTimeout(cacheTimeout.current);
    cacheTimeout.current = window.setTimeout(() => {
      elementsCache.current = [];
    }, 2000);
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const directionMap: Record<string, 'up' | 'down' | 'left' | 'right'> = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
    };

    // Handle Enter as click
    if (e.key === 'Enter' || e.key === ' ') {
      const active = document.activeElement as HTMLElement;
      if (active?.hasAttribute('data-focusable')) {
        active.click();
        e.preventDefault();
        return;
      }
    }

    // Handle Back button (TV remotes)
    if (e.key === 'Escape' || e.key === 'Backspace') {
      const backBtn = document.querySelector<HTMLElement>('[data-back-button="true"]');
      if (backBtn) { backBtn.click(); e.preventDefault(); return; }
    }

    const direction = directionMap[e.key];
    if (!direction) return;

    // Refresh cache on navigation
    if (elementsCache.current.length === 0) refreshCache();

    const active = document.activeElement as HTMLElement;
    if (!active?.hasAttribute('data-focusable')) {
      const first = elementsCache.current[0];
      if (first) { first.el.focus(); e.preventDefault(); }
      return;
    }

    const currentRect = active.getBoundingClientRect();
    const current: FocusableRect = {
      el: active,
      rect: currentRect,
      cx: currentRect.left + currentRect.width / 2,
      cy: currentRect.top + currentRect.height / 2,
    };

    const next = findNextFocusable(current, direction, elementsCache.current);
    if (next) {
      next.focus();
      next.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      e.preventDefault();
    }
  }, [refreshCache]);

  useEffect(() => {
    // Invalidate cache on DOM changes (debounced)
    const observer = new MutationObserver(() => {
      elementsCache.current = [];
    });
    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      observer.disconnect();
      clearTimeout(cacheTimeout.current);
    };
  }, [handleKeyDown]);
}
