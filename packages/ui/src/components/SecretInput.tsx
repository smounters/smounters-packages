import { InputGroup } from "@heroui/react";
import { type ComponentPropsWithRef, useState } from "react";
import { Icon, ICONS } from "../icons";
import { useUiLabels } from "../provider";

export type SecretInputProps = Omit<ComponentPropsWithRef<typeof InputGroup.Input>, "type">;

// Поле пароля/ключа с кнопкой показа внутри. autoComplete по умолчанию off: без него браузер
// подставляет пароль пользователя в чужие поля — SMTP-пароль, API-ключ провайдера.
export function SecretInput({ autoComplete = "off", ...props }: SecretInputProps) {
  const { actions } = useUiLabels();
  const [shown, setShown] = useState(false);
  const label = shown ? actions.hideSecret : actions.showSecret;
  return (
    <InputGroup>
      <InputGroup.Input type={shown ? "text" : "password"} autoComplete={autoComplete} {...props} />
      <InputGroup.Suffix>
        <button
          type="button"
          aria-label={label}
          aria-pressed={shown}
          title={label}
          onClick={() => setShown((v) => !v)}
          className="flex items-center rounded-small p-1 text-muted outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus"
        >
          <Icon icon={shown ? ICONS.eyeClosed : ICONS.eye} width={18} height={18} aria-hidden />
        </button>
      </InputGroup.Suffix>
    </InputGroup>
  );
}
