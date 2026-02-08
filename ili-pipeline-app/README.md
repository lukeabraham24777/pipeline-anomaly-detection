# ILI Pipeline Inspector

Automated In-Line Inspection (ILI) data alignment and corrosion growth prediction system. Built for the TidalHack 2026 hackathon.

## What It Does

Pipeline operators use "smart pigs" (ILI tools) to inspect pipelines for anomalies like corrosion, dents, and cracks. When a pipeline is inspected multiple times, the datasets don't automatically align due to **odometer drift** -- the distance measurement wheels on these tools slip, causing the same physical anomaly to appear at different reported locations in each run.

This application:

1. **Ingests 3 ILI inspection XLSX files** from different years
2. **Aligns odometer readings** by matching reference points (girth welds, valves) and applying piecewise linear distance correction
3. **Detects pipe section replacements** where sections have been cut out and replaced
4. **Matches anomalies across runs** using the Hungarian algorithm with multi-metric similarity scoring (distance, dimensions, clock position, feature type)
5. **Calculates growth rates** with linear regression across 3 data points and predicts time-to-critical
6. **Classifies priority** per PHMSA 49 CFR 192/195 and ASME B31.8S federal regulations (IMMEDIATE, 60-DAY, 180-DAY, SCHEDULED, MONITOR)
7. **Visualizes the pipeline on an interactive map** with color-coded anomaly markers
8. **Provides AI-powered analysis** via Google Gemini for uncertain matches and pipeline health insights
9. **Shows odometer drift trends** across inspection years, alerting when recalibration is needed

## Tech Stack

- **React 19 + TypeScript + Vite** -- frontend framework
- **Tailwind CSS** -- styling
- **Mapbox GL JS** via react-map-gl -- interactive pipeline map
- **Recharts** -- odometer drift and growth trend charts
- **SheetJS (xlsx)** -- client-side XLSX parsing
- **Zustand** -- state management
- **TanStack Table** -- sortable/filterable anomaly list
- **Google Gemini 2.0 Flash** -- AI-assisted match analysis and insights

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Setup

```bash
# Clone and install
cd ili-pipeline-app
npm install

# Configure API keys (optional but recommended)
cp .env.example .env
# Edit .env and add your keys:
#   VITE_MAPBOX_TOKEN=your_mapbox_token    (free at mapbox.com)
#   VITE_GEMINI_API_KEY=your_gemini_key    (free at aistudio.google.com)

# Start development server
npm run dev
```

The app works without API keys -- the map will show a summary fallback, and AI features will display a setup prompt. Add keys for the full experience.

### Usage

1. Open the app at `http://localhost:5173`
2. Upload 3 XLSX inspection files (one per year/run)
3. Set the inspection years for each file
4. Click "Analyze Pipeline Data"
5. Explore the dashboard: map, anomaly list, drift charts, AI insights

## Architecture

All processing happens **client-side in the browser** -- no backend server needed.

```
Upload XLSX → Parse → Normalize → Align References → Correct Distances →
Match Anomalies (Hungarian) → Calculate Growth → Classify Priority (PHMSA) →
Assign GPS → Render Dashboard
                                    ↓ (uncertain matches)
                              Gemini AI Analysis
```

### Key Algorithms

- **Reference Point Matching**: Matches girth welds/valves between runs using distance proximity + joint numbers
- **Piecewise Linear Distance Correction**: Corrects odometer drift between each pair of matched reference points
- **Hungarian Algorithm**: Optimal one-to-one anomaly matching across runs
- **Multi-Metric Similarity**: Weighted combination of distance (40%), dimensions (30%), clock position (20%), feature type (10%)
- **Linear Regression**: Fits growth trends across 3 data points for depth/length/width prediction

### Priority Classification (PHMSA 49 CFR 192/195)

| Priority | Criteria | Regulation |
|----------|----------|------------|
| IMMEDIATE | depth >= 80% WT, time-to-critical <= 1yr, growth > 8%/yr | 49 CFR 192.485 |
| 60-DAY | depth >= 60% WT, growth > 5%/yr, TTC < 3yr | ASME B31.8S Table 4 |
| 180-DAY | depth >= 40% WT, growth > 2%/yr | ASME B31.8S Table 4 |
| SCHEDULED | depth >= 20% WT | 49 CFR 192.485(c) |
| MONITOR | depth < 20%, minimal growth | 49 CFR 192.485(d) |

## Project Structure

```
src/
  lib/
    parsing/       # XLSX parsing, validation, normalization
    alignment/     # Reference matching, distance correction, drift
    matching/      # Similarity scoring, Hungarian algorithm
    analysis/      # Growth rates, PHMSA priority, predictions
    gemini/        # Gemini AI client, mismatch analysis, insights
  components/
    map/           # Mapbox pipeline map with anomaly markers
    dashboard/     # Metrics, anomaly list, profile, drift chart
    upload/        # File upload with drag-drop and preview
    ai/            # Gemini insights panel
  store/           # Zustand state management
  types/           # TypeScript interfaces
  data/            # Demo pipeline coordinates, GPS interpolation
```

## License

MIT
