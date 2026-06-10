/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P] : never };
import type { TypedDocumentNode as DocumentNode } from "@graphql-typed-document-node/core";
export type BeyType = "ATTACK" | "BALANCE" | "DEFENSE" | "STAMINA";

export type ProfileBeybladesQueryVariables = Exact<{ [key: string]: never }>;

export type ProfileBeybladesQuery = {
  beyblades: Array<{ id: string; name: string; imageUrl: string | null; beyType: BeyType | null }>;
};

export const ProfileBeybladesDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "ProfileBeyblades" },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "beyblades" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "limit" },
                value: { kind: "IntValue", value: "100" },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "name" } },
                { kind: "Field", name: { kind: "Name", value: "imageUrl" } },
                { kind: "Field", name: { kind: "Name", value: "beyType" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<ProfileBeybladesQuery, ProfileBeybladesQueryVariables>;
