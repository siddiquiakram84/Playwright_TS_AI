/**
 * Types and the injected browser script for the real-time test recorder.
 *
 * The capture script runs inside the browser (via page.addInitScript) and
 * forwards events as structured RecordedAction objects.
 */

export type RecordedActionType = 'navigate' | 'click' | 'fill' | 'select' | 'check' | 'hover';

export interface NavigateAction {
  type:      'navigate';
  url:       string;
  title:     string;
  timestamp: number;
}

export interface ClickAction {
  type:      'click';
  selector:  string;
  tagName:   string;
  text:      string;
  href?:     string;
  timestamp: number;
}

export interface FillAction {
  type:        'fill';
  selector:    string;
  value:       string;
  inputType:   string;
  placeholder: string;
  label:       string;
  name:        string;
  timestamp:   number;
}

export interface SelectAction {
  type:      'select';
  selector:  string;
  value:     string;
  label:     string;
  timestamp: number;
}

export interface CheckAction {
  type:      'check';
  selector:  string;
  checked:   boolean;
  label:     string;
  timestamp: number;
}

export type RecordedAction = NavigateAction | ClickAction | FillAction | SelectAction | CheckAction;

// ── Injected browser capture script ──────────────────────────────────────────

/**
 * This function is serialised and injected into every page frame by Playwright.
 * It must be self-contained (no external imports, no TypeScript-only constructs at runtime).
 */
export function captureScript(): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const win = window as any;
  win.__actions = win.__actions ?? [];

  // Always capture current page URL — handles redirects and re-injection safety net.
  // Dedup: skip if the last captured action is already this URL.
  const currentUrl = window.location.href;
  const lastAction = win.__actions[win.__actions.length - 1];
  if (!lastAction || lastAction.type !== 'navigate' || lastAction.url !== currentUrl) {
    win.__actions.push({ type: 'navigate', url: currentUrl, title: document.title, timestamp: Date.now() });
  }

  if (win.__recorderActive) return; // listeners already attached — skip re-registration
  win.__recorderActive = true;

  function getBestSelector(el: Element): string {
    const testAttrs = ['data-qa', 'data-testid', 'data-cy', 'data-test', 'data-id'];
    for (const attr of testAttrs) {
      const val = el.getAttribute(attr);
      if (val) return `[${attr}="${val}"]`;
    }
    const id = (el as HTMLElement).id;
    if (id && !id.match(/^\d/) && id.length < 50) return `#${id}`;
    const name = el.getAttribute('name');
    if (name) return `[name="${name}"]`;
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) return `[aria-label="${ariaLabel}"]`;
    const text = (el as HTMLElement).innerText?.trim().substring(0, 40);
    if (text && text.length > 0 && text.length < 40 && !text.includes('\n')) {
      return `text="${text}"`;
    }
    const classes = Array.from(el.classList).filter(c => !c.match(/^(active|hover|focus|visible)/)).slice(0, 2);
    return classes.length ? `${el.tagName.toLowerCase()}.${classes.join('.')}` : el.tagName.toLowerCase();
  }

  function getLabel(el: Element): string {
    const id = (el as HTMLElement).id;
    if (id) {
      const label = document.querySelector(`label[for="${id}"]`);
      if (label) return label.textContent?.trim() ?? '';
    }
    let parent = el.parentElement;
    while (parent && parent !== document.body) {
      const label = parent.querySelector('label');
      if (label && label !== el) return label.textContent?.trim() ?? '';
      parent = parent.parentElement;
    }
    return (el as HTMLInputElement).placeholder ?? el.getAttribute('aria-label') ?? '';
  }

  // ── Navigation tracking (SPA pushState / replaceState / back-forward) ────────
  function pushNavigate(): void {
    const url = window.location.href;
    const last = win.__actions[win.__actions.length - 1];
    if (last && last.type === 'navigate' && last.url === url) return; // dedup
    win.__actions.push({ type: 'navigate', url, title: document.title, timestamp: Date.now() });
  }

  const origPushState    = history.pushState.bind(history);
  const origReplaceState = history.replaceState.bind(history);
  history.pushState    = (...a) => { origPushState(...a);    setTimeout(pushNavigate, 100); };
  history.replaceState = (...a) => { origReplaceState(...a); setTimeout(pushNavigate, 100); };
  window.addEventListener('popstate', () => setTimeout(pushNavigate, 100));

  // ── Click tracking ───────────────────────────────────────────────────────
  document.addEventListener('click', (e) => {
    const el = e.target as Element;
    if (!el) return;
    const tag = el.tagName.toLowerCase();
    // Skip inputs — covered by fill handler
    if (['input', 'textarea', 'select'].includes(tag)) return;

    win.__actions.push({
      type:      'click',
      selector:  getBestSelector(el),
      tagName:   tag,
      text:      (el as HTMLElement).innerText?.trim().substring(0, 80) ?? '',
      href:      (el as HTMLAnchorElement).href || undefined,
      timestamp: Date.now(),
    });
  }, { capture: true });

  // ── Fill tracking (debounced per input) ───────────────────────────────────
  const fillTimers = new Map<Element, ReturnType<typeof setTimeout>>();

  document.addEventListener('input', (e) => {
    const el = e.target as HTMLInputElement;
    if (!el || !['input', 'textarea'].includes(el.tagName.toLowerCase())) return;

    const existing = fillTimers.get(el);
    if (existing) clearTimeout(existing);

    fillTimers.set(el, setTimeout(() => {
      win.__actions.push({
        type:        'fill',
        selector:    getBestSelector(el),
        value:       el.type === 'password' ? '***' : el.value,
        inputType:   el.type || 'text',
        placeholder: el.placeholder ?? '',
        label:       getLabel(el),
        name:        el.name ?? '',
        timestamp:   Date.now(),
      });
      fillTimers.delete(el);
    }, 600));
  }, { capture: true });

  // ── Select tracking ───────────────────────────────────────────────────────
  document.addEventListener('change', (e) => {
    const el = e.target as HTMLSelectElement;
    if (!el || el.tagName.toLowerCase() !== 'select') return;
    const selected = el.options[el.selectedIndex];
    win.__actions.push({
      type:      'select',
      selector:  getBestSelector(el),
      value:     el.value,
      label:     selected?.text ?? el.value,
      timestamp: Date.now(),
    });
  }, { capture: true });

  // ── Checkbox/radio tracking ───────────────────────────────────────────────
  document.addEventListener('change', (e) => {
    const el = e.target as HTMLInputElement;
    if (!el || !['checkbox', 'radio'].includes(el.type)) return;
    win.__actions.push({
      type:      'check',
      selector:  getBestSelector(el),
      checked:   el.checked,
      label:     getLabel(el),
      timestamp: Date.now(),
    });
  }, { capture: true });

  // ── API for Playwright to poll ────────────────────────────────────────────
  win.__getActions    = () => [...win.__actions];
  win.__clearActions  = () => { win.__actions = []; };
  win.__stopRecorder  = () => { win.__recorderActive = false; };
}
