import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { RouteDifficulty, RouteType, TrainlyRoute } from '../types/models';

// Lista pública de rotas (Explorar Rotas).
export function useRoutes() {
  const [routes, setRoutes] = useState<TrainlyRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('routes')
      .select('*, creator:profiles(name, xp, equipped_map_tier)')
      .order('created_at', { ascending: false });
    if (!err && data) {
      setRoutes(
        (data as any[]).map((r) => ({
          ...r,
          creator_name: r.creator?.name ?? 'Atleta',
          creator_xp: r.creator?.xp ?? 0,
          creator_map_tier: r.creator?.equipped_map_tier ?? null,
        })) as TrainlyRoute[],
      );
      setError(false);
    } else {
      setError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const publishRoute = useCallback(
    async (input: {
      createdBy: string;
      sourceActivityId?: string | null;
      name: string;
      type: RouteType;
      difficulty: RouteDifficulty;
      terrain?: string;
      distanceKm: number;
      elevationM?: number | null;
      path: [number, number][];
    }) => {
      const { error } = await supabase.from('routes').insert({
        created_by: input.createdBy,
        source_activity_id: input.sourceActivityId ?? null,
        name: input.name,
        type: input.type,
        difficulty: input.difficulty,
        terrain: input.terrain || null,
        distance_km: input.distanceKm,
        elevation_m: input.elevationM ?? null,
        path: input.path,
      });
      if (error) throw error;
      await load();
    },
    [load],
  );

  const deleteRoute = useCallback(
    async (routeId: string) => {
      const { error } = await supabase.from('routes').delete().eq('id', routeId);
      if (error) throw error;
      await load();
    },
    [load],
  );

  return { routes, loading, error, reload: load, publishRoute, deleteRoute };
}

// Detalhe de uma rota específica (RouteDetailScreen).
export function useRouteDetail(routeId: string | undefined) {
  const [route, setRoute] = useState<TrainlyRoute | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!routeId) return;
    setLoading(true);
    const { data } = await supabase
      .from('routes')
      .select('*, creator:profiles(name, xp, equipped_map_tier)')
      .eq('id', routeId)
      .single();
    if (data) {
      const r = data as any;
      setRoute({
        ...r,
        creator_name: r.creator?.name ?? 'Atleta',
        creator_xp: r.creator?.xp ?? 0,
        creator_map_tier: r.creator?.equipped_map_tier ?? null,
      } as TrainlyRoute);
    }
    setLoading(false);
  }, [routeId]);

  useEffect(() => {
    load();
  }, [load]);

  return { route, loading, reload: load };
}
