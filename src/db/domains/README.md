# `src/db/domains/`

One folder per domain — the same rule as `src/features/`: **where a file goes is
decided by who owns it.** A domain owns its tables, its SQL, its row shape and
its entity mapping, and exposes exactly one thing to the rest of the server: its
repository.

```
src/db/domains/protocols/
├── protocols.queries.ts     every SQL string of the domain, named
├── protocols.dao.ts         extends BaseDao — binds params, returns rows
├── protocols.repository.ts  extends BaseRepository — rows -> entities, rules
├── protocols.types.ts       the row type + the domain entity
└── index.ts                 the barrel — exports the repository (and its types)
```

`protocols/` is not a sketch: it is the shipped domain behind the protocol
builder. **Read those files rather than the snippets below** when adding a
domain — the snippets are trimmed for the shape, the real ones carry the
ownership rules.

Rules:

- **Import a domain through its barrel** (`@/db/domains/protocols`). Nothing
  outside the folder imports its DAO or its queries file.
- **A route never writes SQL.** It calls a repository method.
- **All SQL lives in `*.queries.ts`**, as named exported constants, so a query
  can be read, reviewed and reused without hunting through methods.
- **A domain never imports another domain's DAO.** Cross-domain work is a
  repository calling another repository, inside one transaction.
- DDL does not live here: tables go in `src/db/schema/index.ts`, in dependency
  order, so boot order stays a single readable list.
- Tests are colocated (`protocols.repository.test.ts`), against an isolated
  database from `openDatabase(":memory:")` — never the singleton.

## Shape of each file

```ts
// protocols.queries.ts
export const INSERT_PROTOCOL = `
  INSERT INTO protocols (id, user_id, document, created_at, updated_at)
  VALUES ($id, $userId, $document, $createdAt, $updatedAt)
`;

export const SELECT_PROTOCOLS_BY_USER = `
  SELECT * FROM protocols WHERE user_id = $userId ORDER BY updated_at DESC
`;
```

```ts
// protocols.dao.ts
export class ProtocolsDao extends BaseDao<ProtocolRow> {
  listByUser(userId: string): ProtocolRow[] {
    return this.all(SELECT_PROTOCOLS_BY_USER, { userId });
  }
}
```

```ts
// protocols.repository.ts
export class ProtocolsRepository extends BaseRepository<ProtocolRow, Protocol> {
  constructor(private readonly dao = new ProtocolsDao()) {
    super();
  }

  protected toEntity(row: ProtocolRow): Protocol {
    return { id: row.id, document: JSON.parse(row.document), updatedAt: row.updated_at };
  }

  listForUser(userId: string): Protocol[] {
    return this.toEntities(this.dao.listByUser(userId));
  }
}
```

Ownership is scoped by the Clerk user id **verified server-side** — the id
reaches a repository from the request's session, never from the request body.
