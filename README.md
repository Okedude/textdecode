# TextDecode

Free static GitHub Pages app for creating text unlock challenges.

## Local setup

```bash
npm install
npm run dev
```

## Deploy to GitHub Pages

1. Create a GitHub repository named `textdecode` under the account `okedude`.
2. Upload all files in this folder.
3. Go to repository Settings → Pages.
4. Under Source, choose GitHub Actions.
5. Push to `main`.
6. Your site will be available at:

```text
https://okedude.github.io/textdecode/
```

## Notes

- Shared challenges are stored inside the URL parameter `?c=...`.
- This means it works without a backend.
- Very long texts can create links that are too long for browsers or chat apps.
