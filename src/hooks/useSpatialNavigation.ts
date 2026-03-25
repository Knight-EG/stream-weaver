import { useEffect, useCallback } from 'react';

const FOCUSABLE_SELECTOR = '[data-focusable="true"]';

function getFocusableElements(container?: HTMLElement): HTMLElement[] {
  const root = container || document;
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null);
}

function getRect(el: HTMLElement) {
  return el.getBoundingClientRect();
}

function findNextFocusable(current: HTMLElement, direction: 'up' | 'down' | 'left' | 'right'): HTMLElement | null {
  const elements = getFocusableElements();
  if (elements.length === 0) return null;

  const currentRect = getRect(current);
  const cx = currentRect.left + currentRect.width / 2;
  const cy = currentRect.top + currentRect.height / 2;

  let best: HTMLElement | null = null;
  let bestDist = Infinity;

  for (const el of elements) {
    if (el === current) continue;
    const rect = getRect(el);
    const ex = rect.left + rect.width / 2;
    const ey = rect.top + rect.height / 2;

    let valid = false;
    switch (direction) {
      case 'up': valid = ey < cy - 5; break;
      case 'down': valid = ey > cy + 5; break;
      case 'left': valid = ex < cx - 5; break;
      case 'right': valid = ex > cx + 5; break;
    }

    if (!valid) continue;

    const primaryAxis = (direction === 'up' || direction === 'down') ? Math.abs(ey - cy) : Math.abs(ex - cx);
    const secondaryAxis = (direction === 'up' || direction === 'down') ? Math.abs(ex - cx) : Math.abs(ey - cy);
    const dist = primaryAxis + secondaryAxis * 0.3;

    if (dist < bestDist) {
      bestDist = dist;
      best = el;
    }
  }

  return best;
}

export function useSpatialNavigation() {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const directionMap: Record<string, 'up' | 'down' | 'left' | 'right'> = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
    };

    const direction = directionMap[e.key];
    if (!direction) return;

    const active = document.activeElement as HTMLElement;
    if (!active || !active.hasAttribute('data-focusable')) {
      const first = getFocusableElements()[0];
      if (first) { first.focus(); e.preventDefault(); }
      return;
    }

    const next = findNextFocusable(active, direction);
    if (next) {
      next.focus();
      next.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      e.preventDefault();
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
