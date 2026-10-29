// Starter SLA policy: urgent 1h response / 8h resolution; high 4h / 24h;
// medium 8h / 72h; low 24h / 120h. Change these values to fit your organization.
const hours = { urgent: [1, 8], high: [4, 24], medium: [8, 72], low: [24, 120] };
export function deadlines(priority, from = new Date()) {
  const [response, resolution] = hours[priority] || hours.medium;
  return { responseDueAt: new Date(from.getTime() + response * 3600000), resolutionDueAt: new Date(from.getTime() + resolution * 3600000) };
}
export function isSlaBreached(ticket, now = new Date()) {
  if (!ticket.firstResponseAt && now > ticket.responseDueAt) return true;
  if (!ticket.resolvedAt && now > ticket.resolutionDueAt) return true;
  return false;
}
