# ADM0VE AI
## AI-Powered Mobile Advertising Campaign Optimization Platform

> AdMove AI ne mesure pas seulement où votre publicité circule.
> Il aide les entreprises à décider où, quand et comment elle doit circuler pour maximiser son potentiel d'exposition.

---

## Problem

Companies using vehicles as mobile advertising media can track **where**, **when**, and **how far** their vehicles travel — but this raw GPS data does **not** tell them whether their campaigns were strategically exposed in high-potential areas.

## Solution

AdMove AI transforms vehicle movement data into **marketing intelligence** through a 4-stage pipeline:

```
MEASURE → UNDERSTAND → PREDICT → OPTIMIZE
```

The platform predicts a **Potential Exposure Score** (0–100) based on available mobility, traffic, geographic, and historical data — **not** exact human view counts.

---

## Architecture

```
Frontend (Next.js)
      ↓
FastAPI-style API (Next.js API Routes)
      ↓
Database (SQLite via Prisma)
      ↓
ML Prediction Service (TypeScript)
      ↓
Prediction + Recommendation
      ↓
Frontend Dashboard
```

### Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui |
| Charts | Recharts |
| Maps | Leaflet + OpenStreetMap |
| Backend | Next.js API Routes (TypeScript) |
| Database | SQLite via Prisma ORM |
| Auth | JWT + bcrypt |
| ML | Custom TypeScript implementations (no Python dependency) |
| ML Algorithms | Linear Regression (Ridge), Decision Tree (CART), Random Forest, Gradient Boosting |
| Reports | jsPDF |

---

## Database Schema

The application uses 11 models:

- **User** — authentication with roles (ADMIN, CAMPAIGN_MANAGER, ANALYST)
- **Company** — organization profile
- **Vehicle** — advertising vehicles with GPS tracking
- **Campaign** — advertising campaigns with budget, dates, target audience
- **CampaignVehicle** — many-to-many campaign ↔ vehicle assignments
- **GpsPoint** — vehicle GPS telemetry
- **Zone** — geographic zones with traffic/frequentation indices
- **TrafficData** — hourly traffic metrics per zone
- **ExposureRecord** — estimated exposure per campaign/vehicle/zone/hour
- **Prediction** — ML model predictions
- **Recommendation** — AI-generated zone/hour recommendations
- **ModelVersion** — ML model version tracking

---

## AI / Machine Learning

### Methodology

The ML model predicts the **Potential Exposure Score** (0–100) for a vehicle/campaign in a specific zone and time.

**Target variable:** `exposure_score` (0–100)
- 0 = very low potential exposure
- 100 = very high potential exposure

### Features

| Feature | Description |
|---------|-------------|
| `zone_id` | Geographic zone identifier |
| `hour` | Hour of day (0–23) |
| `day_of_week` | Day of week (0–6) |
| `month` | Month (1–12) |
| `traffic_index` | Zone traffic intensity (0–100) |
| `pedestrian_index` | Zone pedestrian density (0–100) |
| `vehicle_index` | Zone vehicle density (0–100) |
| `average_speed` | Vehicle speed (km/h) |
| `distance` | Distance traveled (km) |
| `campaign_duration` | Campaign duration (days) |
| `target_audience_match` | Audience match score (0–100) |
| `historical_exposure` | Historical exposure trend (0–100) |
| `weather_factor` | Weather impact multiplier (0–1) |

### Dataset

> ⚠️ **Scientific Honesty:** This prototype uses **simulated training data** because real campaign exposure datasets are not publicly available. The synthetic dataset encodes realistic relationships between mobility, traffic, geographic, and temporal features with added noise so the relationship is **not** perfectly deterministic.

The dataset generator simulates:
- Time-of-day curves (peak at rush hours 8–10, 17–20)
- Day-of-week effects (weekend boost for tourist zones)
- Seasonality (summer boost for tourist zones)
- Zone category weights (commercial > tourist > mixed > business > residential > industrial)
- Weather penalties
- Realistic Gaussian noise

**Dataset size:** 10,000 records, saved to `ml/data/exposure_dataset.csv`

### Model Training

The training pipeline evaluates 4 algorithms:

| Algorithm | MAE | RMSE | R² | Train R² |
|-----------|-----|------|-----|----------|
| Linear Regression | 6.99 | 8.81 | 0.886 | 0.883 |
| Decision Tree | 6.66 | 8.94 | 0.883 | 0.947 |
| Random Forest | 5.36 | 7.01 | 0.928 | 0.965 |
| **Gradient Boosting** | **4.82** | **6.12** | **0.945** | 0.956 |

**Best model:** Gradient Boosting (R² = 0.945)

- 80/20 train/test split
- Models saved to `ml/models/model.json` and `ml/models/model_metadata.json`
- Feature importance extracted from the trained model

### Prediction API

```
POST /api/ai/predict
{
  "zone_id": 12,
  "hour": 18,
  "traffic_index": 82,
  "pedestrian_index": 76,
  "vehicle_index": 88,
  ...
}

→ {
  "predicted_exposure_score": 89.4,
  "confidence": 0.87,
  "model_version": "1.0.0"
}
```

**Predictions come from the trained ML model — never hardcoded.**

### Recommendation Engine

The system evaluates **zones × hours** combinations and ranks opportunities:

```
POST /api/ai/recommend
{ "campaignId": "...", "topN": 10 }

→ 1. Centre Ville — 17:00–19:00 — Score 92
  2. Lac 2 — 18:00–20:00 — Score 89
  3. Ariana — 17:00–18:00 — Score 84
```

Each recommendation includes a **reason** explaining why it was generated, referencing actual model inputs (traffic index, pedestrian activity, historical exposure, etc.).

---

## API Endpoints

### Authentication
- `POST /api/auth/register` — Register new user
- `POST /api/auth/login` — Login
- `GET /api/auth/me` — Get current user

### Campaigns
- `GET /api/campaigns` — List campaigns
- `POST /api/campaigns` — Create campaign
- `GET /api/campaigns/:id` — Get campaign detail + analytics
- `PUT /api/campaigns/:id` — Update campaign
- `DELETE /api/campaigns/:id` — Delete campaign

### Vehicles
- `GET /api/vehicles` — List vehicles
- `POST /api/vehicles` — Create vehicle
- `GET /api/vehicles/:id` — Get vehicle detail + GPS history
- `PUT /api/vehicles/:id` — Update vehicle
- `DELETE /api/vehicles/:id` — Delete vehicle

### Geographic
- `GET /api/zones` — List zones with stats
- `GET /api/zones/:id` — Zone detail with hourly stats
- `GET /api/gps` — GPS points (filterable)

### Analytics
- `GET /api/analytics` — KPIs + 6 chart datasets

### AI
- `POST /api/ai/predict` — ML prediction
- `POST /api/ai/recommend` — AI recommendations
- `GET /api/ai/model` — Model metrics + feature importance
- `POST /api/ai/train` — Retrain model (admin only)
- `POST /api/ai/optimize` — Campaign optimizer

### Reports
- `GET /api/reports/:campaignId` — Campaign report data

---

## Installation

### Prerequisites
- Node.js 18+ or Bun
- npm/bun package manager

### Setup

```bash
# Install dependencies
bun install

# Set up environment variables
cp .env.example .env

# Push database schema
bun run db:push

# Train the ML model (generates dataset + trains 4 models)
bun run src/lib/ml/train.ts

# Seed the database with demo data
bun run src/lib/seed.ts

# Start the development server
bun run dev
```

### Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@admove.ai | admin123 |
| Campaign Manager | manager@admove.ai | manager123 |
| Analyst | analyst@admove.ai | analyst123 |

---

## Environment Variables

```env
DATABASE_URL=file:./db/custom.db
JWT_SECRET=your-secret-key-here
```

See `.env.example` for the full template.

---

## Key Features

### Dashboard
- 6 KPI cards: Active Campaigns, Active Vehicles, Total Distance, Average Exposure, Best Zone, AI Optimization Gain
- 6 charts: Exposure over time, Distance, Traffic by zone, Exposure by zone, Campaign performance, AI prediction vs observed

### Campaign Management
- Full CRUD with vehicle assignments
- Campaign detail with analytics, top zones, top hours
- AI recommendation generation

### Vehicle Management
- Full CRUD with GPS tracking
- Vehicle detail with route history and exposure records

### Live Tracking
- Interactive Leaflet map with vehicle markers
- Route visualization
- Demo Mode simulator (auto-moving vehicles)

### Geographic Map
- 20 zones with color-coded exposure scores
- Heatmap toggle
- Zone detail panel with traffic/pedestrian/vehicle indices
- Zone ranking table

### AI Predictions
- Real ML model predictions (not hardcoded)
- Quick presets for common scenarios
- Prediction history
- Confidence scoring

### AI Recommendations
- Zone × hour optimization ranking
- AI Strategy Optimizer (current vs optimized comparison)
- Reasoning for each recommendation

### AI Model Dashboard
- Model metrics (MAE, RMSE, R²)
- Feature importance chart
- Actual vs predicted scatter plot
- Residual distribution histogram
- 4-model comparison table
- Admin-only model retraining

### Analytics
- Multi-filter (campaign, vehicle, zone, date range)
- 6 charts + sortable zone comparison table

### Reports
- Campaign performance report generation
- PDF download via jsPDF
- Includes: company, campaign, vehicles, top zones, top hours, AI recommendations, model info, limitations

---

## Privacy by Design

- ✅ Exposure figures are **estimates**, not exact counts
- ✅ No personally identifiable pedestrian information stored
- ✅ No facial recognition or identity tracking
- ✅ Only aggregate mobility data used
- ✅ Clear labeling of simulated/demo data

---

## Limitations

1. **Simulated Data:** The ML model is trained on synthetic data because real campaign exposure datasets are not publicly available.
2. **Exposure Estimates:** The platform predicts "Potential Exposure Score" — not exact human view counts.
3. **No Guaranteed ROI:** AI optimization shows "potential improvement" — not guaranteed results.
4. **SQLite Database:** Uses SQLite for local development (not PostgreSQL/PostGIS as in production architecture).

---

## Future Improvements

- Real GPS hardware integration
- Real campaign exposure data collection
- PostgreSQL + PostGIS for production
- Python FastAPI microservice for ML serving
- Computer Vision module (YOLO-based traffic counting)
- Real-time weather data integration
- Multi-tenant architecture
- Mobile app for drivers

---

## License

Prototype/Demo. All data is simulated for demonstration purposes.
