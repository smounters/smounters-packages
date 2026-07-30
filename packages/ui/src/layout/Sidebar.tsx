import { cn } from "@heroui/react";
import { type ReactNode, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ICONS, Icon } from "../icons";
import type { SidebarItem } from "./types";

export interface SidebarProps {
  items: SidebarItem[];
  /** Свёрнутый режим: только иконки. */
  compact?: boolean | undefined;
  appName?: string | undefined;
  logo?: ReactNode | undefined;
  onNavigate?: (() => void) | undefined;
  /** Прибитый к низу блок (переключатель языка, версия и т.п.). */
  footer?: ReactNode | undefined;
}

const LINK_BASE =
  "group flex items-center gap-3 rounded-medium px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-focus";
const LINK_INACTIVE = "text-muted hover:bg-surface-secondary hover:text-foreground";
const LINK_ACTIVE = "bg-accent-soft text-accent";

const TOOLTIP =
  "pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-medium border border-border bg-surface px-2 py-1 text-sm text-foreground opacity-0 shadow-md transition-opacity group-hover/item:opacity-100";

function isPathActive(pathname: string, href?: string): boolean {
  if (!href) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function anyChildActive(pathname: string, item: SidebarItem): boolean {
  return Boolean(item.items?.some((c) => isPathActive(pathname, c.href) || anyChildActive(pathname, c)));
}

function LeafLink({ item, compact, onNavigate }: { item: SidebarItem; compact: boolean; onNavigate?: (() => void) | undefined }) {
  return (
    <div className={cn("relative", compact && "group/item")}>
      <NavLink
        to={item.href ?? "#"}
        end={item.href === "/"}
        aria-label={compact ? item.title : undefined}
        onClick={onNavigate}
        className={({ isActive }) =>
          cn(LINK_BASE, isActive ? LINK_ACTIVE : LINK_INACTIVE, compact && "justify-center px-0")
        }
      >
        {item.icon && <Icon icon={item.icon} width={20} height={20} aria-hidden className="shrink-0" />}
        {!compact && <span className="truncate">{item.title}</span>}
      </NavLink>
      {compact && <span className={TOOLTIP}>{item.title}</span>}
    </div>
  );
}

function ParentGroup({ item, compact, onNavigate }: { item: SidebarItem; compact: boolean; onNavigate?: (() => void) | undefined }) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(() => anyChildActive(pathname, item));
  const active = anyChildActive(pathname, item);

  // В свёрнутом виде дети достаются наведением, без разворачивания сайдбара.
  if (compact) {
    return (
      <div className="group/grp relative">
        <div title={item.title} className={cn(LINK_BASE, active ? LINK_ACTIVE : LINK_INACTIVE, "justify-center px-0")}>
          {item.icon && <Icon icon={item.icon} width={20} height={20} aria-hidden className="shrink-0" />}
        </div>
        <div className="invisible absolute left-full top-0 z-50 pl-2 opacity-0 transition-opacity group-hover/grp:visible group-hover/grp:opacity-100">
          <div className="flex min-w-48 flex-col gap-1 rounded-large border border-border bg-surface p-2 shadow-lg">
            <p className="truncate px-2 py-1 text-xs font-semibold text-muted">{item.title}</p>
            {item.items?.map((child) => (
              <LeafLink key={child.key} item={child} compact={false} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(LINK_BASE, "w-full", active ? "text-accent" : LINK_INACTIVE)}
      >
        {item.icon && <Icon icon={item.icon} width={20} height={20} aria-hidden className="shrink-0" />}
        <span className="flex-1 truncate text-left">{item.title}</span>
        <Icon
          icon={ICONS.chevronDown}
          width={16}
          height={16}
          aria-hidden
          className={cn("shrink-0 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="mt-1 flex flex-col gap-1 pl-4">
          {item.items?.map((child) => (
            <LeafLink key={child.key} item={child} compact={false} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
}

// В свёрнутом виде список НЕ должен обрезаться по x — иначе всплывающие подписи и флайауты не вылезут.
export function Sidebar({ items, compact = false, appName, logo, onNavigate, footer }: SidebarProps) {
  return (
    <nav className="flex h-full flex-col gap-1">
      {(Boolean(logo) || Boolean(appName)) && (
        <div className={cn("mb-4 flex items-center gap-2 px-3 py-1 text-foreground", compact && "justify-center px-0")}>
          {logo}
          {!compact && appName && <span className="truncate text-lg font-semibold">{appName}</span>}
        </div>
      )}
      <div className={cn("flex min-h-0 flex-1 flex-col gap-1", compact ? "overflow-visible" : "overflow-y-auto")}>
        {items.map((item) =>
          item.items && item.items.length > 0 ? (
            <ParentGroup key={item.key} item={item} compact={compact} onNavigate={onNavigate} />
          ) : (
            <LeafLink key={item.key} item={item} compact={compact} onNavigate={onNavigate} />
          ),
        )}
      </div>
      {footer && <div className={cn("mt-2 border-border border-t pt-2", compact && "px-0")}>{footer}</div>}
    </nav>
  );
}
