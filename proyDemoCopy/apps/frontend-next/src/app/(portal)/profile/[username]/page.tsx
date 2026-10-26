import Link from "next/link";
import { getCurrentAccessToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api-client";
import type { MyHistoryItem } from "@/types/quiz";
import { PhoneLink } from "@/components/shared/PhoneLink"; // [2026-10-24]: teléfono como enlace `tel:`

interface UserPublic {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  section: string | null;
  phone?: string | null; // [2026-10-24]: GET /users/:id lo devuelve (null si no hay)
  createdAt: string;
}

async function getPublicProfile(userId: string): Promise<UserPublic | null> {
  const token = await getCurrentAccessToken();
  if (!token) return null;
  try {
    return await apiFetch<UserPublic>(`/users/${userId}`, {
      bearer: token,
    });
  } catch {
    return null;
  }
}

async function getUserStats(userId: string): Promise<{ quizzesCompleted: number; avgAccuracy: number; totalPoints: number } | null> {
  const token = await getCurrentAccessToken();
  if (!token) return null;
  try {
    const history = await apiFetch<MyHistoryItem[]>(`/quiz/sessions/by-user/${userId}?limit=100`, {
      bearer: token,
    });
    const completed = history.filter((s) => s.status === "completed");
    const totalPoints = completed.reduce((sum, s) => sum + s.totalScore, 0);
    const avgAccuracy = completed.length > 0
      ? completed.reduce((sum, s) => sum + s.accuracy, 0) / completed.length
      : 0;
    return {
      quizzesCompleted: completed.length,
      avgAccuracy: Math.round(avgAccuracy * 100),
      totalPoints,
    };
  } catch {
    return null;
  }
}

export default async function PublicProfilePage(props: { params: Promise<{ username: string }> }) {
  const { username } = await props.params;
  const [profile, stats] = await Promise.all([
    getPublicProfile(username),
    getUserStats(username),
  ]);

  if (!profile) {
    return (
      <div className="grid min-h-[60vh] place-items-center py-4">
        <div className="text-center space-y-3">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Usuario no encontrado</h1>
          <Link href="/profile" className="text-sm text-primary hover:underline">
            Volver a mi perfil
          </Link>
        </div>
      </div>
    );
  }

  const displayName = `${profile.firstName} ${profile.lastName}`.trim() || profile.email;

  return (
    <div className="w-full space-y-5 py-4">{/* [2026-10-23]: <div> alineado con la barra superior (el layout aporta el único <main>) */}
      <header className="text-center space-y-2">
        <div className="w-20 h-20 rounded-full bg-gradient-brand mx-auto flex items-center justify-center text-2xl font-bold text-white">
          {profile.firstName.charAt(0)}{profile.lastName.charAt(0)}
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{displayName}</h1>
        {profile.section && (
          <p className="text-sm text-muted-foreground">Sección: {profile.section}</p>
        )}
        {/* [Teléfono · 2026-10-24]: solo si existe (`&&` cortocircuito JS) */}
        {profile.phone && (
          <p className="text-sm text-muted-foreground">
            Teléfono: <PhoneLink phone={profile.phone} />
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Miembro desde {new Date(profile.createdAt).toLocaleDateString("es-CO")}
        </p>
      </header>

      {stats && (
        <section className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-card p-4 text-center">
            <p className="text-2xl font-bold">{stats.quizzesCompleted}</p>
            <p className="text-xs text-muted-foreground">Quizzes completados</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 text-center">
            <p className="text-2xl font-bold">{stats.avgAccuracy}%</p>
            <p className="text-xs text-muted-foreground">Precisión promedio</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 text-center">
            <p className="text-2xl font-bold">{stats.totalPoints}</p>
            <p className="text-xs text-muted-foreground">Puntos totales</p>
          </div>
        </section>
      )}
    </div>
  );
}
