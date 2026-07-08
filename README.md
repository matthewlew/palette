# 🎨 Palette

A premium, interactive aesthetic gradient playground and generator built with React 19, TypeScript, Vite, and Zustand. 

👉 **[Live Demo on GitHub Pages](https://matthewlew.github.io/palette/)**

---

## 🌟 Key Features

* **Physics-Driven Scrub Feed:** Smoothly scroll and scrub through generated gradients using custom momentum/velocity decay physics and touch-friendly gestures.
* **Curated Color Generators:** Gradients are created by applying OKLCH-jittering algorithms to carefully calibrated color palettes for perceptually smooth transitions.
* **Diverse Geometry Types:** View, edit, and export gradients in multiple spatial layouts:
  * Linear
  * Radial
  * Angular (Conic)
  * Layered "Turrell Squares"
* **Film Grain & Texture:** Apply realistic film grain filters and noise overlays to give digital colors a warm, tactile feel.
* **Visual Stop-Level Editor:** Modify stops directly on the gradient canvas with a drag-and-drop workspace:
  * **SwatchTray:** Interactive 36-color swatch drawer for tap-to-add/remove and drag-to-insert actions.
  * **Live Reordering:** Instant visual reindexing and gap rendering during drag-reorder events.
* **State Persistence & Board Sharing:**
  * Auto-persisting saved gradients drawer.
  * Share-link URL fragment codec for exporting single gradients or entire boards.
  * Deterministic name generator that crafts names from hex values using a custom word bank.
  * JSON export and import capabilities.

---

## 🛠️ Tech Stack

* **Core:** React 19, TypeScript, Vanilla CSS (with glassmorphism and modern viewport units).
* **State Management:** Zustand with local storage persistence.
* **Build Tools:** Vite, Oxlint.
* **Testing:** Vitest with jsdom (fully covered suite of 820+ unit and component tests).

---

## 🚀 Getting Started

### Prerequisites

* Node.js (version 22 recommended)
* npm

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/matthewlew/palette.git
   cd palette
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```
   Open your browser to the local URL (usually `http://localhost:5173`).

### Running Tests

Execute the Vitest suite:
```bash
npm test
```

---

## 📦 Deployment

The project is configured for zero-config CI/CD. Pushing to the `main` branch triggers the GitHub Actions workflow in [.github/workflows/deploy.yml](file:///.github/workflows/deploy.yml) which:
1. Installs dependencies (`npm ci`).
2. Runs the full test suite (`npm test`).
3. Compiles the production bundle (`npm run build`).
4. Deploys the static output to **GitHub Pages**.
