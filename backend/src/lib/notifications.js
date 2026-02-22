const userClients = new Map();
const roleClients = new Map();
const recentEvents = [];
const MAX_RECENT_EVENTS = 120;

function addClient(map, key, res) {
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(res);
}

function removeClient(map, key, res) {
  if (!map.has(key)) return;
  map.get(key).delete(res);
  if (map.get(key).size === 0) {
    map.delete(key);
  }
}

function sendSse(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

export function subscribeNotifications(req, res) {
  const userId = Number(req.user.sub);
  const role = req.user.role;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  addClient(userClients, userId, res);
  addClient(roleClients, role, res);

  sendSse(res, { type: "connected", message: "notification stream connected", ts: new Date().toISOString() });
  const heartbeat = setInterval(() => {
    sendSse(res, { type: "heartbeat", ts: new Date().toISOString() });
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    removeClient(userClients, userId, res);
    removeClient(roleClients, role, res);
  });
}

export function publishNotification({
  type,
  message,
  data = {},
  userIds = [],
  roles = []
}) {
  const payload = {
    id: `${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    type,
    message,
    data,
    userIds,
    roles,
    createdAt: new Date().toISOString()
  };

  recentEvents.unshift(payload);
  if (recentEvents.length > MAX_RECENT_EVENTS) recentEvents.length = MAX_RECENT_EVENTS;

  const targets = new Set();
  for (const userId of userIds) {
    const bucket = userClients.get(Number(userId));
    if (!bucket) continue;
    for (const client of bucket) targets.add(client);
  }
  for (const role of roles) {
    const bucket = roleClients.get(role);
    if (!bucket) continue;
    for (const client of bucket) targets.add(client);
  }

  for (const client of targets) {
    sendSse(client, payload);
  }
}

export function listRecentNotificationsFor(user) {
  const userId = Number(user.sub);
  const role = user.role;

  return recentEvents.filter((event) => {
    const toUser = event.userIds.includes(userId);
    const toRole = event.roles.includes(role);
    const broadcast = event.userIds.length === 0 && event.roles.length === 0;
    return toUser || toRole || broadcast;
  });
}
