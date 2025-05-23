
export function mapLeavesToCalendarEvents(leaves: any[]) {
  return leaves.map(l => ({
    title: `${l.type} Leave (${l.status})`,
    start: l.startDate,
    end: l.endDate,
    status: l.status,
    userId: l.userId,
    id: l.id,
    color: l.status === "APPROVED" ? "green" : l.status === "PENDING" ? "orange" : "red",
  }));
}
