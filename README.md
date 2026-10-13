# SnapNFix

SnapNFix connects residents with municipal teams to report, assign, and resolve neighborhood issues.

## Stack

- Frontend: React, Vite, OpenStreetMap (OpenLayers)
- Backend: Node.js, Express
- Database: MongoDB Atlas with Mongoose
- Authentication: JWT and bcrypt
- Photo storage: Cloudinary

## Project layout

```text
frontend/                 React app and map dashboard
backend/src/models/       MongoDB user and issue models
backend/src/routes/       Authentication and issue lifecycle APIs
backend/src/middleware/   JWT authentication and role permissions
backend/src/services/     Cloudinary uploads
```

## Run locally

1. Install root dependencies with `npm install`, then install app dependencies with `npm install --prefix frontend` and `npm install --prefix backend`.
2. Copy `backend/.env.example` to `backend/.env`. Replace the MongoDB URI placeholders with your Atlas connection string, set a private random `JWT_SECRET`, and set the initial `ADMIN_EMAIL`, `ADMIN_NAME`, and unique `ADMIN_PASSWORD` (at least 12 characters).
3. In Atlas, create a database user, allow your development IP in Network Access, and use its connection string as `MONGODB_URI`. URL-encode special characters in the database username or password. Never commit `.env` or paste credentials into chat. Add Cloudinary credentials to `backend/.env` for report and proof photos. Copy `frontend/.env.example` to `frontend/.env` only if the API URL differs from `http://localhost:5000`.
4. Create the first administrator with `npm --prefix backend run seed:admin`. Run `npm run dev` from the project root. The frontend is served at `http://localhost:5173` and the API at `http://localhost:5000`.

The map dashboard opens in demo mode with sample West Village reports. Authentication and issue persistence require the backend environment above. Sign-in routes are `/login/citizen`, `/login/officer`, `/login/worker`, and `/login/admin`. Citizen registration is available through `POST /api/auth/register` with `name`, `email`, and `password`; officer and worker accounts must be provisioned by an administrator.

The API loads configuration from `backend/.env` and waits for MongoDB to connect before listening. The first administrator is seeded from the local environment variables. Sign in at `/login/admin` to create staff accounts, edit staff names/emails/roles, reset passwords, or deactivate/reactivate access. Passwords are stored as bcrypt hashes and are never displayed; distribute temporary passwords securely. Changing a staff password, email, role, or active state revokes their existing sessions. Rotate the Atlas database user's password and Cloudinary API secret if they were previously stored in a tracked file.

## API overview

- `POST /api/auth/register`, `POST /api/auth/login`
- `GET /api/health`
- `GET /api/issues` (JWT; citizens see their reports, workers see assigned work, officers see all)
- `GET /api/users/workers` (officer; worker directory for assignments)
- `GET /api/admin/staff`, `POST /api/admin/staff`, `PATCH /api/admin/staff/:id` (administrator only)
- `POST /api/issues` (citizen; multipart form with `title`, `category`, `location`, optional `description`, `lat`, `lng`, and `photo`)
- `PATCH /api/issues/:id/verify` and `PATCH /api/issues/:id/assign` (officer)
- `PATCH /api/issues/:id/progress` (assigned worker; resolving requires a proof `photo`)
- `GET /api/issues/metrics` (JWT; returns role-scoped current metrics)
- `GET /api/admin/audit-logs` (administrator only; paginated account and workflow audit trail)

## Security and workflow notes

- Authentication attempts and API traffic are rate-limited in-process; production deployments with multiple instances should move rate limiting to a shared store.
- Passwords are bcrypt-hashed. Administrator-created staff accounts must replace their temporary password at first sign-in.
- Staff account changes increment `tokenVersion`, revoking existing sessions.
- Issue transitions are enforced by the API: `Submitted → Verified → Assigned → In progress → Resolved`. A worker can only update a report assigned to that worker, and resolution requires a proof image.
- Uploaded images are limited to 8 MB and the server checks JPEG/PNG/GIF/WebP file signatures before sending them to Cloudinary.
- Issue search is regex-escaped and issue lists are paginated.
- Dashboard statistics come from `/api/issues/metrics`; they are no longer fixed demo values.
- The current browser client still stores the access token in `localStorage`. For a production deployment, move the session to an HTTP-only cookie with an appropriate CSRF strategy before launch.
- Email verification, invitation delivery, password-reset email delivery, and external notification delivery still require an email/notification provider and are not yet wired into this repository.