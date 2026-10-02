// Ownership, provenance, counters and ingestion timestamps are always server-owned.
export function editableJobFields(input: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const fields = ['title', 'department', 'experienceLevel', 'industries', 'employmentType', 'locationType',
    'location', 'description', 'requirements', 'preferredQualifications', 'compensation', 'status', 'expiresAt'];
  return Object.fromEntries(Object.entries(input || {}).filter(([key]) => fields.includes(key)));
}
