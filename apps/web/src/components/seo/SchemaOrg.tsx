import { type Thing, type WithContext } from 'schema-dts';

type SchemaOrgProps<T extends Thing> = {
  schema: WithContext<T>;
};

export function SchemaOrg<T extends Thing>({ schema }: SchemaOrgProps<T>) {
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
