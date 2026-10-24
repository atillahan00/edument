'use client';
import { useId, useSyncExternalStore } from 'react';
import { designs, designKey, validDesign } from '../lib/design';

const hydrationSubscribe = () => () => {};
function snapshot() {
  const value = document.documentElement.dataset.design;
  return validDesign(value) ? value : 'ultra';
}
function subscribe(notify: () => void) {
  const sync = (event: StorageEvent) => {
    if (event.key !== designKey && event.key !== null) return;
    document.documentElement.dataset.design = validDesign(event.newValue) ? event.newValue : 'ultra';
    notify();
  };
  window.addEventListener('edument-design-change', notify);
  window.addEventListener('storage', sync);
  return () => {
    window.removeEventListener('edument-design-change', notify);
    window.removeEventListener('storage', sync);
  };
}
export function AppearanceSwitcher() {
  const id = useId();
  const ready = useSyncExternalStore(
    hydrationSubscribe,
    () => true,
    () => false,
  );
  const design = useSyncExternalStore(subscribe, snapshot, () => 'ultra');
  return (
    <div className="appearance-switcher">
      <label htmlFor={id}>Görünüm</label>
      <select
        id={id}
        disabled={!ready}
        value={design}
        onChange={(event) => {
          const value = event.target.value;
          if (!validDesign(value)) return;
          document.documentElement.dataset.design = value;
          try {
            localStorage.setItem(designKey, value);
          } catch {
            /* Still usable without storage. */
          }
          window.dispatchEvent(new Event('edument-design-change'));
        }}
      >
        {designs.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </div>
  );
}
