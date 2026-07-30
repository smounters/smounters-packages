import { PrimaryKey, Property } from "@mikro-orm/decorators/legacy";

// Entity fragments, not entities: these classes carry NO `@Entity()`. MikroORM inherits decorated
// properties from an abstract base, so a project extends them and declares its own table name,
// indexes and relations. That is what makes a fragment reusable across projects whose foreign keys
// point at different tables.
//
// Every decorator here states its column type EXPLICITLY. Nothing is inferred from
// `emitDecoratorMetadata`, so the built package behaves exactly like the same code compiled inside
// the consuming project — reflected type metadata does not survive a package boundary reliably.

/**
 * Primary key only. Use when a table needs no audit columns (a join table, an append-only log with
 * its own timestamp semantics).
 *
 * UUIDv7 (time-ordered, RFC 9562): k-sortable, so B-tree inserts keep the locality of a serial key
 * while the id stays non-enumerable. Generated DB-side into a native `uuid` column — this requires
 * **PostgreSQL 18+**, which ships `uuidv7()`. On older servers install a shim function of that name
 * or override the property in the project.
 */
export abstract class BaseEntity {
  @PrimaryKey({ type: "uuid", defaultRaw: "uuidv7()" })
  id!: string;
}

/**
 * Primary key + audit columns. The default base for aggregates.
 *
 * `createdBy`/`updatedBy` hold the acting user id; null means the system (a worker, a migration, a
 * seed). They are plain uuid columns rather than relations on purpose: a fragment cannot know which
 * table your users live in, and an audit column should not create a foreign key that blocks
 * deleting a user.
 */
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
