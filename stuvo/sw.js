const CACHE_NAME = 'stuvo-shell-v4';
const SHELL_ASSETS = [
  '/',
  '/stuvo/index.html',
  '/stuvo/styles.css',
  '/stuvo/router.js',
  '/stuvo/components.js',
  '/stuvo/firebase.js',
  '/stuvo/cloudinary.js',
  '/stuvo/screens/auth/login.js',
  '/stuvo/screens/auth/pendingApproval.js',
  '/stuvo/screens/student/dashboard.js',
  '/stuvo/screens/student/attendance.js',
  '/stuvo/screens/student/homework.js',
  '/stuvo/screens/student/testReports.js',
  '/stuvo/screens/student/timetable.js',
  '/stuvo/screens/student/studyHub.js',
  '/stuvo/screens/student/practiceBits.js',
  '/stuvo/screens/student/community.js',
  '/stuvo/screens/student/_lib/nextBestAction.js',
  // Perf: teacher/admin screens are cached on first visit via the fetch
  // handler below — precaching only the student shell speeds up SW install.
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_ASSETS).catch(() => {}))
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

// Network-first strategy so fresh code updates are loaded immediately
self.addEventListener('fetch', e => {
  if (e.request.url.includes('/api/')) return; // Never intercept API requests
  if (e.request.method !== 'GET') return;

  e.respondWith(
    fetch(e.request)
      .then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, responseToCache));
        }
        return response;
      })
      .catch(() => caches.match(e.request).then(cached => cached || caches.match('/stuvo/index.html')))
  );
});
