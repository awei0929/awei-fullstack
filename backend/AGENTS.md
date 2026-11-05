# Project guidance

This is a local NestJS learning project for a developer with frontend experience.

- Keep lessons focused on Controller, Service, Module, GET/POST/PUT/DELETE tasks, and cross-module task statistics.
- Explain backend decorators and request validation using Chinese comments; the user already knows frontend development.
- Editing and deletion take the id from the URL and validate it with ParseUUIDPipe; EditTaskDto validates only the title body.
- Missing tasks return 404. Deletion returns the removed task with status 200.
- StatsModule imports TasksModule and SystemModule, then injects their exported services through separate constructor parameters; do not re-register those services in StatsModule.
- Tasks are stored in memory; restarting the backend resets them.
- Add MongoDB and Docker integration only in a later lesson requested by the user.
- Use ESM imports with .js extensions for local TypeScript modules.
- Run npm test to build and check the actual HTTP API.
