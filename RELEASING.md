# Releasing

## GitHub Release

1. Verify the working tree is clean.
2. Run the local verification gate:
   - `python -m build`
   - `pytest`
3. Create and push a version tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

Pushing a `v*` tag triggers `.github/workflows/release.yml`, which:

- builds sdist and wheel artifacts
- runs `twine check`
- creates or updates the matching GitHub release
- uploads the built distributions to that release

## Optional PyPI Publishing

PyPI publish is gated behind the repository variable `PYPI_PUBLISH=true`.

To enable it:

1. Create the `opensky-cli` package on PyPI.
2. Configure trusted publishing for this GitHub repository in PyPI.
3. Create the GitHub Actions environment `pypi` if you want environment protection rules.
4. Set the repository variable `PYPI_PUBLISH` to `true`.

Once that is configured, the same tag-based release workflow publishes the built distributions to PyPI after the GitHub release assets are created.

Public install target:

```bash
pip install opensky-cli
```
