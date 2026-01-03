#!/bin/bash
#
# APK Build Service Setup Script
# Sets up a self-hosted Capacitor APK build service for Shakespeare
#
# Usage:
#   curl -fsSL https://your-domain.com/setup-apk-build-service.sh | bash
#   # or
#   ./setup-apk-build-service.sh [options]
#
# Options:
#   --dir DIR        Installation directory (default: ./apk-build-service)
#   --port PORT      Service port (default: 3000)
#   --no-start       Don't start the service after setup
#   --help           Show this help message
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
INSTALL_DIR="./apk-build-service"
PORT=3000
START_SERVICE=true

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --dir)
      INSTALL_DIR="$2"
      shift 2
      ;;
    --port)
      PORT="$2"
      shift 2
      ;;
    --no-start)
      START_SERVICE=false
      shift
      ;;
    --help)
      head -20 "$0" | tail -18
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║         APK Build Service Setup Script                    ║"
echo "║         Capacitor + Android SDK + Docker                  ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command -v docker &> /dev/null; then
  echo -e "${RED}Error: Docker is not installed${NC}"
  echo "Install Docker: https://docs.docker.com/get-docker/"
  exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
  echo -e "${RED}Error: Docker Compose is not installed${NC}"
  echo "Install Docker Compose: https://docs.docker.com/compose/install/"
  exit 1
fi

# Use 'docker compose' if available, otherwise 'docker-compose'
if docker compose version &> /dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
else
  COMPOSE_CMD="docker-compose"
fi

echo -e "${GREEN}Prerequisites OK${NC}"

# Check for existing installation
EXISTING_API_KEY=""
UPGRADE_MODE=false

if [ -f "$INSTALL_DIR/.env" ]; then
  EXISTING_API_KEY=$(grep "^API_KEY=" "$INSTALL_DIR/.env" 2>/dev/null | cut -d= -f2)
  if [ -n "$EXISTING_API_KEY" ]; then
    UPGRADE_MODE=true
    echo -e "${YELLOW}Existing installation found. Preserving API key...${NC}"
  fi
fi

# Use existing API key or generate new one
if [ -n "$EXISTING_API_KEY" ]; then
  API_KEY="$EXISTING_API_KEY"
  echo -e "${GREEN}Using existing API key${NC}"
else
  API_KEY=$(openssl rand -hex 32 2>/dev/null || head -c 64 /dev/urandom | xxd -p | tr -d '\n' | head -c 64)
  echo -e "${GREEN}Generated new API key${NC}"
fi

# Create directory structure
if [ "$UPGRADE_MODE" = true ]; then
  echo -e "${YELLOW}Upgrading existing installation...${NC}"
else
  echo -e "${YELLOW}Creating directory structure...${NC}"
fi
mkdir -p "$INSTALL_DIR/lib"
cd "$INSTALL_DIR"

echo -e "${GREEN}Installing to: $(pwd)${NC}"

# =============================================================================
# Dockerfile
# =============================================================================
echo -e "${YELLOW}Creating Dockerfile...${NC}"
cat > Dockerfile << 'DOCKERFILE_EOF'
FROM node:20-bookworm

# Prevent interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies
RUN apt-get update && apt-get install -y \
    openjdk-17-jdk \
    wget \
    unzip \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set Java home
ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
ENV PATH=$PATH:$JAVA_HOME/bin

# Android SDK setup
ENV ANDROID_HOME=/opt/android-sdk
ENV ANDROID_SDK_ROOT=/opt/android-sdk
ENV PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools

# Download and install Android command line tools
RUN mkdir -p $ANDROID_HOME/cmdline-tools && \
    cd $ANDROID_HOME/cmdline-tools && \
    wget -q https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -O tools.zip && \
    unzip -q tools.zip && \
    rm tools.zip && \
    mv cmdline-tools latest

# Accept licenses and install SDK components
RUN yes | sdkmanager --licenses > /dev/null 2>&1 && \
    sdkmanager --install \
      "platform-tools" \
      "platforms;android-34" \
      "build-tools;34.0.0" \
      > /dev/null 2>&1

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package.json ./
RUN npm install --omit=dev

# Copy app source
COPY . .

# Create directories for builds
RUN mkdir -p /tmp/builds /tmp/output

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start server
CMD ["node", "server.js"]
DOCKERFILE_EOF

# =============================================================================
# docker-compose.yml
# =============================================================================
echo -e "${YELLOW}Creating docker-compose.yml...${NC}"
cat > docker-compose.yml << COMPOSE_EOF
version: '3.8'

services:
  apk-builder:
    build: .
    container_name: apk-build-service
    restart: unless-stopped
    ports:
      - "\${PORT:-3000}:3000"
    volumes:
      # Persist Gradle cache for faster builds
      - gradle-cache:/root/.gradle
      # Persist npm cache
      - npm-cache:/root/.npm
      # Persist Android debug keystore for consistent signing
      - android-config:/root/.android
    environment:
      - NODE_ENV=production
      - API_KEY=\${API_KEY}
      - MAX_CONCURRENT_BUILDS=\${MAX_CONCURRENT_BUILDS:-2}
      - BUILD_TIMEOUT_MS=\${BUILD_TIMEOUT_MS:-600000}
      - CORS_ORIGINS=\${CORS_ORIGINS:-*}
    deploy:
      resources:
        limits:
          memory: 4G
        reservations:
          memory: 2G
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

volumes:
  gradle-cache:
  npm-cache:
  android-config:
COMPOSE_EOF

# =============================================================================
# .env
# =============================================================================
echo -e "${YELLOW}Creating .env file...${NC}"
cat > .env << ENV_EOF
# APK Build Service Configuration

# Server port
PORT=${PORT}

# API key for authentication (keep this secret!)
API_KEY=${API_KEY}

# Build settings
MAX_CONCURRENT_BUILDS=2
BUILD_TIMEOUT_MS=600000

# CORS origins (comma-separated, or * for all)
# Example: https://shakespeare.dev,https://your-app.com
CORS_ORIGINS=*
ENV_EOF

# =============================================================================
# package.json
# =============================================================================
echo -e "${YELLOW}Creating package.json...${NC}"
cat > package.json << 'PACKAGE_EOF'
{
  "name": "apk-build-service",
  "version": "1.0.0",
  "description": "Self-hosted Capacitor APK build service for Shakespeare",
  "type": "module",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
  "dependencies": {
    "adm-zip": "^0.5.10",
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "multer": "^1.4.5-lts.1",
    "sharp": "^0.33.2",
    "uuid": "^9.0.1"
  },
  "engines": {
    "node": ">=18"
  }
}
PACKAGE_EOF

# =============================================================================
# server.js
# =============================================================================
echo -e "${YELLOW}Creating server.js...${NC}"
cat > server.js << 'SERVER_EOF'
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { randomUUID } from 'crypto';
import { BuildQueue } from './lib/queue.js';
import { buildAPK } from './lib/builder.js';

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB max
});

// Configuration
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY;
const CORS_ORIGINS = process.env.CORS_ORIGINS?.split(',').map(s => s.trim()) || ['*'];
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT_BUILDS || '2');
const BUILD_TIMEOUT = parseInt(process.env.BUILD_TIMEOUT_MS || '600000');

// Build state
const builds = new Map();
const queue = new BuildQueue(MAX_CONCURRENT);

// Middleware
app.use(cors({
  origin: CORS_ORIGINS.includes('*') ? true : CORS_ORIGINS,
  credentials: true
}));
app.use(express.json());

// API Key authentication
const authenticate = (req, res, next) => {
  if (!API_KEY) return next(); // Skip if no API key configured

  const providedKey = req.headers['x-api-key'] || req.query.apiKey;
  if (providedKey !== API_KEY) {
    return res.status(401).json({ error: 'Invalid or missing API key' });
  }
  next();
};

// Health check (no auth required)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    queue: queue.getStatus(),
    activeBuilds: builds.size,
    uptime: process.uptime()
  });
});

// Submit build
app.post('/api/build', authenticate, upload.single('project'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No project ZIP provided' });
    }

    let config;
    try {
      config = JSON.parse(req.body.config || '{}');
    } catch {
      return res.status(400).json({ error: 'Invalid config JSON' });
    }

    // Validate required fields
    if (!config.appName || typeof config.appName !== 'string') {
      return res.status(400).json({ error: 'appName is required' });
    }

    if (!config.packageId || !/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i.test(config.packageId)) {
      return res.status(400).json({
        error: 'Valid packageId required (e.g., com.example.myapp)'
      });
    }

    // Sanitize inputs
    config.appName = config.appName.slice(0, 50).replace(/[<>:"/\\|?*]/g, '');
    config.packageId = config.packageId.toLowerCase();

    const buildId = randomUUID();
    const buildState = {
      id: buildId,
      status: 'queued',
      progress: 0,
      config,
      createdAt: new Date().toISOString(),
      logs: []
    };

    builds.set(buildId, buildState);

    // Add to queue
    queue.add(async () => {
      try {
        await buildAPK(buildId, req.file.buffer, config, builds, BUILD_TIMEOUT);
      } catch (error) {
        const build = builds.get(buildId);
        if (build && build.status !== 'failed') {
          build.status = 'failed';
          build.error = error.message;
          build.logs.push(`[ERROR] ${error.message}`);
        }
      }
    });

    console.log(`Build ${buildId} queued for ${config.appName} (${config.packageId})`);

    res.json({
      buildId,
      status: 'queued',
      message: 'Build queued successfully'
    });

  } catch (error) {
    console.error('Build submission error:', error);
    res.status(500).json({ error: 'Failed to submit build' });
  }
});

// Get build status
app.get('/api/build/:buildId/status', authenticate, (req, res) => {
  const build = builds.get(req.params.buildId);

  if (!build) {
    return res.status(404).json({ error: 'Build not found' });
  }

  res.json({
    id: build.id,
    status: build.status,
    progress: build.progress,
    error: build.error,
    config: {
      appName: build.config.appName,
      packageId: build.config.packageId
    },
    createdAt: build.createdAt,
    completedAt: build.completedAt,
    apkSize: build.apkSize,
    logs: build.logs.slice(-20) // Last 20 log entries
  });
});

// Download APK
app.get('/api/build/:buildId/download', authenticate, (req, res) => {
  const build = builds.get(req.params.buildId);

  if (!build) {
    return res.status(404).json({ error: 'Build not found' });
  }

  if (build.status !== 'complete') {
    return res.status(400).json({
      error: 'Build not complete',
      status: build.status
    });
  }

  if (!build.apkPath) {
    return res.status(404).json({ error: 'APK file not found' });
  }

  const filename = `${build.config.appName.replace(/[^a-zA-Z0-9]/g, '_')}.apk`;
  res.download(build.apkPath, filename, (err) => {
    if (err) {
      console.error(`Download error for ${build.id}:`, err);
    }
  });
});

// Get build logs (full)
app.get('/api/build/:buildId/logs', authenticate, (req, res) => {
  const build = builds.get(req.params.buildId);

  if (!build) {
    return res.status(404).json({ error: 'Build not found' });
  }

  res.json({
    id: build.id,
    status: build.status,
    logs: build.logs
  });
});

// Cancel build (if still queued)
app.delete('/api/build/:buildId', authenticate, (req, res) => {
  const build = builds.get(req.params.buildId);

  if (!build) {
    return res.status(404).json({ error: 'Build not found' });
  }

  if (build.status === 'queued') {
    build.status = 'cancelled';
    console.log(`Build ${build.id} cancelled`);
    res.json({ message: 'Build cancelled' });
  } else {
    res.status(400).json({
      error: 'Cannot cancel build in progress',
      status: build.status
    });
  }
});

// List recent builds (admin endpoint)
app.get('/api/builds', authenticate, (req, res) => {
  const buildList = Array.from(builds.values())
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 50)
    .map(b => ({
      id: b.id,
      status: b.status,
      appName: b.config.appName,
      packageId: b.config.packageId,
      progress: b.progress,
      createdAt: b.createdAt,
      completedAt: b.completedAt
    }));

  res.json({ builds: buildList });
});

// Cleanup old builds periodically (every 30 minutes)
setInterval(() => {
  const maxAge = 60 * 60 * 1000; // 1 hour
  const now = Date.now();
  let cleaned = 0;

  for (const [id, build] of builds) {
    const age = now - new Date(build.createdAt).getTime();
    if (age > maxAge && ['complete', 'failed', 'cancelled'].includes(build.status)) {
      builds.delete(id);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`Cleaned up ${cleaned} old build records`);
  }
}, 30 * 60 * 1000);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

app.listen(PORT, () => {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║         APK Build Service Started                         ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  Port:              ${PORT}`);
  console.log(`  Max concurrent:    ${MAX_CONCURRENT}`);
  console.log(`  Build timeout:     ${BUILD_TIMEOUT}ms`);
  console.log(`  API key required:  ${!!API_KEY}`);
  console.log(`  CORS origins:      ${CORS_ORIGINS.join(', ')}`);
  console.log('');
  console.log(`  Health check:      http://localhost:${PORT}/health`);
  console.log('');
});
SERVER_EOF

# =============================================================================
# lib/queue.js
# =============================================================================
echo -e "${YELLOW}Creating lib/queue.js...${NC}"
cat > lib/queue.js << 'QUEUE_EOF'
export class BuildQueue {
  constructor(maxConcurrent = 2) {
    this.maxConcurrent = maxConcurrent;
    this.running = 0;
    this.queue = [];
  }

  add(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.process();
    });
  }

  async process() {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    this.running++;
    const { task, resolve, reject } = this.queue.shift();

    try {
      const result = await task();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.running--;
      this.process();
    }
  }

  getStatus() {
    return {
      running: this.running,
      queued: this.queue.length,
      maxConcurrent: this.maxConcurrent
    };
  }
}
QUEUE_EOF

# =============================================================================
# lib/builder.js
# =============================================================================
echo -e "${YELLOW}Creating lib/builder.js...${NC}"
cat > lib/builder.js << 'BUILDER_EOF'
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import AdmZip from 'adm-zip';
import sharp from 'sharp';

const execAsync = promisify(exec);

const BUILDS_DIR = '/tmp/builds';
const OUTPUT_DIR = '/tmp/output';

export async function buildAPK(buildId, zipBuffer, config, builds, timeout) {
  const buildDir = path.join(BUILDS_DIR, buildId);
  const outputPath = path.join(OUTPUT_DIR, `${buildId}.apk`);
  const build = builds.get(buildId);

  const log = (message) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    console.log(`[${buildId.slice(0, 8)}] ${message}`);
    build.logs.push(`[${timestamp}] ${message}`);
  };

  try {
    build.status = 'building';
    build.progress = 5;
    log('Starting build...');

    // Create directories
    await fs.mkdir(buildDir, { recursive: true });
    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    // Extract ZIP
    build.progress = 10;
    log('Extracting project files...');
    const zip = new AdmZip(zipBuffer);
    zip.extractAllTo(buildDir, true);

    // Verify dist folder exists
    const distPath = path.join(buildDir, 'dist');
    try {
      await fs.access(path.join(distPath, 'index.html'));
    } catch {
      throw new Error('No index.html found in dist folder. Build the web project first.');
    }

    // Count files
    const fileCount = await countFiles(distPath);
    log(`Found ${fileCount} files in dist folder`);

    // Initialize npm project
    build.progress = 15;
    log('Initializing Capacitor project...');
    await execAsync('npm init -y', { cwd: buildDir });

    // Install Capacitor
    build.progress = 20;
    log('Installing Capacitor dependencies (this may take a minute)...');
    // Use Capacitor 5.x for Java 17 compatibility (Capacitor 6+ requires Java 21)
    await execAsync('npm install @capacitor/cli@5 @capacitor/core@5 @capacitor/android@5 --loglevel=error', {
      cwd: buildDir,
      timeout: 180000
    });

    // Create capacitor.config.json
    build.progress = 30;
    log('Creating Capacitor configuration...');
    const capConfig = {
      appId: config.packageId,
      appName: config.appName,
      webDir: 'dist',
      android: {
        allowMixedContent: true,
        buildOptions: {
          signingType: 'apksigner'
        }
      },
      server: {
        androidScheme: 'https'
      }
    };
    await fs.writeFile(
      path.join(buildDir, 'capacitor.config.json'),
      JSON.stringify(capConfig, null, 2)
    );

    // Add Android platform
    build.progress = 40;
    log('Adding Android platform...');
    await execAsync('npx cap add android', {
      cwd: buildDir,
      timeout: 180000
    });

    // Sync web assets
    build.progress = 50;
    log('Syncing web assets to Android project...');
    await execAsync('npx cap sync android', {
      cwd: buildDir,
      timeout: 120000
    });

    // Update app icon - use provided icon or auto-detect from project
    build.progress = 55;
    let iconSource = null;

    if (config.iconBase64) {
      log('Using provided app icon...');
      iconSource = { type: 'base64', data: config.iconBase64 };
    } else {
      log('Auto-detecting app icon from project...');
      iconSource = await autoDetectIcon(distPath, log);
    }

    if (iconSource) {
      try {
        if (iconSource.type === 'base64') {
          await updateAppIcon(buildDir, iconSource.data);
        } else {
          await updateAppIconFromFile(buildDir, iconSource.path);
        }
        log('App icon updated successfully');
      } catch (iconError) {
        log(`Warning: Failed to update icon: ${iconError.message}`);
      }
    } else {
      log('No app icon found, using default Capacitor icon');
    }

    // Update app colors if provided
    if (config.primaryColor) {
      build.progress = 57;
      log('Updating app theme colors...');
      await updateAppColors(buildDir, config.primaryColor);
    }

    // Make gradlew executable
    const gradlew = path.join(buildDir, 'android', 'gradlew');
    await execAsync(`chmod +x ${gradlew}`);

    // Build APK
    build.progress = 60;
    const buildType = config.buildType || 'debug';
    const gradleTask = buildType === 'release' ? 'assembleRelease' : 'assembleDebug';
    log(`Building APK (${buildType})... This may take several minutes on first run.`);

    const { stdout, stderr } = await execAsync(`./gradlew ${gradleTask} --no-daemon -q`, {
      cwd: path.join(buildDir, 'android'),
      timeout: timeout,
      env: {
        ...process.env,
        JAVA_HOME: '/usr/lib/jvm/java-17-openjdk-amd64',
        ANDROID_HOME: '/opt/android-sdk',
        ANDROID_SDK_ROOT: '/opt/android-sdk'
      }
    });

    if (stderr && !stderr.includes('BUILD SUCCESSFUL')) {
      log(`Gradle warnings: ${stderr.slice(0, 500)}`);
    }

    build.progress = 90;
    log('Gradle build complete, locating APK...');

    // Find and copy APK
    const apkDir = path.join(buildDir, 'android/app/build/outputs/apk', buildType);
    let apkFiles;
    try {
      apkFiles = await fs.readdir(apkDir);
    } catch {
      throw new Error(`APK output directory not found: ${apkDir}`);
    }

    const apkFile = apkFiles.find(f => f.endsWith('.apk'));
    if (!apkFile) {
      throw new Error('APK file not found after build');
    }

    await fs.copyFile(path.join(apkDir, apkFile), outputPath);

    // Get APK size
    const stats = await fs.stat(outputPath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

    // Cleanup build directory
    build.progress = 95;
    log('Cleaning up build files...');
    await fs.rm(buildDir, { recursive: true, force: true });

    // Update build state
    build.status = 'complete';
    build.progress = 100;
    build.apkPath = outputPath;
    build.apkSize = stats.size;
    build.completedAt = new Date().toISOString();
    log(`Build complete! APK size: ${sizeMB} MB`);

    // Schedule APK cleanup after 1 hour
    setTimeout(async () => {
      try {
        await fs.unlink(outputPath);
        console.log(`Cleaned up APK: ${buildId}`);
      } catch {}
    }, 60 * 60 * 1000);

  } catch (error) {
    build.status = 'failed';
    build.error = error.message;
    build.completedAt = new Date().toISOString();
    log(`Build failed: ${error.message}`);

    // Cleanup on failure
    await fs.rm(buildDir, { recursive: true, force: true }).catch(() => {});

    throw error;
  }
}

async function countFiles(dir) {
  let count = 0;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      count += await countFiles(path.join(dir, entry.name));
    } else {
      count++;
    }
  }
  return count;
}

async function updateAppIcon(buildDir, iconBase64) {
  const iconBuffer = Buffer.from(iconBase64, 'base64');
  const resDir = path.join(buildDir, 'android/app/src/main/res');

  const sizes = {
    'mipmap-mdpi': 48,
    'mipmap-hdpi': 72,
    'mipmap-xhdpi': 96,
    'mipmap-xxhdpi': 144,
    'mipmap-xxxhdpi': 192
  };

  for (const [folder, size] of Object.entries(sizes)) {
    const folderPath = path.join(resDir, folder);

    // Ensure folder exists
    await fs.mkdir(folderPath, { recursive: true });

    const iconPath = path.join(folderPath, 'ic_launcher.png');
    const roundIconPath = path.join(folderPath, 'ic_launcher_round.png');
    const foregroundPath = path.join(folderPath, 'ic_launcher_foreground.png');

    // Resize icon
    const resized = await sharp(iconBuffer)
      .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toBuffer();

    await fs.writeFile(iconPath, resized);
    await fs.writeFile(roundIconPath, resized);
    await fs.writeFile(foregroundPath, resized);
  }
}

async function updateAppIconFromFile(buildDir, iconFilePath) {
  const iconBuffer = await fs.readFile(iconFilePath);
  const resDir = path.join(buildDir, 'android/app/src/main/res');

  const sizes = {
    'mipmap-mdpi': 48,
    'mipmap-hdpi': 72,
    'mipmap-xhdpi': 96,
    'mipmap-xxhdpi': 144,
    'mipmap-xxxhdpi': 192
  };

  for (const [folder, size] of Object.entries(sizes)) {
    const folderPath = path.join(resDir, folder);
    await fs.mkdir(folderPath, { recursive: true });

    const iconPath = path.join(folderPath, 'ic_launcher.png');
    const roundIconPath = path.join(folderPath, 'ic_launcher_round.png');
    const foregroundPath = path.join(folderPath, 'ic_launcher_foreground.png');

    const resized = await sharp(iconBuffer)
      .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toBuffer();

    await fs.writeFile(iconPath, resized);
    await fs.writeFile(roundIconPath, resized);
    await fs.writeFile(foregroundPath, resized);
  }
}

async function autoDetectIcon(distPath, log) {
  // Common icon file patterns to search for (in priority order)
  const iconPatterns = [
    // PWA icons (highest priority - usually best quality)
    'icon-512x512.png',
    'icon-512.png',
    'icons/icon-512x512.png',
    'icons/512x512.png',
    'icon-384x384.png',
    'icon-256x256.png',
    'icon-192x192.png',
    'icon-192.png',
    'icons/icon-192x192.png',
    'icons/192x192.png',
    // Apple touch icons (good quality)
    'apple-touch-icon.png',
    'apple-touch-icon-180x180.png',
    'apple-touch-icon-precomposed.png',
    // Standard icons
    'icon.png',
    'logo.png',
    'app-icon.png',
    'favicon.png',
    // In assets/images folders
    'assets/icon.png',
    'assets/logo.png',
    'assets/images/icon.png',
    'assets/images/logo.png',
    'images/icon.png',
    'images/logo.png',
    'img/icon.png',
    'img/logo.png',
    // Favicon as last resort (usually small)
    'favicon.ico',
    'favicon-32x32.png',
    'favicon-16x16.png'
  ];

  // Try each pattern
  for (const pattern of iconPatterns) {
    const iconPath = path.join(distPath, pattern);
    try {
      const stat = await fs.stat(iconPath);
      if (stat.isFile()) {
        // Verify it's a valid image
        const ext = path.extname(iconPath).toLowerCase();
        if (['.png', '.jpg', '.jpeg', '.ico', '.webp'].includes(ext)) {
          log(`Found icon: ${pattern}`);
          return { type: 'file', path: iconPath };
        }
      }
    } catch {
      // File doesn't exist, try next pattern
    }
  }

  // Try to parse index.html for icon links
  try {
    const indexPath = path.join(distPath, 'index.html');
    const html = await fs.readFile(indexPath, 'utf8');

    // Look for various icon link patterns
    const iconLinkPatterns = [
      /<link[^>]*rel=["']apple-touch-icon["'][^>]*href=["']([^"']+)["']/i,
      /<link[^>]*rel=["']icon["'][^>]*href=["']([^"']+)["']/i,
      /<link[^>]*rel=["']shortcut icon["'][^>]*href=["']([^"']+)["']/i,
      /<link[^>]*href=["']([^"']+)["'][^>]*rel=["']apple-touch-icon["']/i,
      /<link[^>]*href=["']([^"']+)["'][^>]*rel=["']icon["']/i,
    ];

    for (const pattern of iconLinkPatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        let iconHref = match[1];
        // Remove leading slash or ./
        iconHref = iconHref.replace(/^\.?\//, '');
        const iconPath = path.join(distPath, iconHref);

        try {
          const stat = await fs.stat(iconPath);
          if (stat.isFile()) {
            log(`Found icon from HTML: ${iconHref}`);
            return { type: 'file', path: iconPath };
          }
        } catch {
          // Referenced icon doesn't exist
        }
      }
    }
  } catch {
    // Couldn't parse index.html
  }

  return null;
}

async function updateAppColors(buildDir, primaryColor) {
  const colorsPath = path.join(
    buildDir,
    'android/app/src/main/res/values/colors.xml'
  );

  const colorsXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="colorPrimary">${primaryColor}</color>
    <color name="colorPrimaryDark">${darkenColor(primaryColor)}</color>
    <color name="colorAccent">${primaryColor}</color>
</resources>`;

  await fs.writeFile(colorsPath, colorsXml);
}

function darkenColor(hex) {
  const cleanHex = hex.replace('#', '');
  const num = parseInt(cleanHex, 16);
  const r = Math.max(0, (num >> 16) - 30);
  const g = Math.max(0, ((num >> 8) & 0x00FF) - 30);
  const b = Math.max(0, (num & 0x0000FF) - 30);
  return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
}
BUILDER_EOF

# =============================================================================
# .dockerignore
# =============================================================================
echo -e "${YELLOW}Creating .dockerignore...${NC}"
cat > .dockerignore << 'DOCKERIGNORE_EOF'
node_modules
npm-debug.log
.git
.gitignore
.env
*.md
.DS_Store
DOCKERIGNORE_EOF

# =============================================================================
# .gitignore
# =============================================================================
echo -e "${YELLOW}Creating .gitignore...${NC}"
cat > .gitignore << 'GITIGNORE_EOF'
node_modules/
.env
*.log
.DS_Store
GITIGNORE_EOF

# =============================================================================
# README.md
# =============================================================================
echo -e "${YELLOW}Creating README.md...${NC}"
cat > README.md << README_EOF
# APK Build Service

Self-hosted Capacitor APK build service for Shakespeare.

## Quick Start

\`\`\`bash
# Start the service
docker-compose up -d

# Check health
curl http://localhost:${PORT}/health

# View logs
docker-compose logs -f
\`\`\`

## Configuration

Edit \`.env\` to configure:

- \`PORT\` - Service port (default: ${PORT})
- \`API_KEY\` - Authentication key
- \`MAX_CONCURRENT_BUILDS\` - Parallel builds (default: 2)
- \`CORS_ORIGINS\` - Allowed origins (comma-separated)

## API

### Submit Build
\`\`\`bash
curl -X POST http://localhost:${PORT}/api/build \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -F "project=@dist.zip" \\
  -F 'config={"appName":"My App","packageId":"com.example.app"}'
\`\`\`

### Check Status
\`\`\`bash
curl http://localhost:${PORT}/api/build/{buildId}/status \\
  -H "X-API-Key: YOUR_API_KEY"
\`\`\`

### Download APK
\`\`\`bash
curl -o app.apk http://localhost:${PORT}/api/build/{buildId}/download \\
  -H "X-API-Key: YOUR_API_KEY"
\`\`\`

## API Key

Your API key: \`${API_KEY}\`

Keep this secret! Regenerate with: \`openssl rand -hex 32\`
README_EOF

# =============================================================================
# test.sh - Test script
# =============================================================================
echo -e "${YELLOW}Creating test.sh...${NC}"
cat > test.sh << TEST_EOF
#!/bin/bash
# Quick test script for the APK build service

API_KEY="${API_KEY}"
BASE_URL="http://localhost:${PORT}"

echo "Testing APK Build Service..."
echo ""

# Health check
echo "1. Health check..."
curl -s "\$BASE_URL/health" | jq .
echo ""

# Create a minimal test project
echo "2. Creating test project..."
mkdir -p /tmp/test-apk-project/dist
cat > /tmp/test-apk-project/dist/index.html << 'HTML'
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Test App</title>
  <style>
    body { font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
    .card { background: white; padding: 2rem; border-radius: 1rem; box-shadow: 0 10px 40px rgba(0,0,0,0.2); text-align: center; }
    h1 { margin: 0 0 0.5rem 0; color: #333; }
    p { color: #666; margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Hello from Capacitor!</h1>
    <p>Built with Shakespeare APK Builder</p>
  </div>
</body>
</html>
HTML

# Create ZIP
cd /tmp/test-apk-project
zip -r /tmp/test-project.zip dist/
cd - > /dev/null

echo "3. Submitting build..."
RESPONSE=\$(curl -s -X POST "\$BASE_URL/api/build" \\
  -H "X-API-Key: \$API_KEY" \\
  -F "project=@/tmp/test-project.zip" \\
  -F 'config={"appName":"Test App","packageId":"com.shakespeare.test"}')

BUILD_ID=\$(echo "\$RESPONSE" | jq -r '.buildId')
echo "Build ID: \$BUILD_ID"
echo ""

if [ "\$BUILD_ID" == "null" ]; then
  echo "Error: \$RESPONSE"
  exit 1
fi

# Poll for status
echo "4. Waiting for build to complete..."
while true; do
  STATUS=\$(curl -s "\$BASE_URL/api/build/\$BUILD_ID/status" -H "X-API-Key: \$API_KEY")
  BUILD_STATUS=\$(echo "\$STATUS" | jq -r '.status')
  PROGRESS=\$(echo "\$STATUS" | jq -r '.progress')

  echo "   Status: \$BUILD_STATUS (\$PROGRESS%)"

  if [ "\$BUILD_STATUS" == "complete" ]; then
    echo ""
    echo "5. Build complete! Downloading APK..."
    curl -s -o /tmp/test-app.apk "\$BASE_URL/api/build/\$BUILD_ID/download" -H "X-API-Key: \$API_KEY"
    ls -lh /tmp/test-app.apk
    echo ""
    echo "APK saved to: /tmp/test-app.apk"
    break
  elif [ "\$BUILD_STATUS" == "failed" ]; then
    echo ""
    echo "Build failed!"
    echo "\$STATUS" | jq .
    exit 1
  fi

  sleep 5
done

# Cleanup
rm -rf /tmp/test-apk-project /tmp/test-project.zip

echo ""
echo "Test complete!"
TEST_EOF
chmod +x test.sh

# =============================================================================
# Final setup
# =============================================================================
echo ""
echo -e "${GREEN}All files created successfully!${NC}"
echo ""

# Build and optionally start
if [ "$START_SERVICE" = true ]; then
  echo -e "${YELLOW}Building Docker image (this may take 5-10 minutes on first run)...${NC}"
  $COMPOSE_CMD build

  echo -e "${YELLOW}Starting service...${NC}"
  $COMPOSE_CMD up -d

  echo ""
  echo -e "${GREEN}Service started!${NC}"
  echo ""

  # Wait for service to be ready
  echo -e "${YELLOW}Waiting for service to be ready...${NC}"
  for i in {1..30}; do
    if curl -s "http://localhost:${PORT}/health" > /dev/null 2>&1; then
      echo -e "${GREEN}Service is ready!${NC}"
      break
    fi
    sleep 2
  done
fi

# Print summary
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
if [ "$UPGRADE_MODE" = true ]; then
  echo -e "${GREEN}                   Upgrade Complete!                           ${NC}"
else
  echo -e "${GREEN}                    Setup Complete!                            ${NC}"
fi
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${YELLOW}Directory:${NC}    $(pwd)"
echo -e "  ${YELLOW}Port:${NC}         ${PORT}"
if [ "$UPGRADE_MODE" = true ]; then
  echo -e "  ${YELLOW}API Key:${NC}      (preserved from previous installation)"
else
  echo -e "  ${YELLOW}API Key:${NC}      ${API_KEY}"
fi
echo ""
echo -e "  ${YELLOW}Health Check:${NC} curl http://localhost:${PORT}/health"
echo ""
echo -e "  ${YELLOW}Commands:${NC}"
echo "    Start:      $COMPOSE_CMD up -d"
echo "    Stop:       $COMPOSE_CMD down"
echo "    Logs:       $COMPOSE_CMD logs -f"
echo "    Rebuild:    $COMPOSE_CMD up -d --build"
echo "    Test:       ./test.sh"
echo ""
echo -e "  ${YELLOW}Shakespeare Integration:${NC}"
echo "    Build Service URL:  http://YOUR_SERVER_IP:${PORT}"
echo "    API Key:            ${API_KEY}"
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""
