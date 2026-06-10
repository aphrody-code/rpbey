"use client";

import { gql } from "@/gql";
import useSWR from "swr";

export interface BeybladeOption {
  id: string;
  name: string;
  imageUrl: string | null;
  beyType: string | null;
}

const QUERY = gql(`
  query ProfileBeyblades {
    beyblades(limit: 100) {
      id
      name
      imageUrl
      beyType
    }
  }
`);

interface GraphqlBeybladesResponse {
  data?: { beyblades?: BeybladeOption[] };
}

const fetcher = async (): Promise<BeybladeOption[]> => {
  const queryStr = QUERY.loc?.source.body ?? "";
  const res = await fetch("/api/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: queryStr }),
  });
  const json = (await res.json()) as GraphqlBeybladesResponse;
  return json.data?.beyblades ?? [];
};

/**
 * Charge le catalogue des beyblades (table DB `beyblades`, FK de `favoriteBeybladeId`)
 * via l'endpoint GraphQL public. Le catalogue est petit (~quelques dizaines), donc on
 * le charge en entier pour alimenter un Autocomplete côté client.
 */
export function useBeybladeOptions() {
  const { data, isLoading } = useSWR<BeybladeOption[]>("graphql:profile-beyblades", fetcher, {
    revalidateOnFocus: false,
  });
  return { options: data ?? [], isLoading };
}
