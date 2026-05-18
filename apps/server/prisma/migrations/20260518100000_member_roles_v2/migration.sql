-- v0.78 #17 phase 1: extend MemberRole taxonomy.
--
-- 4 → 10 ролей. Новые роли — hierarchical operational identity, не
-- permission overrides. Permissions managed через hasPermission()
-- helper в коде (lib/permissions.ts), не БД.
--
-- Phase 2 (future) — full RBAC с custom roles per workspace
-- (Role/RolePermission tables, Member.roleId references Role).
--
-- ALTER TYPE ADD VALUE — separate transactions, Prisma migrate разводит.
-- Order не важен для функциональности; новые роли appended.

ALTER TYPE "MemberRole" ADD VALUE 'ARCHITECT';
ALTER TYPE "MemberRole" ADD VALUE 'DEVELOPER';
ALTER TYPE "MemberRole" ADD VALUE 'OPERATOR';
ALTER TYPE "MemberRole" ADD VALUE 'CLIENT';
ALTER TYPE "MemberRole" ADD VALUE 'VIEWER';
ALTER TYPE "MemberRole" ADD VALUE 'GUEST';
