import type { KeyboardEvent, ReactNode } from "react";

export interface TabItem<T extends string> {
  id: T;
  label: ReactNode;
  count?: number;
}

export const tabId = (id: string) => `tab-${id}`;
export const panelId = (id: string) => `panel-${id}`;

interface Props<T extends string> {
  tabs: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
}

/** Tabs with the keyboard behaviour screen-reader users expect: arrow keys move, Home and End jump. */
export function Tabs<T extends string>({ tabs, value, onChange, label }: Props<T>) {
  const move = (event: KeyboardEvent, index: number) => {
    const last = tabs.length - 1;
    const target =
      event.key === "ArrowRight" ? (index === last ? 0 : index + 1) : event.key === "ArrowLeft" ? (index === 0 ? last : index - 1) : event.key === "Home" ? 0 : event.key === "End" ? last : undefined;

    if (target === undefined) return;
    event.preventDefault();
    onChange(tabs[target]!.id);
    document.getElementById(tabId(tabs[target]!.id))?.focus();
  };

  return (
    <div role="tablist" aria-label={label} className="tabs">
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          id={tabId(tab.id)}
          role="tab"
          type="button"
          className="tab"
          aria-selected={tab.id === value}
          aria-controls={panelId(tab.id)}
          tabIndex={tab.id === value ? 0 : -1}
          onClick={() => onChange(tab.id)}
          onKeyDown={(event) => move(event, index)}
        >
          {tab.label}
          {tab.count !== undefined && <span className="tab__count">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}
