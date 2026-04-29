// GroupTab Service Worker — Push Notifications

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim())
})

self.addEventListener('push', (event) => {
  if (!event.data) return

  let data = {}
  try { data = event.data.json() } catch { data = { title: 'GroupTab', body: event.data.text() } }

  const { title, body, icon, badge, url, tag } = data

  event.waitUntil(
    self.registration.showNotification(title || 'GroupTab', {
      body: body || '',
      icon: icon || '/icons/icon-192.png',
      badge: badge || '/icons/icon-192.png',
      tag: tag || 'grouptab',
      renotify: true,
      data: { url: url || '/groups' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/groups'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
