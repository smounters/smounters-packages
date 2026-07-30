import type { Opt } from "@mikro-orm/core";
import { Property } from "@mikro-orm/decorators/legacy";
import { AuditableEntity } from "./base.js";

/**
 * Per-user preference bag: one row per (user, section, key), the value is arbitrary JSON. The backend
 * never interprets the value — its shape belongs to the front end (column order and visibility,
 * sidebar width, filters). This is the store `@smounters/ui` writes through `UiProvider.useSetting`.
 *
 * The relation to the user and the unique constraint are declared by the project, because only the
 * project knows which table its users live in:
 *
 * ```ts
 * @Entity({ tableName: "user_settings" })
 * @Unique({ properties: ["user", "section", "key"] })
 * export class UserSetting extends UserSettingBase {
 *   @ManyToOne(() => User, { deleteRule: "cascade" })
 *   @Index()
 *   user!: Rel<User>;
 * }
 * ```
 *
 * `section` carries a default rather than being nullable so that the unique triple always holds — a
 * NULL section would let the same key be inserted twice.
 */
export abstract class UserSettingBase extends AuditableEntity {
  @Property({ type: "varchar", length: 50, default: "default" })
  section: string & Opt = "default";

  @Property({ type: "varchar", length: 100 })
  key!: string;

  @Property({ type: "jsonb", nullable: true })
  value?: unknown;
}
