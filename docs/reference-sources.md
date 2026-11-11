# Reference sources

- Website: https://hyperautocare.framer.website/
- Inspection date: 2026-10-30.
- Original asset URLs and route inventory: `../reference/source-manifest.json`.
- Public Logo Spectrum shader: https://framerusercontent.com/modules/I22n4QdurBc6QkKK5QWM/GofSZVmNMLDQqprXB0qq/LogoSpectrum.js
- Public Liquid Gradient shader: https://framerusercontent.com/modules/QEytd7xyjUsL7yuVUzSs/6qTRmKugUnmuF6ve5K4I/LiquidGradient.js

Fragment source is retained in `public/effects/`. The Next.js application uses a local WebGL2 renderer instead of the Framer shader runtime. The logo heightmap is generated locally from the original SVG. Original shader fallback images are retained alongside the fragment source.

Implementation references: [Next.js App Router](https://nextjs.org/docs/app), [Motion for React](https://motion.dev/docs/react).
