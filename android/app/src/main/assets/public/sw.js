/**
 * Iron Titans 3D — Service Worker
 * Version: 1.0.0 (iron-titans-v1.0.0)
 * Provides 100% offline gameplay, asset pre-caching, and instant standalone loading.
 */

const CACHE_NAME = 'iron-titans-v1.0.0';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon.png',

  // Core Engine & Utilities
  './js/lib/three.min.js',
  './js/utils/MathUtils.js',
  './js/utils/ObjectPool.js',
  './js/utils/SaveManager.js',
  './js/data/GameConfig.js',
  './js/data/MechRegistry.js',
  './js/data/WeaponRegistry.js',

  // Audio, VFX & Shaders
  './js/audio/AudioManager.js',
  './js/3d/MaterialSystem.js',
  './js/3d/VFXManager.js',

  // Progression & Missions
  './js/progression/EventManager.js',
  './js/progression/Progression2.js',
  './js/progression/NotificationManager.js',
  './js/progression/RewardManager.js',
  './js/progression/MissionSystem.js',

  // Online & Networking Layer
  './js/network/NetworkProtocol.js',
  './js/network/NetworkTransform.js',
  './js/network/NetworkInterpolation.js',
  './js/network/NetworkPlayer.js',
  './js/network/NetworkCombat.js',
  './js/network/ServerAdapter.js',
  './js/network/NetworkClient.js',
  './js/network/AuthManager.js',
  './js/network/MatchmakingManager.js',
  './js/network/NetworkRoom.js',
  './js/network/NetworkManager.js',

  // 3D Procedural Builders & Arenas
  './js/3d/WeaponBuilder3D.js',
  './js/3d/MechBuilder3D.js',
  './js/3d/Mech3D.js',
  './js/3d/Arena3D.js',
  './js/3d/arenas/ArenaRegistry.js',
  './js/3d/arenas/TitanDocksArena.js',
  './js/3d/arenas/AshenReactorArena.js',
  './js/3d/Engine3D.js',
  './js/3d/ThirdPersonCamera.js',
  './js/3d/GarageScene.js',

  // Game Modes & Objectives
  './js/modes/GameModeBase.js',
  './js/modes/objectives/CaptureZone.js',
  './js/modes/objectives/ControlPoint.js',
  './js/modes/ObjectiveManager.js',
  './js/modes/TeamSkirmishMode.js',
  './js/modes/DominationMode.js',
  './js/modes/ControlPointMode.js',
  './js/modes/GameModeManager.js',

  // Controls, AI & Combat
  './js/3d/TouchInput.js',
  './js/3d/InputManager.js',
  './js/3d/TeamManager.js',
  './js/3d/SpawnManager.js',
  './js/3d/BotAI.js',
  './js/3d/Combat3D.js',
  './js/3d/MobileHUD.js',
  './js/3d/MatchManager.js',

  // UI & Orchestration
  './js/ui/UIManager.js',
  './js/3d/Main3D.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Pre-caching all Iron Titans v1.0.0 assets');
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[ServiceWorker] Clearing obsolete cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Cache-first strategy for local game assets, falling back to network
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(req).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(req, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // Fallback to index.html for navigation requests when offline
        if (req.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
