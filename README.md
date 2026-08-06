# SupportFlow - Enterprise IT Support & Endpoint Management Platform

**SupportFlow** is a production-ready enterprise-grade IT Support & Endpoint Management Platform. It integrates real-time Windows system metrics, security diagnostics, LAN subnet scanning, and a complete ticket and asset management workflow.

---

## Technical Architecture

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Framer Motion, Recharts, TanStack Query, React Router, React Hook Form, Lucide Icons.
- **Backend**: Python 3.11+, FastAPI, SQLAlchemy, Pydantic, JWT Authentication, WebSockets, APScheduler.
- **Database**: PostgreSQL (Production) / SQLite (Fallback for zero-configuration local development).
- **Diagnostics Exporters**: ReportLab (PDF), Pandas (CSV/Excel).

---

## Seed Accounts (Lab Credentials)

Default internal lab accounts automatically created on server startup:

| Role | Email | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@supportflow.com` | `Admin123!` | Full control: systems, roles, assets, tickets, reports. |
| **Technician** | `tech@supportflow.com` | `Tech123!` | System diagnostics, resolve alerts, assign tickets. |
| **Viewer** | `viewer@supportflow.com` | `Viewer123!` | Read-only metrics, submit tickets, view own history. |

---

## Local Windows Installation Guide

### Prerequisites
1. **Python 3.11+** installed (add to PATH).
2. **Node.js v20+** and **npm** installed.
3. Administrative shell access (required for Windows Defender, Firewall, and Windows Update WMI queries).

### 1. Backend Setup
Navigate to the backend directory, create a virtual environment, and install dependencies:

```powershell
# Open shell as Administrator
cd backend
python -m venv venv
.\venv\Scripts\activate

# Install requirements
pip install -r requirements.txt

# Start backend server
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
*Note: The server will automatically create `supportflow.db` local SQLite database if no external PostgreSQL connection is configured.*

### 2. Frontend Setup
Navigate to the frontend directory, install npm packages, and start Vite:

```powershell
cd ../frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## Docker Compose Setup

To deploy the entire environment (FastAPI + React SPA + PostgreSQL database server) in one command:

```bash
docker compose up --build -d
```
- **React Frontend SPA**: served at `http://localhost:3000`
- **FastAPI Documentation (Swagger)**: served at `http://localhost:8000/docs`
- **PostgreSQL Database**: runs on `localhost:5432`

---

## Testing

Run the automated backend test suite using `pytest`:

```powershell
cd backend
pytest tests/
```
