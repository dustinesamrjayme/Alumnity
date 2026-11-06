import { Attendee } from '../../core/models';

/** Turn get_attendee_list() rows into a CSV suitable for manual check-in sheets. */
export function attendeesToCsv(rows: Attendee[]): string {
  const header = [
    'Registration ID', 'First Name', 'Last Name',
    'Status', 'Payment', 'Checked In At',
  ];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([
      r.registration_id,
      quote(r.first_name),
      quote(r.last_name),
      r.attendee_status,
      r.payment_status,
      r.checked_in_at ?? '',
    ].join(','));
  }
  return lines.join('\r\n');
}

function quote(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}