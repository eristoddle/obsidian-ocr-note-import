# Release Process

This document describes how to create a new release of the Notebook OCR Plugin.

## Prerequisites

- Ensure you have push access to the repository
- Make sure all changes are committed and pushed to main
- Verify the build works: `npm run build`

## Release Steps

### Automated Release (Recommended)

1. Run the release script:
   ```bash
   npm run release
   ```

   This will:
   - Bump the patch version (e.g., 1.0.0 → 1.0.1)
   - Update `manifest.json` and `versions.json`
   - Create a git commit
   - Create a git tag
   - Push commits and tags to GitHub

2. The GitHub Action will automatically:
   - Build the plugin
   - Create a draft release with the built files
   - Attach `main.js`, `manifest.json`, and `styles.css`

3. Go to GitHub Releases and:
   - Review the draft release
   - Add release notes describing changes
   - Publish the release

### Manual Release

If you need more control over versioning:

1. Update version manually:
   ```bash
   npm version [major|minor|patch]
   # or specify exact version
   npm version 1.2.3
   ```

2. Push changes:
   ```bash
   git push && git push --tags
   ```

3. Follow steps 2-3 from automated release above

## Version Types

- **Patch** (1.0.0 → 1.0.1): Bug fixes, minor improvements
- **Minor** (1.0.0 → 1.1.0): New features, backward compatible
- **Major** (1.0.0 → 2.0.0): Breaking changes

## Troubleshooting

### Release workflow fails

- Check that the build completes successfully locally
- Ensure all required files exist (main.js, manifest.json)
- Verify GitHub Actions has necessary permissions

### Version mismatch

The `version-bump.mjs` script keeps `package.json`, `manifest.json`, and `versions.json` in sync. If they get out of sync, manually update all three files to match.

## Release Checklist

- [ ] All tests pass
- [ ] Build completes without errors
- [ ] Version numbers updated correctly
- [ ] CHANGELOG updated (if you maintain one)
- [ ] Release notes prepared
- [ ] Tag pushed to GitHub
- [ ] GitHub release published
- [ ] Release announcement (if applicable)
