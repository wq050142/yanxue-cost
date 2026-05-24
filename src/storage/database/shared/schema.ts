import { pgTable, serial, timestamp, varchar, boolean, integer, jsonb, uuid, index } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// 项目表 - 存储研学旅行项目数据
export const projects = pgTable(
  "projects",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    user_id: uuid("user_id").notNull().default(sql`auth.uid()`),
    name: varchar("name", { length: 255 }).notNull(),
    type: varchar("type", { length: 20 }).notNull(), // 'half-day' | 'one-day' | 'multi-day'
    remark: varchar("remark", { length: 1000 }),
    core_config: jsonb("core_config").notNull().$type<Record<string, unknown>>(),
    daily_expenses: jsonb("daily_expenses").notNull().$type<Record<string, unknown>[]>().default([]),
    other_expenses: jsonb("other_expenses").notNull().$type<Record<string, unknown>>(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("projects_user_id_idx").on(table.user_id),
    index("projects_created_at_idx").on(table.created_at),
  ]
);
