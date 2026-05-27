// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function jsonToCsv(data: Record<string, any>[]): string {
  if (data.length === 0) return '';

  const firstRow = data[0];
  if (!firstRow) return '';

  const headers = Object.keys(firstRow);
  const csvRows = [headers.join(',')];

  for (const row of data) {
    const values = headers.map((header) => {
      const escaped = `${row[header]}`.replace(/"/g, '"');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function generateTournamentExport(tournament: any) {
  // 1. Participants
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const participantsData = tournament.participants.map((p: any) => ({
    Rang: p.finalPlacement || '-',
    Joueur: p.user.name || p.user.username,
    Pseudo_Discord: p.user.discordTag || '-',
    Victoires: p.wins,
    Defaites: p.losses,
    Points: p.user.profile?.rankingPoints || 0,
  }));

  return jsonToCsv(participantsData);
}
