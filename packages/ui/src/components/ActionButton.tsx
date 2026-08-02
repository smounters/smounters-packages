import { Button, cn } from "@heroui/react";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { Icon, type IconName, ICONS } from "../icons";

// У кнопки HeroUI вариантов шесть, а в токенах есть ещё success/warning — их рисуем поверх базового
// варианта классами по токенам, чтобы «удалить» и «подтвердить» выглядели одинаково во всех кабинетах.
export type ActionTone =
  | "primary"
  | "secondary"
  | "tertiary"
  | "ghost"
  | "outline"
  | "danger"
  | "danger-soft"
  | "success"
  | "warning";

const EXTRA_TONE: Partial<Record<ActionTone, { variant: "outline"; className: string }>> = {
  success: { variant: "outline", className: "border-success/50 text-success hover:bg-success/10" },
  warning: { variant: "outline", className: "border-warning/50 text-warning hover:bg-warning/10" },
};

type ButtonProps = ComponentPropsWithRef<typeof Button>;

export interface ActionButtonProps extends Omit<ButtonProps, "variant" | "children"> {
  tone?: ActionTone;
  /** Иконка перед текстом; без текста кнопка становится иконической (нужен aria-label). */
  icon?: IconName | undefined;
  /** Иконка после текста — для «ещё», «развернуть» и подобного. */
  iconAfter?: IconName | undefined;
  children?: ReactNode;
}

const ICON_SIZE = { sm: 16, md: 18, lg: 20 } as const;

export function ActionButton({
  tone = "ghost",
  icon,
  iconAfter,
  size = "sm",
  children,
  className,
  ...rest
}: ActionButtonProps) {
  const extra = EXTRA_TONE[tone];
  const px = ICON_SIZE[size ?? "sm"] ?? 16;
  const iconOnly = children === undefined && !iconAfter;
  const cls = cn(extra?.className, className);
  return (
    <Button
      variant={extra ? extra.variant : (tone as ButtonProps["variant"])}
      size={size}
      isIconOnly={iconOnly}
      {...(cls ? { className: cls } : {})}
      {...rest}
    >
      {icon && <Icon icon={ICONS[icon]} width={px} height={px} aria-hidden />}
      {children}
      {iconAfter && <Icon icon={ICONS[iconAfter]} width={px} height={px} aria-hidden />}
    </Button>
  );
}
