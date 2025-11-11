# This is an internal guide to updating the package

## 1. Patch the version

```
npm version patch -m "Bump version to %s"
```

## 2. Publish

```
bun publish
```