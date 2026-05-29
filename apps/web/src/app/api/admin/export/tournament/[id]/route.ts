import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { generateTournamentExport } from "@/lib/csv-export";
import { getTournamentForExport } from "@/server/dal/tournaments";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const tournament = await getTournamentForExport(id);

    if (!tournament) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const csv = generateTournamentExport(tournament);

    // Nettoyage du nom pour le fichier
    const filename = `RPB_Export_${tournament.name.replace(/[^a-z0-9]/gi, "_")}.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
