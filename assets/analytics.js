export const ALERT_HISTORY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export function pruneAlertHistory(timestamps, now = Date.now(), retentionMs = ALERT_HISTORY_RETENTION_MS) {
  const cutoff = now - retentionMs;

  return timestamps
    .filter(timestamp => Number.isFinite(timestamp) && timestamp >= cutoff)
    .sort((left, right) => left - right);
}

export function getLabelsForLast24Hours(now = new Date()) {
  const roundedNow = new Date(now);
  roundedNow.setMinutes(0, 0, 0);

  return Array.from({ length: 24 }, (_, index) => {
    const hour = new Date(roundedNow.getTime() - (23 - index) * 60 * 60 * 1000);
    return `${hour.getHours()}:00`;
  });
}

export function getHourlyCounts(timestamps, now = new Date()) {
  const roundedNow = new Date(now);
  roundedNow.setMinutes(0, 0, 0);

  const oneDayAgo = roundedNow.getTime() - 24 * 60 * 60 * 1000;
  const hourlyCounts = Array(24).fill(0);

  timestamps.forEach(timestamp => {
    if (timestamp < oneDayAgo) {
      return;
    }

    const roundedTimestamp = new Date(timestamp);
    roundedTimestamp.setMinutes(0, 0, 0);
    const diffMs = roundedNow.getTime() - roundedTimestamp.getTime();
    const hoursAgo = Math.floor(diffMs / (60 * 60 * 1000));

    if (hoursAgo >= 0 && hoursAgo < 24) {
      hourlyCounts[23 - hoursAgo] += 1;
    }
  });

  return hourlyCounts;
}

export function getLabelsForLast60Minutes(now = new Date()) {
  return Array.from({ length: 60 }, (_, index) => {
    const minute = new Date(now.getTime() - (59 - index) * 60000);
    return minute.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  });
}

export function getMinuteCounts(timestamps, now = new Date()) {
  const oneHourAgo = now.getTime() - 60 * 60 * 1000;
  const minuteCounts = Array(60).fill(0);

  timestamps.forEach(timestamp => {
    if (timestamp < oneHourAgo) {
      return;
    }

    const diffMs = now.getTime() - timestamp;
    const minutesAgo = Math.floor(diffMs / 60000);

    if (minutesAgo >= 0 && minutesAgo < 60) {
      minuteCounts[59 - minutesAgo] += 1;
    }
  });

  return minuteCounts;
}

export function getTodayStats(timestamps, now = new Date()) {
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const todayAlerts = timestamps.filter(timestamp => timestamp >= todayStart);

  if (todayAlerts.length === 0) {
    return {
      count: 0,
      avgInterval: 0,
      first: null,
      last: null,
      timeSinceFirstAlert: 0,
    };
  }

  let totalInterval = 0;

  for (let index = 1; index < todayAlerts.length; index += 1) {
    totalInterval += todayAlerts[index] - todayAlerts[index - 1];
  }

  return {
    count: todayAlerts.length,
    avgInterval: todayAlerts.length > 1 ? totalInterval / (todayAlerts.length - 1) : 0,
    first: todayAlerts[0],
    last: todayAlerts[todayAlerts.length - 1],
    timeSinceFirstAlert: now.getTime() - todayAlerts[0],
  };
}
