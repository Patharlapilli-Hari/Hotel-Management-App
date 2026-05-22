# HostelHub — Room Allocation & Complaint Management System

A centralized **Hostel Room Allocation & Complaint Management System** built with:
- **Frontend**: ReactJS + TypeScript + Vite (Vanilla CSS, Premium Dark UI)
- **Backend**: Node.js + Express (ES Modules)
- **Database**: SQLite (via `sqlite` + `sqlite3`)

---

## 🚀 Quick Start

### Prerequisites
- Node.js v18+ and npm v9+

### 1. Install Dependencies

```bash
# Install backend dependencies
cd packages/backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Start the Backend Server

```bash
cd packages/backend
npm run dev
```
Backend starts on **http://localhost:5050**

> First launch auto-creates the SQLite database (`hostel.db`) and seeds test data.

### 3. Start the Frontend Dev Server

```bash
cd packages/frontend
npm run dev
```
Frontend starts on **http://localhost:5173**

---

## 👥 Role-Based Access

The app features a **Floating Role Switcher** widget (top-right) to toggle between:

| Role | Username | Capabilities |
|------|----------|-------------|
| **Admin** | `admin` | Full access — all dashboards, rooms, allocations, maintenance |
| **Warden** | `warden_alice` | Create rooms, allocate/transfer students |
| **Maintenance** | `maint_elec` | Update complaint statuses, log actions |
| **Student** | `student_john` | Submit complaints, track tickets, view allocations |

---

## 🗂️ Project Structure

```
experiment2/
├── package.json                  # Root monorepo config
├── packages/
│   ├── backend/
│   │   ├── .env                  # PORT=5050, DATABASE_FILE=./hostel.db
│   │   ├── package.json
│   │   └── src/
│   │       ├── db.js             # SQLite schema + seed data
│   │       └── server.js         # Express REST API
│   └── frontend/
│       ├── index.html
│       ├── vite.config.ts        # Proxy → localhost:5050
│       ├── package.json
│       └── src/
│           ├── main.tsx
│           ├── App.tsx           # Role switcher, sidebar, routing
│           ├── index.css         # Premium Vanilla CSS design system
│           ├── components/
│           │   └── Toast.tsx     # Animated notifications
│           └── pages/
│               ├── Dashboard.tsx          # Analytics overview
│               ├── RoomsList.tsx          # Hostel room cards + create modal
│               ├── Allocations.tsx        # Assign/transfer rooms + CSV export
│               ├── ComplaintSubmit.tsx    # Student complaint form
│               ├── ComplaintTracking.tsx  # Complaint timeline
│               └── MaintenancePortal.tsx  # Staff work orders + CSV export
```

---

## 🌐 REST API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/users` | List users (filter by `?role=student`) |
| `POST` | `/api/users` | Create a new user |
| `POST` | `/api/hostel-rooms` | Create hostel room record |
| `GET` | `/api/hostel-rooms` | List rooms (filters: `block_name`, `room_type`, `occupancy_status`) |
| `POST` | `/api/room-allocations` | Allocate room to student |
| `PUT` | `/api/room-allocations/:id/transfer` | Transfer student to different room |
| `GET` | `/api/room-allocations` | List all allocations |
| `POST` | `/api/complaints` | Submit hostel complaint |
| `GET` | `/api/complaints` | Fetch complaints (filters: `category_id`, `status`, `student_id`) |
| `GET` | `/api/complaint-categories` | List complaint categories |
| `PUT` | `/api/complaints/:id/status` | Update complaint status + write maintenance log |
| `GET` | `/api/dashboard/summary` | Hostel analytics summary |

---

## 🗄️ Database Tables (SQLite)

| Table | Purpose |
|-------|---------|
| `users` | Students, wardens, maintenance staff, admins |
| `hostel_rooms` | Room records with capacity and occupancy |
| `room_allocations` | Student-room assignment records |
| `complaint_categories` | Electricity, Water, Cleanliness, Internet, Maintenance |
| `complaints` | Hostel complaint tickets |
| `maintenance_logs` | Resolution activity history per complaint |

---

## ✨ Features

- ✅ **Role-based UI** with floating switcher for easy demo
- ✅ **Room creation** (Warden/Admin) with block, type, capacity
- ✅ **Room allocation** with duplicate/full-room prevention
- ✅ **Room transfers** via atomic SQLite transaction
- ✅ **Complaint filing** with category + priority
- ✅ **Complaint tracking timeline** (Open → In Progress → Resolved → Closed)
- ✅ **Maintenance work portal** with action logging
- ✅ **Analytics dashboard** with occupancy bar charts
- ✅ **Downloadable CSV reports** (allocations + complaints)
- ✅ **Toast notifications** for all key events
- ✅ **Pre-seeded test data** for immediate demo

---

## 🔧 Environment Variables

**`packages/backend/.env`**
```
PORT=5050
DATABASE_FILE=./hostel.db
```
