// @smounters/data — MikroORM entity fragments shared by our projects.
//
// A fragment is an abstract class WITHOUT `@Entity()`: it owns columns, the project owns the table,
// the indexes and the relations. That split is deliberate — the columns are the same everywhere, the
// foreign keys never are.

export { AuditableEntity, BaseEntity } from "./base.js";
export { UserSettingBase } from "./user-setting.js";
