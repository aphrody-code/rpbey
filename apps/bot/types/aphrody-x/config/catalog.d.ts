export interface Operation {
  name: string;
  queryId: string;
  operationType: "query" | "mutation" | "subscription";
  featureSwitches: string[];
}
/** Look up a single operation by its exact case-sensitive name. */
export declare function getOperation(name: string): Operation | undefined;
/** Return all operations in the catalog. */
export declare function allOperations(): Operation[];
/** Return only mutation operations. */
export declare function mutations(): Operation[];
/** Return only query operations. */
export declare function queries(): Operation[];
