ALTER TABLE "Permission" ADD CONSTRAINT "Permission_code_nonempty" CHECK (length("code") > 0);
INSERT INTO "Permission" ("id","code","description") VALUES (gen_random_uuid(),'printing:read','Render authorized operational documents') ON CONFLICT ("code") DO NOTHING;
INSERT INTO "RolePermission" ("roleId","permissionId") SELECT r."id",p."id" FROM "Role" r CROSS JOIN "Permission" p WHERE r."name" IN ('administrator','pharmacist','pharmacy-technician','cashier','inventory-purchasing','accountant') AND p."code"='printing:read' ON CONFLICT DO NOTHING;
