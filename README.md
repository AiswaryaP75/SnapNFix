# SnapNFix

SnapNFix connects residents with municipal teams to report, assign, and resolve neighborhood issues using an interactive OpenStreetMap interface.

## Stack

- Frontend: React, Vite, OpenStreetMap (OpenLayers `ol`)
- Backend: Node.js, Express
- Database: MongoDB Atlas with Mongoose
- Authentication: JWT and bcrypt
- Geocoding & Maps: OpenStreetMap tiles, OpenStreetMap Nominatim API, OpenStreetMap Directions
- Photo storage: Cloudinary

## Project layout

```text
frontend/
  src/components/OpenStreetMap.jsx   OpenLayers OpenStreetMap viewer and interactive location picker
  src/App.jsx                        Dashboard, role portals, modals, and workflow handlers
  src/App.css                        Dashboard layout, role themes, and OpenStreetMap styling
  src/index.css                      Global styles and OpenLayers stylesheet (ol/ol.css)
backend/
  src/models/                        MongoDB user, issue, and audit log models
  src/routes/                        Authentication, issue lifecycle, user directory, and admin APIs
  src/middleware/                    JWT authentication, role permissions, and input security
  src/services/                      Cloudinary uploads
  src/scripts/createAdmin.js         Initial administrator seeding script
```

## Run locally

1. Install root dependencies with `npm install`, then install app dependencies with `npm install --prefix frontend` and `npm install --prefix backend`.
2. Copy `backend/.env.example` to `backend/.env`. Replace the MongoDB URI placeholders with your Atlas connection string, set a private random `JWT_SECRET`, and set the initial `ADMIN_EMAIL`, `ADMIN_NAME`, and unique `ADMIN_PASSWORD` (at least 12 characters, including letters and numbers).
3. In Atlas, create a database user, allow your development IP in Network Access, and use its connection string as `MONGODB_URI`. URL-encode special characters in the database username or password. Never commit `.env` or paste credentials into chat. Add Cloudinary credentials to `backend/.env` for report and proof photos. Copy `frontend/.env.example` to `frontend/.env` only if the API URL differs from `http://localhost:5000`.
4. Create the first administrator with `npm --prefix backend run seed:admin` (or `node backend/src/scripts/createAdmin.js`).
5. Run `npm run dev` from the project root. The frontend is served at `http://localhost:5173` and the API at `http://localhost:5000`.

## User roles & login portals

The platform provides 4 distinct role portals accessible via `/login/:role` or through the portal switcher:

- **Citizen (`/login/citizen`):**
  - Self-registration via `POST /api/auth/register` with full name, email, and password (minimum 8 characters with letter and number).
  - Report neighborhood issues by pinning locations on OpenStreetMap, using browser geolocation, or typing an address.
  - View all community reports on OpenStreetMap or filter to "My reports".
  - Track live resolution timelines, municipal notes, and worker proof-of-work photos.

- **Municipal Officer (`/login/officer`):**
  - Staff accounts provisioned by an administrator. Temporary password must be replaced on first sign-in.
  - Inspect all submitted neighborhood reports on OpenStreetMap.
  - Verify submitted reports (`PATCH /api/issues/:id/verify`).
  - Dispatch and assign verified issues to active field workers (`PATCH /api/issues/:id/assign`).

- **Field Worker (`/login/worker`):**
  - Staff accounts provisioned by an administrator. Temporary password must be replaced on first sign-in.
  - View personalized queue of assigned municipal tasks.
  - Post work feedback, update progress from `Assigned` to `In progress` or `Resolved` (`PATCH /api/issues/:id/progress`), and attach proof-of-work photos.
  - Get turn-by-turn route directions to reported issue coordinates via OpenStreetMap.

- **Administrator (`/login/admin`):**
  - Initial account seeded via `npm --prefix backend run seed:admin`.
  - Municipal Staff Directory to create officer and field worker accounts with secure temporary passwords.
  - Edit staff details, reset credentials, and toggle account activation status (revoking active sessions).
  - View system-wide security and workflow audit logs (`GET /api/admin/audit-logs`).
  - Seamless navigation between the Community Dashboard and Staff Directory via top navbar controls.

## OpenStreetMap integration

- **No Leaflet dependency:** Map rendering is powered entirely by OpenLayers (`ol`), consuming direct OpenStreetMap tile services (`https://tile.openstreetmap.org/{z}/{x}/{y}.png`) and OpenStreetMap styling (`ol/ol.css`).
- **Geotagged Issue Markers:** Reports are plotted as status-colored vector pin markers with drop shadows:
  - Blue (`#2563eb`): Submitted
  - Purple (`#7c3aed`): Verified
  - Amber (`#d97706`): Assigned
  - Orange (`#ea580c`): In progress
  - Emerald (`#059669`): Resolved
- **Interactive Tooltips & Selection:** Hovering over pins displays an OpenStreetMap overlay with ticket ID, issue title, status, and street. Clicking a pin opens full report details.
- **Dynamic Extent & Recenter:** "Recenter Map" smoothly animates the view to fit all active issue markers.
- **Interactive Location Picker (`LocationPickerMap`):** In the report modal, citizens can click directly anywhere on OpenStreetMap to drop a pin. Coordinates are captured and automatically reverse-geocoded into a human-readable street address via OpenStreetMap Nominatim.
- **OpenStreetMap Directions:** Clicking "Directions" opens routing via OpenStreetMap (`https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=...`).

## API overview

- `POST /api/auth/register`, `POST /api/auth/login`
- `PATCH /api/auth/change-password` (JWT; required for first-time staff sign-in)
- `GET /api/health`
- `GET /api/issues` (JWT; citizens see their reports or all community reports via `?scope=all`, workers see assigned work, officers see all)
- `GET /api/users/workers` (officer; returns active field worker directory for assignments)
- `GET /api/admin/staff`, `POST /api/admin/staff`, `PATCH /api/admin/staff/:id` (administrator only)
- `POST /api/issues` (citizen; multipart form with `title`, `category`, `location`, optional `description`, `lat`, `lng`, and `photo`)
- `PATCH /api/issues/:id/verify` (officer; marks issue as Verified)
- `PATCH /api/issues/:id/assign` (officer; assigns issue to active worker)
- `PATCH /api/issues/:id/progress` (assigned worker; updates status to `In progress` or `Resolved` with feedback notes and proof `photo`)
- `GET /api/issues/metrics` (JWT; returns role-scoped current metrics)
- `GET /api/admin/audit-logs` (administrator only; paginated account and workflow audit trail)

## Security and workflow notes

- Authentication attempts and API traffic are rate-limited in-process; production deployments with multiple instances should move rate limiting to a shared store.
- Passwords are bcrypt-hashed (12 salt rounds). Administrator-created staff accounts must replace their temporary password at first sign-in.
- Staff account modifications (email, role, password, active state) increment `tokenVersion`, immediately invalidating existing JWT sessions.
- Issue lifecycle is strictly enforced: `Submitted → Verified → Assigned → In progress → Resolved`. Only assigned workers can update work progress, and resolution supports proof photo attachment.
- Active worker validation prevents assigning tasks to deactivated accounts.
- Uploaded images are limited to 8 MB and checked for JPEG/PNG/GIF/WebP magic bytes before forwarding to Cloudinary (with fallback to base64 data URLs).
- Issue queries sanitize search inputs against regex injection, and issue lists are paginated.
- Dashboard metrics reflect live database counts from `/api/issues/metrics`.
- The current browser client stores access tokens in `localStorage`. For production deployments, migrate sessions to HTTP-only cookies with CSRF tokens.
- Email delivery, invitation links, and password-reset emails require an external notification provider and are not included in this repository.