# The Lithos API spec

`lithos-v1.yaml` is the Lithos partner API's OpenAPI document — the same one the
API reference is rendered from. The app's API types are generated from it:

```sh
npm run api:types   # writes src/lib/lithos/openapi.d.ts
```

`src/lib/lithos/types.ts` gives those types the names the app uses. Nothing in it
is written by hand, so when the spec changes, regenerate and the compiler shows
every place the change reaches. CI fails if the generated file and this spec
disagree.

Copied from `lithoshealth/lithos` at `7649f24a` (2026-10-07),
`api/swagger/v1/swagger.yaml`. To update it, copy that file over this one, run
`npm run api:types`, and fix what the compiler finds.
