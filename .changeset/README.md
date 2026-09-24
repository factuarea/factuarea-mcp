# Changesets

Every pull request that changes what ships in `@factuarea/mcp` carries a changeset: run
`npx changeset`, pick the bump (`patch`, `minor` or `major`) and describe the change for
someone reading the changelog. Documentation-only and CI-only changes do not need one.

On merge to `main`, the release workflow collects the pending changesets into a
"Version Packages" pull request. Merging that pull request publishes the release — see
[CONTRIBUTING.md](../CONTRIBUTING.md#releases).
