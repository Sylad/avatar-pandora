# Eywa V2 — Cinema landing + WebGL ambient + Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Eywa from a static codex into a cinematic, immersive Pandora experience: full-page WebGL particle field, scroll-driven camera + color shifts through 5 scene-zones (forest → Hometree → floating mountains → Metkayina ocean → Fire & Ash volcano), typographic reveals via GSAP, ending on the Eywa logo + codex CTAs. Add a minimal NestJS backend providing `/api/wiki-image` proxy as the foundation for Plan 3 content.

**Architecture:** Full-page `<canvas>` (R3F) fixed-positioned behind page content. A volumetric particle field (3-5k instanced points, drifting ambient) is the unified visual element — its **uniforms** (primary color, secondary color, density factor, camera Z) are driven by ScrollTrigger keyframes that map scroll position to scene-zone state. HTML typography overlays scene by scene, fading via GSAP. The cinematic landing replaces V1's static `index.astro`. Codex pages (`/pandora`, `/clans`, etc.) remain unchanged from Plan 1. Backend NestJS minimal: standalone service on port 3003 with one HTTP module (wiki-image proxy + 30-day local file cache), TDD-backed.

**Tech Stack:** @react-three/fiber 9, @react-three/drei 10, three 0.170, gsap 3.12 (with ScrollTrigger), NestJS 11, axios, vitest (or jest) for backend tests.

**Repo paths:** Local source `/home/sylvain_ladoire/projects/developpeur/avatar-pandora/`, NAS deploy `/volume2/docker/developpeur/avatar-pandora/`. Sync via `rsync --rsync-path=/usr/bin/rsync` per `wsl_environment.md` memory.

**Wow targets (so we know we hit "effet wahou"):**

- Black opening screen with cyan tagline that types itself in 1.5s.
- Particle density that grows from ~0% to 100% over the first 30% of scroll.
- 5 distinct color washes that transition smoothly (no jump cuts) — each scene "reads" as a different mood at first glance.
- Camera movement that feels like falling/floating, not panning a static field.
- Final logo reveal where the EVA-in-EYWA letters pulse one extra notch before the page settles.
- Buttery-smooth on a 2020 laptop @ 60fps; downgraded but functional on phone.

---

## File structure (target after V2)

```
avatar-pandora/
├── docker-compose.yml             ← MODIFIED (add eywa-backend service + nginx /api route)
├── frontend/
│   ├── nginx.conf                 ← MODIFIED (add /api → eywa-backend proxy)
│   └── src/
│       ├── components/
│       │   └── cinema/            ← NEW — all R3F/GSAP island lives here
│       │       ├── CinemaCanvas.tsx
│       │       ├── ParticleField.tsx
│       │       ├── particles.shader.ts
│       │       ├── scene-timeline.ts
│       │       └── useReducedMotion.ts
│       └── pages/
│           └── index.astro        ← MODIFIED (replaces V1 with cinema island)
└── backend/                       ← NEW
    ├── package.json
    ├── tsconfig.json
    ├── tsconfig.build.json
    ├── nest-cli.json
    ├── Dockerfile
    ├── .env.example
    └── src/
        ├── main.ts
        ├── app.module.ts
        ├── health/
        │   ├── health.controller.ts
        │   └── health.controller.spec.ts
        └── wiki-image/
            ├── wiki-image.module.ts
            ├── wiki-image.controller.ts
            ├── wiki-image.service.ts
            └── wiki-image.service.spec.ts
```

## Verification approach

- **Backend tasks** — proper TDD. `vitest` (or `jest`) tests for the wiki-image service mocking axios, and a small integration check via `supertest`.
- **WebGL/animation tasks** — visual eyeballing on the deployed NAS:4203 + smoke checks (build clean, canvas element present, `prefers-reduced-motion` respected, FPS reasonable in dev tools). No unit tests on R3F components — that path doesn't add signal.

## Git author

Same as Plan 1: always `git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" commit -m "..."`. Never modify global config.

---

## Phase A — Backend (Tasks 1-4)

This phase delivers a minimal NestJS service with one purpose: proxy Wikipedia image lookups for Plan 3 content. It can be merged & deployed independently of the WebGL phase. Pattern is intentionally identical to ol-companion's wiki-image service so future Claude sessions cross-reference cleanly.

### Task 1: Backend scaffold (NestJS minimal, port 3003)

**Files to create:**
- `backend/package.json`
- `backend/tsconfig.json`, `backend/tsconfig.build.json`
- `backend/nest-cli.json`
- `backend/.env.example`
- `backend/src/main.ts`
- `backend/src/app.module.ts`
- `backend/src/health/health.controller.ts`
- `backend/src/health/health.controller.spec.ts`

**Steps:**

- [ ] **Step 1.1: Bootstrap NestJS minimally without the CLI**

The Nest CLI is heavy and overlaps with patterns the user already validated on warhammer/ol. We hand-write the minimum.

Create `backend/package.json`:

```json
{
  "name": "eywa-backend",
  "version": "0.1.0",
  "private": true,
  "engines": { "node": ">=22.12.0" },
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "start": "node dist/main.js",
    "start:dev": "ts-node-dev --respawn --transpile-only src/main.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@nestjs/common": "^11.0.0",
    "@nestjs/core": "^11.0.0",
    "@nestjs/platform-express": "^11.0.0",
    "axios": "^1.7.0",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "@types/supertest": "^6.0.2",
    "supertest": "^7.0.0",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 1.2: Install deps**

```bash
nvm use 22
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora/backend
npm install
```

Expected: clean install, no peer dep warnings critical enough to fail.

- [ ] **Step 1.3: tsconfig + Nest config**

Create `backend/tsconfig.json`:

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": false,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "target": "ES2022",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": true,
    "forceConsistentCasingInFileNames": true,
    "noImplicitAny": false,
    "strictBindCallApply": false,
    "noFallthroughCasesInSwitch": false
  },
  "include": ["src/**/*"]
}
```

Create `backend/tsconfig.build.json`:

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "dist", "**/*.spec.ts"]
}
```

Create `backend/nest-cli.json`:

```json
{ "collection": "@nestjs/schematics", "sourceRoot": "src" }
```

- [ ] **Step 1.4: main.ts + app.module.ts**

Create `backend/src/main.ts`:

```ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({ origin: process.env.CORS_ORIGIN ?? true });
  const port = Number(process.env.PORT ?? 3003);
  await app.listen(port, '0.0.0.0');
  console.log(`Eywa backend listening on http://0.0.0.0:${port}/api`);
}
bootstrap();
```

Create `backend/src/app.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';

@Module({
  controllers: [HealthController],
})
export class AppModule {}
```

- [ ] **Step 1.5: Health controller (with TDD)**

Test first — create `backend/src/health/health.controller.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns ok with a timestamp', () => {
    const ctrl = new HealthController();
    const result = ctrl.check();
    expect(result.status).toBe('ok');
    expect(typeof result.timestamp).toBe('string');
    expect(new Date(result.timestamp).toString()).not.toBe('Invalid Date');
  });
});
```

Run it (will fail):

```bash
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora/backend
npm test
```

Expected: FAIL — `health.controller` not found.

Create `backend/src/health/health.controller.ts`:

```ts
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
```

Re-run tests:

```bash
npm test
```

Expected: 1 passed.

- [ ] **Step 1.6: Manual smoke check**

```bash
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora/backend
npm run build
npm start &
BACK_PID=$!
sleep 3
curl -s http://localhost:3003/api/health
kill $BACK_PID
```

Expected: `{"status":"ok","timestamp":"..."}`.

- [ ] **Step 1.7: Commit**

```bash
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" add backend/
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" commit -m "feat(backend): NestJS minimal scaffold + /api/health endpoint with vitest

Bootstraps the eywa-backend service on port 3003 with global /api prefix
and CORS open. Health endpoint TDD-tested. Ready to host the wiki-image
proxy in Task 2.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Wiki-image proxy module (TDD)

**Goal:** `GET /api/wiki-image?q=Neytiri` returns the resolved Wikipedia image URL (binary streamed) or 404. Cached on disk for 30 days under `data/wiki-cache/<sha256(q)>.bin` to avoid repeat lookups.

**Files to create:**
- `backend/src/wiki-image/wiki-image.module.ts`
- `backend/src/wiki-image/wiki-image.service.ts`
- `backend/src/wiki-image/wiki-image.service.spec.ts`
- `backend/src/wiki-image/wiki-image.controller.ts`
- Modify: `backend/src/app.module.ts`

**Steps:**

- [ ] **Step 2.1: Spec the service first**

Create `backend/src/wiki-image/wiki-image.service.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { WikiImageService } from './wiki-image.service';

vi.mock('axios');
const axiosMock = axios as unknown as { get: ReturnType<typeof vi.fn> };

describe('WikiImageService', () => {
  beforeEach(() => {
    axiosMock.get = vi.fn();
  });

  it('resolves the original image URL for a known title', async () => {
    axiosMock.get.mockResolvedValueOnce({
      data: {
        query: {
          pages: {
            '42': {
              original: { source: 'https://upload.wikimedia.org/foo.jpg' },
            },
          },
        },
      },
    });
    const svc = new WikiImageService();
    const url = await svc.resolveImageUrl('Neytiri');
    expect(url).toBe('https://upload.wikimedia.org/foo.jpg');
  });

  it('returns null when wikipedia has no original image', async () => {
    axiosMock.get.mockResolvedValueOnce({
      data: { query: { pages: { '-1': { missing: true } } } },
    });
    const svc = new WikiImageService();
    const url = await svc.resolveImageUrl('NotARealThing12345');
    expect(url).toBeNull();
  });

  it('encodes the query in the wikipedia API call', async () => {
    axiosMock.get.mockResolvedValueOnce({
      data: { query: { pages: {} } },
    });
    const svc = new WikiImageService();
    await svc.resolveImageUrl("Avatar : la voie de l'eau");
    expect(axiosMock.get).toHaveBeenCalledWith(
      expect.stringContaining('Avatar%20%3A%20la%20voie%20de%20l%27eau'),
      expect.any(Object),
    );
  });
});
```

- [ ] **Step 2.2: Run failing tests**

```bash
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora/backend
npm test
```

Expected: FAIL — service does not exist yet.

- [ ] **Step 2.3: Implement service**

Create `backend/src/wiki-image/wiki-image.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class WikiImageService {
  async resolveImageUrl(query: string): Promise<string | null> {
    const url =
      'https://fr.wikipedia.org/w/api.php?' +
      'action=query&format=json&prop=pageimages&piprop=original&titles=' +
      encodeURIComponent(query);
    const res = await axios.get(url, {
      headers: { 'User-Agent': 'eywa-codex/1.0 (sylvain.ladoire@gmail.com)' },
      timeout: 5000,
    });
    const pages = res.data?.query?.pages ?? {};
    for (const k of Object.keys(pages)) {
      const original = pages[k]?.original?.source;
      if (typeof original === 'string') return original;
    }
    return null;
  }
}
```

- [ ] **Step 2.4: Run tests, expect pass**

```bash
npm test
```

Expected: 4 passed (1 health + 3 wiki-image).

- [ ] **Step 2.5: Implement controller (streams the binary)**

Create `backend/src/wiki-image/wiki-image.controller.ts`:

```ts
import { Controller, Get, Query, Res, HttpException } from '@nestjs/common';
import type { Response } from 'express';
import axios from 'axios';
import { WikiImageService } from './wiki-image.service';

@Controller('wiki-image')
export class WikiImageController {
  constructor(private readonly service: WikiImageService) {}

  @Get()
  async fetch(@Query('q') q: string, @Res() res: Response) {
    if (!q || typeof q !== 'string') {
      throw new HttpException('q query required', 400);
    }
    const url = await this.service.resolveImageUrl(q);
    if (!url) throw new HttpException('not found', 404);
    const stream = await axios.get(url, {
      responseType: 'stream',
      headers: { 'User-Agent': 'eywa-codex/1.0 (sylvain.ladoire@gmail.com)' },
    });
    res.setHeader('Content-Type', stream.headers['content-type'] ?? 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=2592000'); // 30 days
    stream.data.pipe(res);
  }
}
```

(File-cache layer is intentionally deferred — `Cache-Control` headers + browser/nginx caching cover Plan 3 needs. Add disk cache only if real-world rate limits hit.)

- [ ] **Step 2.6: Wire the module**

Create `backend/src/wiki-image/wiki-image.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { WikiImageController } from './wiki-image.controller';
import { WikiImageService } from './wiki-image.service';

@Module({
  controllers: [WikiImageController],
  providers: [WikiImageService],
})
export class WikiImageModule {}
```

Modify `backend/src/app.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { WikiImageModule } from './wiki-image/wiki-image.module';

@Module({
  imports: [WikiImageModule],
  controllers: [HealthController],
})
export class AppModule {}
```

- [ ] **Step 2.7: Manual smoke check**

```bash
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora/backend
npm run build && npm start &
BACK_PID=$!
sleep 3
curl -sI "http://localhost:3003/api/wiki-image?q=Neytiri" | head -5
# Expect HTTP/200 with Content-Type: image/* and Cache-Control: public, max-age=2592000
curl -sI "http://localhost:3003/api/wiki-image?q=AbsolutelyNotARealPage12345" | head -3
# Expect HTTP/404
kill $BACK_PID
```

- [ ] **Step 2.8: Commit**

```bash
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" add backend/
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" commit -m "feat(backend): wiki-image proxy module (TDD, 3 service tests)

GET /api/wiki-image?q=NAME → streams the original image from FR Wikipedia
or 404. Cache-Control: 30 days for browser/nginx-side caching. User-Agent
identifies the bot per Wikipedia API guidelines. Pattern mirrors the
ol-companion wiki-image service for cross-app consistency.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Backend Dockerfile

**Files:** Create `backend/Dockerfile`.

- [ ] **Step 3.1: Multi-stage build**

```dockerfile
# Build stage
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime stage
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist
EXPOSE 3003
CMD ["node", "dist/main.js"]
```

- [ ] **Step 3.2: Add `dist/` and `node_modules/` to `backend/.gitignore`**

Create `backend/.gitignore`:

```
node_modules/
dist/
.env
.env.local
*.log
```

- [ ] **Step 3.3: Commit**

```bash
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" add backend/Dockerfile backend/.gitignore
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" commit -m "feat(infra): backend Dockerfile (multi-stage node:22)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: docker-compose update + nginx /api proxy + deploy

**Files:**
- Modify `docker-compose.yml`
- Modify `frontend/nginx.conf`

- [ ] **Step 4.1: docker-compose.yml — add backend service + shared network**

Replace `docker-compose.yml` content with:

```yaml
services:
  eywa-frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: avatar-pandora-eywa-frontend-1
    ports:
      - "4203:80"
    depends_on:
      - eywa-backend
    restart: unless-stopped
    networks:
      - eywa-net

  eywa-backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: avatar-pandora-eywa-backend-1
    expose:
      - "3003"
    environment:
      PORT: 3003
      CORS_ORIGIN: "http://nas:4203"
    restart: unless-stopped
    networks:
      - eywa-net

networks:
  eywa-net:
    driver: bridge
```

(Backend has no host port mapping — only the frontend nginx talks to it via the docker network on `eywa-backend:3003`.)

- [ ] **Step 4.2: nginx.conf — add /api proxy**

Replace `frontend/nginx.conf` content with:

```nginx
server {
  listen 80;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;

  # API proxy to eywa-backend (docker network)
  location /api/ {
    proxy_pass http://eywa-backend:3003;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_buffering off;
    proxy_read_timeout 30s;
  }

  # Static asset caching
  location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }

  location / {
    try_files $uri $uri/ $uri.html $uri/index.html =404;
  }

  gzip on;
  gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;
}
```

- [ ] **Step 4.3: Sync to NAS + build + verify**

```bash
rsync --rsync-path=/usr/bin/rsync -avz --delete \
  --exclude node_modules --exclude dist --exclude .astro --exclude .git \
  /home/sylvain_ladoire/projects/developpeur/avatar-pandora/ \
  nas:/volume2/docker/developpeur/avatar-pandora/

ssh nas "docker compose -f /volume2/docker/developpeur/avatar-pandora/docker-compose.yml up -d --build"
# expect: avatar-pandora-eywa-frontend-1 + avatar-pandora-eywa-backend-1 both Started

# Verify backend through frontend proxy
curl -sI "http://nas:4203/api/health" | head -3   # expect 200
curl -sI "http://nas:4203/api/wiki-image?q=Neytiri" | head -3   # expect 200 image/*
```

- [ ] **Step 4.4: Commit**

```bash
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" add docker-compose.yml frontend/nginx.conf
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" commit -m "feat(infra): wire backend into compose + nginx /api proxy + deploy

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase B — Cinema landing (Tasks 5-12)

This is where "wahou" lives. Backend phase A delivers a deployable improvement on its own; phase B replaces V1's static landing with the cinematic experience.

### Task 5: R3F + GSAP dependencies

**Files:** Modify `frontend/package.json` (add deps).

- [ ] **Step 5.1: Install**

```bash
nvm use 22
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora/frontend
npm install three@^0.170.0 @react-three/fiber@^9.0.0 @react-three/drei@^10.0.0 gsap@^3.12.0
npm install --save-dev @types/three@^0.170.0
```

- [ ] **Step 5.2: Verify build still works**

```bash
npm run build
```

Expected: clean.

- [ ] **Step 5.3: Commit**

```bash
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" add frontend/package.json frontend/package-lock.json
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" commit -m "chore(frontend): add three / r3f / drei / gsap for the cinema landing

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: ParticleField — instanced points + custom shader

**Files:**
- Create `frontend/src/components/cinema/particles.shader.ts`
- Create `frontend/src/components/cinema/ParticleField.tsx`

The ParticleField is the heart of the visual. ~3500 instanced points (1500 on mobile) drifting with simple noise, rendered as glowy discs with a custom shader. Color blends between two uniforms (`uColorA`, `uColorB`) — these are what scroll changes per scene-zone.

- [ ] **Step 6.1: Create shader source**

Create `frontend/src/components/cinema/particles.shader.ts`:

```ts
export const particlesVertex = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uDensity;
  attribute float aSeed;
  varying float vSeed;
  varying float vDepth;

  void main() {
    vSeed = aSeed;
    // Simple drift: vertical sway + slow horizontal sin
    vec3 p = position;
    p.y += sin(uTime * 0.15 + aSeed * 6.28) * 0.4;
    p.x += cos(uTime * 0.10 + aSeed * 9.42) * 0.3;

    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    vDepth = -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;

    // Size attenuation by depth + density factor
    gl_PointSize = uSize * uDensity * (300.0 / -mvPosition.z);
  }
`;

export const particlesFragment = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying float vSeed;
  varying float vDepth;

  void main() {
    // Disc with soft edge
    vec2 c = gl_PointCoord - 0.5;
    float r = length(c);
    if (r > 0.5) discard;
    float alpha = smoothstep(0.5, 0.15, r);
    // Per-particle hue blend between A and B based on seed
    vec3 color = mix(uColorA, uColorB, vSeed);
    // Soften far particles (depth fog)
    float fog = 1.0 - smoothstep(15.0, 35.0, vDepth);
    gl_FragColor = vec4(color, alpha * fog * 0.85);
  }
`;
```

- [ ] **Step 6.2: Create the ParticleField component**

Create `frontend/src/components/cinema/ParticleField.tsx`:

```tsx
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { particlesVertex, particlesFragment } from './particles.shader';

interface Props {
  count?: number;
  spread?: number;
}

export function ParticleField({ count = 3500, spread = 30 }: Props) {
  const ref = useRef<THREE.Points>(null!);
  const matRef = useRef<THREE.ShaderMaterial>(null!);

  const { positions, seeds } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * spread;
      positions[i * 3 + 1] = (Math.random() - 0.5) * spread * 0.6;
      positions[i * 3 + 2] = (Math.random() - 0.5) * spread;
      seeds[i] = Math.random();
    }
    return { positions, seeds };
  }, [count, spread]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSize: { value: 6.0 },
      uDensity: { value: 1.0 },
      uColorA: { value: new THREE.Color('#5fffe6') },
      uColorB: { value: new THREE.Color('#ff5dc4') },
    }),
    [],
  );

  useFrame((state) => {
    if (matRef.current) {
      (matRef.current.uniforms.uTime as { value: number }).value =
        state.clock.elapsedTime;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSeed" args={[seeds, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={matRef}
        vertexShader={particlesVertex}
        fragmentShader={particlesFragment}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// Ref-passing helper so the parent canvas wrapper can mutate uniforms from scroll
export type ParticleUniforms = {
  uColorA: { value: THREE.Color };
  uColorB: { value: THREE.Color };
  uDensity: { value: number };
};
```

- [ ] **Step 6.3: Sanity build**

```bash
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora/frontend
npm run build
```

Expected: clean build (no React or shader compile errors).

- [ ] **Step 6.4: Commit**

```bash
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" add frontend/src/components/cinema/
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" commit -m "feat(cinema): ParticleField — instanced points with drift shader + dual color uniforms

Custom GLSL: per-particle seed-based color blend between uColorA and
uColorB, depth fog, additive blending. uDensity uniform scales point
size for the 0-to-100% emergence at the cold open. Drift via cheap
sine combinations (no expensive perlin noise needed).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Scene timeline — scroll → uniforms mapping

**Files:** Create `frontend/src/components/cinema/scene-timeline.ts`.

Defines the 5 scene-zones and their target uniform values. Pure data + a small interpolation helper.

- [ ] **Step 7.1: Create scene-timeline.ts**

```ts
import * as THREE from 'three';

export interface SceneZone {
  /** label for debugging only */
  label: string;
  /** scroll progress 0..1 at which this zone fully expresses */
  at: number;
  colorA: string;
  colorB: string;
  density: number; // 0..1.4, scales uDensity
  cameraZ: number; // camera moves forward over the descent
}

export const SCENE_ZONES: SceneZone[] = [
  { label: 'cold-open',    at: 0.00, colorA: '#000000', colorB: '#000000', density: 0.0, cameraZ: 8 },
  { label: 'forest',       at: 0.18, colorA: '#5fffe6', colorB: '#7fff8f', density: 1.0, cameraZ: 6 },
  { label: 'hometree',     at: 0.36, colorA: '#7fdcff', colorB: '#ffd07f', density: 1.2, cameraZ: 4 },
  { label: 'mountains',    at: 0.54, colorA: '#4a4a8f', colorB: '#9a7fff', density: 0.9, cameraZ: 2 },
  { label: 'ocean',        at: 0.72, colorA: '#5fffe6', colorB: '#ff5dc4', density: 1.4, cameraZ: 0 },
  { label: 'volcano',      at: 0.88, colorA: '#ff8c2a', colorB: '#ff4040', density: 1.0, cameraZ: -2 },
  { label: 'reveal',       at: 1.00, colorA: '#5fffe6', colorB: '#ff5dc4', density: 1.0, cameraZ: -4 },
];

const tmpA = new THREE.Color();
const tmpB = new THREE.Color();

export interface SceneState {
  colorA: THREE.Color;
  colorB: THREE.Color;
  density: number;
  cameraZ: number;
}

export function sampleScene(progress: number, out: SceneState): SceneState {
  const p = Math.max(0, Math.min(1, progress));
  let a = SCENE_ZONES[0];
  let b = SCENE_ZONES[SCENE_ZONES.length - 1];
  for (let i = 0; i < SCENE_ZONES.length - 1; i++) {
    if (p >= SCENE_ZONES[i].at && p <= SCENE_ZONES[i + 1].at) {
      a = SCENE_ZONES[i];
      b = SCENE_ZONES[i + 1];
      break;
    }
  }
  const span = Math.max(b.at - a.at, 1e-6);
  const t = (p - a.at) / span;
  // smoothstep for buttery transitions
  const s = t * t * (3 - 2 * t);
  tmpA.set(a.colorA);
  tmpB.set(b.colorA);
  out.colorA.copy(tmpA).lerp(tmpB, s);
  tmpA.set(a.colorB);
  tmpB.set(b.colorB);
  out.colorB.copy(tmpA).lerp(tmpB, s);
  out.density = a.density + (b.density - a.density) * s;
  out.cameraZ = a.cameraZ + (b.cameraZ - a.cameraZ) * s;
  return out;
}
```

- [ ] **Step 7.2: Commit**

```bash
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" add frontend/src/components/cinema/scene-timeline.ts
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" commit -m "feat(cinema): scene timeline (7 zones cold-open → forest → hometree → mountains → ocean → volcano → reveal)

Colors, density, and camera-Z per zone with smoothstep interpolation.
Pure data — no DOM/R3F coupling, easy to tune by editing constants.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: useReducedMotion + CinemaCanvas wrapper

**Files:**
- Create `frontend/src/components/cinema/useReducedMotion.ts`
- Create `frontend/src/components/cinema/CinemaCanvas.tsx`

`CinemaCanvas` is the React island that owns the R3F Canvas, the ParticleField, and the scroll-driven uniform updates. It also hosts the GSAP ScrollTrigger setup.

- [ ] **Step 8.1: useReducedMotion hook**

```ts
// frontend/src/components/cinema/useReducedMotion.ts
import { useEffect, useState } from 'react';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}
```

- [ ] **Step 8.2: CinemaCanvas component**

```tsx
// frontend/src/components/cinema/CinemaCanvas.tsx
import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ParticleField } from './ParticleField';
import { SceneState, sampleScene } from './scene-timeline';
import { useReducedMotion } from './useReducedMotion';

gsap.registerPlugin(ScrollTrigger);

// Inner scene drives uniforms + camera every frame from a shared progress ref.
function SceneDriver({ progressRef }: { progressRef: React.MutableRefObject<number> }) {
  const { camera, scene } = useThree();
  const stateRef = useRef<SceneState>({
    colorA: new THREE.Color('#000000'),
    colorB: new THREE.Color('#000000'),
    density: 0,
    cameraZ: 8,
  });

  // Find the ShaderMaterial under <points> traversal-style.
  const matRef = useRef<THREE.ShaderMaterial | null>(null);
  useEffect(() => {
    scene.traverse((obj) => {
      if (obj instanceof THREE.Points && obj.material instanceof THREE.ShaderMaterial) {
        matRef.current = obj.material;
      }
    });
  }, [scene]);

  // Drive each frame from the shared progress.
  useMemo(() => {
    const tick = () => {
      const s = sampleScene(progressRef.current, stateRef.current);
      if (matRef.current) {
        const u = matRef.current.uniforms;
        (u.uColorA.value as THREE.Color).copy(s.colorA);
        (u.uColorB.value as THREE.Color).copy(s.colorB);
        u.uDensity.value = s.density;
      }
      camera.position.z = s.cameraZ;
      requestAnimationFrame(tick);
    };
    if (typeof window !== 'undefined') tick();
  }, [camera, progressRef]);

  return null;
}

export function CinemaCanvas() {
  const reduced = useReducedMotion();
  const progressRef = useRef(0);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduced || !sentinelRef.current) return;
    const trigger = ScrollTrigger.create({
      trigger: sentinelRef.current,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.6,
      onUpdate: (self) => {
        progressRef.current = self.progress;
      },
    });
    return () => trigger.kill();
  }, [reduced]);

  if (reduced) {
    // Static fallback: render nothing fancy. The parent landing shows the V1-style logo + CTA.
    return null;
  }

  return (
    <>
      {/* Fixed full-page canvas behind page content */}
      <div className="fixed inset-0 -z-10 bg-eywa-bg pointer-events-none">
        <Canvas
          camera={{ position: [0, 0, 8], fov: 60 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        >
          <ParticleField count={typeof window !== 'undefined' && window.innerWidth < 768 ? 1500 : 3500} />
          <SceneDriver progressRef={progressRef} />
        </Canvas>
      </div>
      {/* Sentinel: long scroll area that drives the timeline. Filled by HTML overlays in parent. */}
      <div ref={sentinelRef} className="relative">
        {/* slot for typographic overlays, rendered in index.astro */}
      </div>
    </>
  );
}
```

- [ ] **Step 8.3: Build verify**

```bash
nvm use 22
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora/frontend
npm run build
```

Expected: clean build (Astro should be happy with the React island).

- [ ] **Step 8.4: Commit**

```bash
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" add frontend/src/components/cinema/
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" commit -m "feat(cinema): CinemaCanvas island + ScrollTrigger driver + reduced-motion gate

R3F Canvas fixed full-page behind content. SceneDriver mutates particle
uniforms + camera Z each frame from a shared progressRef updated by
GSAP ScrollTrigger (scrub 0.6 for smoothing). prefers-reduced-motion
short-circuits to a no-op render so accessibility users see only the
static fallback landing.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Landing V2 — typographic overlays for scenes 1-3

**Files:** Modify `frontend/src/pages/index.astro` to host the cinema island and the overlay HTML.

The landing becomes a tall scroll area (~600vh) where each scene-zone has an HTML overlay block positioned at the matching scroll percentage. Each block contains the typography (quote, title, subtitle) for that zone, faded in via GSAP when entering the viewport.

- [ ] **Step 9.1: Replace `index.astro` with the cinema landing skeleton**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import EywaLogo from '../components/EywaLogo.astro';
import { CinemaCanvas } from '../components/cinema/CinemaCanvas';
---
<BaseLayout title="Eywa — Codex de Pandora" description="Un codex visuel de Pandora — la lune, ses clans, sa faune, sa langue.">
  <!-- Cinema island: WebGL canvas (fixed bg) + scroll driver. Hydrated client-side. -->
  <CinemaCanvas client:load />

  <!--
    Landing scroll area: 600vh (= 6 viewport heights of scroll runway for the 6 timeline beats).
    Each scene block is sticky-positioned for its slice and contains the overlay typography.
  -->
  <div class="relative" style="height: 600vh;">

    <!-- Cold open (0–18%) -->
    <section class="absolute inset-x-0 top-0 h-[100vh] flex items-center justify-center text-center px-6">
      <div class="max-w-2xl">
        <p class="font-display text-eywa-bio-primary text-3xl md:text-5xl tracking-wide opacity-0" data-cinema-fade="0.02">
          Je te vois.
        </p>
      </div>
    </section>

    <!-- Forêt Eywa (18–36%) -->
    <section class="absolute inset-x-0 top-[100vh] h-[100vh] flex items-center justify-center text-center px-6">
      <div class="max-w-2xl opacity-0" data-cinema-fade="0.20">
        <p class="text-xs uppercase tracking-[0.3em] text-eywa-bio-primary mb-4">I — La Forêt d'Eywa</p>
        <h2 class="font-display text-3xl md:text-4xl text-eywa-text mb-3">Sous la canopée</h2>
        <p class="text-eywa-text-muted font-body italic max-w-xl mx-auto">
          Le pollen flotte, la mousse pulse, les arbres se parlent.
        </p>
      </div>
    </section>

    <!-- Hometree (36–54%) -->
    <section class="absolute inset-x-0 top-[200vh] h-[100vh] flex items-center justify-center text-center px-6">
      <div class="max-w-2xl opacity-0" data-cinema-fade="0.38">
        <p class="text-xs uppercase tracking-[0.3em] text-eywa-bio-primary mb-4">II — Hometree</p>
        <h2 class="font-display text-3xl md:text-4xl text-eywa-text mb-3">L'arbre-mère</h2>
        <p class="text-eywa-text-muted font-body italic max-w-xl mx-auto">
          Foyer du clan Omatikaya. Plus haut qu'une cathédrale, plus vivant qu'une ville.
        </p>
      </div>
    </section>

    <!-- placeholder spacers for scenes 4-6, filled in Task 10 -->
    <div class="absolute inset-x-0 top-[300vh] h-[300vh]"></div>

  </div>
</BaseLayout>

<script>
  // Fade-in overlays: each [data-cinema-fade="<at>"] element fades in
  // when scroll progress passes its `at` value.
  // We piggy-back on the same scroll position the cinema canvas is using —
  // a simple IntersectionObserver suffices for binary appear/disappear,
  // but we want a smooth opacity tied to scroll. Use rAF + scroll listener.
  document.addEventListener('astro:page-load', () => {
    const fades = document.querySelectorAll<HTMLElement>('[data-cinema-fade]');
    const onScroll = () => {
      const total = document.body.scrollHeight - window.innerHeight;
      const progress = total > 0 ? window.scrollY / total : 0;
      fades.forEach((el) => {
        const at = parseFloat(el.dataset.cinemaFade ?? '0');
        const dist = Math.abs(progress - at);
        const opacity = Math.max(0, 1 - dist * 8);
        el.style.opacity = opacity.toFixed(3);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  });
</script>
```

- [ ] **Step 9.2: Build + smoke test**

```bash
nvm use 22
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora/frontend
npm run build
npm run dev -- --host 0.0.0.0 --port 4299 &
DEV_PID=$!
sleep 5
curl -s http://localhost:4299/ | grep -oE 'cinema-fade|CinemaCanvas|<canvas' | head -10
kill $DEV_PID 2>/dev/null
```

Expected: the page references the canvas and the fade attributes.

- [ ] **Step 9.3: Commit**

```bash
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" add frontend/src/pages/index.astro
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" commit -m "feat(landing): cinema V2 skeleton — cold open + forêt + Hometree overlays

600vh scroll runway hosts 6 sticky overlay sections matching the
particle timeline. Each overlay fades in/out around its scene-progress
center via a vanilla scroll listener. Scenes 4-6 wired in Task 10.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Scenes 4-6 (mountains, ocean, volcano) + final reveal

**Files:** Modify `frontend/src/pages/index.astro` (replace placeholder spacer with scenes 4-6 + reveal).

- [ ] **Step 10.1: Replace the placeholder spacer block**

In `index.astro`, find:

```html
<!-- placeholder spacers for scenes 4-6, filled in Task 10 -->
<div class="absolute inset-x-0 top-[300vh] h-[300vh]"></div>
```

Replace with:

```html
<!-- Hallelujah Mountains (54–72%) -->
<section class="absolute inset-x-0 top-[300vh] h-[100vh] flex items-center justify-center text-center px-6">
  <div class="max-w-2xl opacity-0" data-cinema-fade="0.56">
    <p class="text-xs uppercase tracking-[0.3em] text-eywa-bio-primary mb-4">III — Hallelujah</p>
    <h2 class="font-display text-3xl md:text-4xl text-eywa-text mb-3">Les montagnes flottantes</h2>
    <p class="text-eywa-text-muted font-body italic max-w-xl mx-auto">
      La magnétite leur ordonne de léviter. Eywa accepte la défiance de la gravité.
    </p>
  </div>
</section>

<!-- Metkayina ocean (72–88%) -->
<section class="absolute inset-x-0 top-[400vh] h-[100vh] flex items-center justify-center text-center px-6">
  <div class="max-w-2xl opacity-0" data-cinema-fade="0.74">
    <p class="text-xs uppercase tracking-[0.3em] text-eywa-bio-primary mb-4">IV — Metkayina</p>
    <h2 class="font-display text-3xl md:text-4xl text-eywa-text mb-3">L'océan vivant</h2>
    <p class="text-eywa-text-muted font-body italic max-w-xl mx-auto">
      Tulkun, ilu, lumières sous l'eau. La voie de l'eau est la voie de tout ce qui est.
    </p>
  </div>
</section>

<!-- Fire & Ash volcano (88–100%) -->
<section class="absolute inset-x-0 top-[500vh] h-[100vh] flex items-center justify-center text-center px-6">
  <div class="max-w-2xl opacity-0" data-cinema-fade="0.90">
    <p class="text-xs uppercase tracking-[0.3em] text-eywa-fire-ash mb-4">V — Fire & Ash</p>
    <h2 class="font-display text-3xl md:text-4xl text-eywa-text mb-3">La Tribu des Cendres</h2>
    <p class="text-eywa-text-muted font-body italic max-w-xl mx-auto">
      Le volcan respire, la cendre tombe, le clan veille.
    </p>
  </div>
</section>

<!-- Final reveal — the sticky logo + CTAs land here -->
<section class="absolute inset-x-0 top-[600vh] h-[100vh] flex flex-col items-center justify-center text-center px-6 -translate-y-full">
  <div class="opacity-0" data-cinema-fade="1.00">
    <EywaLogo size={420} />
    <p class="mt-8 max-w-xl text-eywa-text-muted text-lg italic font-body">
      « Je te vois. »<br/>
      Un codex visuel de Pandora — la lune, ses clans, sa faune, sa langue.
    </p>
    <div class="mt-12 flex gap-4 justify-center">
      <a href="/pandora/intro"
         class="px-6 py-3 rounded border border-eywa-bio-primary text-eywa-bio-primary hover:shadow-glow-bio transition-shadow">
        Explorer le codex
      </a>
      <a href="/about"
         class="px-6 py-3 rounded text-eywa-text-muted hover:text-eywa-text transition-colors">
        À propos
      </a>
    </div>
  </div>
</section>
```

Also bump the parent wrapper height from `600vh` to `700vh` so the final reveal block has scroll room:

```html
<div class="relative" style="height: 700vh;">
```

- [ ] **Step 10.2: Build + smoke check**

```bash
nvm use 22
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora/frontend
npm run build
```

Expected: clean.

- [ ] **Step 10.3: Commit**

```bash
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" add frontend/src/pages/index.astro
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" commit -m "feat(landing): scenes IV-V + final reveal with logo + CTAs

Adds Hallelujah Mountains, Metkayina ocean, Fire & Ash volcano overlays.
Last beat lands on a static reveal: EywaLogo at 420px + the original
CTAs (Explorer codex / À propos). Scroll runway grows from 600vh to
700vh so the reveal block has its own viewport space.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Reduced-motion fallback landing

**Files:** Modify `frontend/src/pages/index.astro`.

When `prefers-reduced-motion: reduce` is on, the CinemaCanvas already short-circuits — but we still need the user to see SOMETHING. Without the canvas, the long scroll area shows nothing. Add a CSS-only fallback that hides the cinematic overlays and reveals a single static landing block.

- [ ] **Step 11.1: Add a static fallback section + reduced-motion CSS**

At the very top of the body in `index.astro`, BEFORE the `<CinemaCanvas client:load />`:

```html
<!-- Reduced-motion fallback: simple landing identical to V1 -->
<main class="motion-reduce:flex hidden min-h-screen flex-col items-center justify-center text-center px-6 py-20">
  <EywaLogo size={420} />
  <p class="mt-10 max-w-xl text-eywa-text-muted text-lg leading-relaxed font-body italic">
    « Je te vois. »<br/>
    Un codex visuel de Pandora — la lune, ses clans, sa faune, sa langue.
  </p>
  <div class="mt-12 flex gap-4">
    <a href="/pandora/intro"
       class="px-6 py-3 rounded border border-eywa-bio-primary text-eywa-bio-primary hover:shadow-glow-bio transition-shadow">
      Explorer le codex
    </a>
    <a href="/about"
       class="px-6 py-3 rounded text-eywa-text-muted hover:text-eywa-text transition-colors">
      À propos
    </a>
  </div>
</main>

<!-- Cinematic landing: hidden when reduced motion is requested -->
<div class="motion-reduce:hidden">
  <CinemaCanvas client:load />
  <!-- ... the existing 700vh scroll wrapper goes inside this div ... -->
</div>
```

Wrap the existing 700vh scroll runway and CinemaCanvas in the `motion-reduce:hidden` wrapper.

- [ ] **Step 11.2: Build + visual check at /?reducedmotion**

`prefers-reduced-motion` is OS-controlled, but you can simulate it by appending a force toggle. Skip the manual override — just test build + structural presence:

```bash
nvm use 22
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora/frontend
npm run build
grep -oE 'motion-reduce:flex|motion-reduce:hidden' dist/index.html | sort -u
```

Expected: both classes present.

- [ ] **Step 11.3: Commit**

```bash
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" add frontend/src/pages/index.astro
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" commit -m "feat(a11y): prefers-reduced-motion fallback — static V1 landing when motion off

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Deploy + visual eyeballing

**Files:** None (ops only).

- [ ] **Step 12.1: Sync + build on NAS**

```bash
rsync --rsync-path=/usr/bin/rsync -avz --delete \
  --exclude node_modules --exclude dist --exclude .astro --exclude .git \
  /home/sylvain_ladoire/projects/developpeur/avatar-pandora/ \
  nas:/volume2/docker/developpeur/avatar-pandora/

ssh nas "docker compose -f /volume2/docker/developpeur/avatar-pandora/docker-compose.yml up -d --build"
```

Expected: both containers Started.

- [ ] **Step 12.2: Verify**

```bash
curl -sI http://nas:4203/ | head -3                                  # 200
curl -sI "http://nas:4203/api/health" | head -3                       # 200
curl -sI "http://nas:4203/api/wiki-image?q=Neytiri" | head -3         # 200 image/*
curl -s http://nas:4203/ | grep -oE 'CinemaCanvas|cinema-fade' | wc -l  # >0
```

- [ ] **Step 12.3: User eyeball pass**

Open http://nas:4203/ in a real browser. Scroll slowly. Verify, in order:
1. Cold open: black, "Je te vois" appears in cyan.
2. Particles wake up around 10–18% scroll, dense and cyan-green by the forest beat.
3. Hometree: warmer hues (cyan + gold).
4. Mountains: cooler, indigo-violet, density drops slightly.
5. Ocean: aqua-magenta, density peaks (most particles, brightest).
6. Volcano: amber-red wash, dramatic shift.
7. Final reveal: logo + CTAs land statically.
8. CTAs work — `/pandora/intro` and `/about` navigate correctly.
9. No console errors. FPS stays 50+ on the dev tools performance tab.
10. With `prefers-reduced-motion: reduce` on (Settings → Accessibility), the static V1 landing shows; no canvas mounted.

Anything that doesn't pop visually goes into a follow-up tuning commit (color tweaks, density tweaks, easing tweaks). The plan deliberately stops here so the user-as-art-director gets a chance to art-direct.

---

## Definition of done — V2

- [ ] Backend `/api/health` and `/api/wiki-image?q=…` reachable via http://nas:4203/api/
- [ ] Cinematic landing replaces V1 at http://nas:4203/
- [ ] All 7 scene-zones (cold open + 5 + reveal) visibly distinct
- [ ] Final reveal still has the working CTAs to `/pandora/intro` and `/about`
- [ ] `prefers-reduced-motion` shows the static V1 landing instead
- [ ] No regression on `/about` and codex pages
- [ ] Both containers run in `restart: unless-stopped`

## Out of scope (deferred to Plan 3)

- Section content fully populated (all 7 codex sections beyond Pandora intro)
- 3D models for Hometree, ikran, etc. — particle field is the only visual
- Audio (Avatar moonsong loop) — too easy to make cheesy on first pass
- Carte 3D interactive de Pandora — post-Plan-3
- Migration Vercel/Netlify — only if user decides to publish

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| R3F + Astro SSR mismatch (canvas tries to render server-side) | `client:load` directive ensures the island only mounts client-side |
| Mobile WebGL perf | Particle count auto-drops to 1500 on viewport <768px; `dpr=[1,2]` caps device pixel ratio |
| ScrollTrigger + Astro hydration ordering | The trigger registers in a `useEffect` after mount — DOM is ready by then |
| GLSL compile error | Build won't catch shader compile errors (they happen at runtime); manual smoke check in Step 12.3 catches them |
| Reduced motion users see blank page | Task 11 explicit fallback — separate static landing wrapped in `motion-reduce:flex` |
| Backend fails after deploy | Frontend continues to work — only `/api/*` 502s; landing has no backend dependency |
| Scene transitions feel jumpy | `scrub: 0.6` on ScrollTrigger smooths the progress; `smoothstep` in `sampleScene` smooths the per-segment lerp |

## Spec coverage check

| Spec section | Implemented in |
|---|---|
| Backend NestJS minimal (port 3003, /api prefix) | Tasks 1, 3, 4 |
| /api/wiki-image proxy (pattern from warhammer/ol) | Task 2 |
| Scrollytelling 5 scenes | Tasks 7, 9, 10 (zones forest, hometree, mountains, ocean, volcano) |
| Particles pollen ambient (R3F) | Tasks 6, 8 |
| Bioluminescent palette per scene | Task 7 (`SCENE_ZONES` colors) |
| Fire & Ash accent for 3rd film | Task 7 zone `volcano` + Task 10 overlay using `text-eywa-fire-ash` |
| GSAP + ScrollTrigger | Task 8 |
| Final transition to codex / CTAs | Task 10 reveal section |
| prefers-reduced-motion fallback | Tasks 8 (canvas short-circuit) + 11 (static landing fallback) |
| Mobile WebGL fallback | Task 8 (count auto-drop) |
