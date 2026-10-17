import { Tabs } from "@heroui/react";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";

export interface PageTab {
  key: string;
  label: string;
  content: ReactNode;
}

export interface PageTabsProps {
  tabs: PageTab[];

  label: string;

  param?: string;
}

export function PageTabs({ tabs, label, param = "tab" }: PageTabsProps) {
  const [params, setParams] = useSearchParams();
  const first = tabs[0]?.key ?? "";
  const wanted = params.get(param) ?? "";
  const active = tabs.some((t) => t.key === wanted) ? wanted : first;

  return (
    <Tabs
      selectedKey={active}
      onSelectionChange={(key) => {
        const next = new URLSearchParams(params);
        next.set(param, String(key));
        setParams(next, { replace: true });
      }}
    >
      <Tabs.ListContainer className="w-fit">
        <Tabs.List aria-label={label}>
          {tabs.map((t) => (
            <Tabs.Tab key={t.key} id={t.key} className="whitespace-nowrap">
              <Tabs.Indicator />
              {t.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs.ListContainer>
      {tabs.map((t) => (
        <Tabs.Panel key={t.key} id={t.key}>
          <div className="pt-4">{t.content}</div>
        </Tabs.Panel>
      ))}
    </Tabs>
  );
}
