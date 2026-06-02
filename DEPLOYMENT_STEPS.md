# Backend Deployment Steps

This document is the deployment runbook for `backend-nzubia-global`. It captures the verified production setup and the minimum steps needed to release future changes safely.

## Production Topology

- The deploy workspace on the server is `/root/apps/api`.
- That server directory is not a git checkout; releases are applied by syncing build artifacts into it.
- API runs in a Docker container named `nzubia-api`.
- Database runs in a Docker container named `nzubia-mysql`.
- The live API image currently shows up as `deployment-api`.
- The production database name is `nzubia`.
- The production MySQL schema uses `utf8mb3` for existing tables such as `users`.

Release root rule:

- Only `dist/` and `package-lock.json` should remain in `/root/apps/api`.
- The container is refreshed by copying the new `dist/` tree into `nzubia-api` and restarting it.
- Do not copy `package.json` or `Dockerfile` into the server release root.

## What To Do Before Deploying

1. Pull the latest code changes in the backend repo.
2. Run the backend build locally.
3. Run or add tests for the changed area when possible.
4. If the change adds or alters database tables, create a TypeORM migration instead of relying on `synchronize`.
5. Verify that any new tables or foreign keys match the live MySQL schema types and charset.

## Local Release Checklist

1. Install dependencies.
2. Build the backend.
3. Review the generated `dist` output only if you need to confirm the build result.
4. Make sure the application still starts with the production configuration variables.
5. Confirm any new DB migration files are present under `src/migrations/`.

Typical checks:

```bash
npm install
npm run build
npm run test
```

If you need to inspect the generated production bundle locally:

```bash
npm run start:prod
```

If the app fails to start locally, fix that before deploying.

## Database Changes

For schema changes, follow this pattern:

1. Add or update the entity definitions.
2. Create a migration under `src/migrations/`.
3. Keep the migration idempotent where possible.
4. Match existing production column types, especially primary key and timestamp types.
5. Match the existing production charset/collation if you are creating new tables.

Important production note:

- The live `users.id` column is `varchar(36)`.
- The live MySQL tables use `utf8mb3`.
- Foreign keys can fail if the new table charset or key type does not match production.

## Deployment Steps

Use the following sequence for a normal code release:

1. Commit or stage the backend changes you want to release.
2. Build the backend locally to confirm it still compiles.
3. Sync the release artifacts to `/root/apps/api/dist/` and `/root/apps/api/package-lock.json` on the server.
4. Copy the updated dist tree into the running `nzubia-api` container.
5. Restart the container.
6. Verify the app started cleanly.
7. Run a smoke test against the changed endpoint.

Suggested command flow:

```bash
# 1) local validation
cd /Users/lawrence/Developments/Nzubia/backend-nzubia-global
npm install
npm run build
npm run test

# 2) sync release artifacts to the server
rsync -az --delete \
	dist/ \
	root@165.232.40.77:/root/apps/api/dist/

rsync -az \
	package-lock.json \
	root@165.232.40.77:/root/apps/api/

# 3) refresh the running container from the updated dist tree
ssh root@165.232.40.77 'docker cp /root/apps/api/dist/. nzubia-api:/app/dist/ && docker restart nzubia-api'

# 4) check the container and logs
ssh root@165.232.40.77 'docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"'
ssh root@165.232.40.77 'docker logs --tail 100 nzubia-api'

# 5) smoke test the API from the server
ssh root@165.232.40.77 'curl -i --max-time 10 http://127.0.0.1:3000/api/v1/p2p/routes/feed'
```

If the deployment system runs TypeORM migrations on startup, keep `migrationsRun: true` enabled in the TypeORM config and ensure the migration files are included in the build output.

If migrations do not run automatically, run the container once after build and inspect the logs. The app should create or apply the schema during startup if the migration is bundled correctly.

```bash
ssh root@165.232.40.77 'docker logs --tail 200 nzubia-api'
```

If you add a manual migration command in the future, document it here and keep it consistent across releases.

## Smoke Test

After deployment, verify the service responds as expected.

Example checks:

```bash
curl -i --max-time 10 http://127.0.0.1:3000/api/v1/p2p/routes/feed
curl -i --max-time 10 http://127.0.0.1:3000/api/v1/p2p/routes
curl -i --max-time 10 http://127.0.0.1:3000/api/v1/platform-settings
```

Expected result:

- `401 Unauthorized` if the endpoint is protected and no token is provided.
- `200 OK` with a valid token and seeded data.
- Not `500 Internal Server Error`.

Also check the container status and recent logs:

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"
docker logs --tail 100 nzubia-api
```

## If A Schema Change Breaks Production

1. Check the live MySQL error first.
2. Verify whether the table exists.
3. Verify that the table charset and foreign key column types match the parent tables.
4. Apply the missing table or migration.
5. Retry the smoke test.

Helpful live debugging commands:

```bash
ssh root@165.232.40.77
docker ps
docker logs --tail 200 nzubia-api
docker exec nzubia-mysql mysql -uroot -ppassword -e "USE nzubia; SHOW TABLES LIKE 'p2p%';"
docker exec nzubia-mysql mysql -uroot -ppassword -e "USE nzubia; SHOW CREATE TABLE users;"
docker inspect nzubia-api --format 'Image={{.Config.Image}} Restart={{.HostConfig.RestartPolicy.Name}} Ports={{json .HostConfig.PortBindings}}'
```

## Rollback

If a release causes issues:

1. Revert the deployed image or tag to the previous known-good version.
2. Restart the API container.
3. Leave the database migration in place unless the migration itself is the problem.
4. If the migration is the problem, create a corrective migration rather than editing applied production schema by hand.

## Notes For Future Releases

- Keep deployment changes small and documented in the same repo.
- Prefer migrations for all schema changes.
- Avoid turning on global `synchronize` in production.
- Add a smoke test for any endpoint whose behavior changed.
- Update this file whenever the deployment process changes.
