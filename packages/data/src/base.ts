import { PrimaryKey, Property } from "@mikro-orm/decorators/legacy";

export abstract class BaseEntity {
  @PrimaryKey({ type: "uuid", defaultRaw: "uuidv7()" })
  id!: string;
}

export abstract class AuditableEntity extends BaseEntity {
  @Property({ type: "timestamptz", length: 0, defaultRaw: "CURRENT_TIMESTAMP" })
  createdAt = new Date();

  @Property({ type: "timestamptz", length: 0, defaultRaw: "CURRENT_TIMESTAMP", onUpdate: () => new Date() })
  updatedAt = new Date();

  @Property({ type: "uuid", nullable: true })
  createdBy?: string;

  @Property({ type: "uuid", nullable: true })
  updatedBy?: string;
}
