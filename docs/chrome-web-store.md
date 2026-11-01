# Chrome Web Store publishing

The GitHub Actions workflow builds and validates a ZIP on every push to `main`. Once the store item and credentials are configured, that same run uploads the ZIP through Chrome Web Store API V2 and submits it for review. Approval and public availability are controlled by Chrome Web Store, so a successful run means submitted, not necessarily live.

## First publication

1. Use an active [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) account. Registration, any required fee, and Google account verification must be completed in the browser.
2. Build and package locally: `npx -y npm@10.9.4 ci --install-strategy=nested && npm test && npx tsc --noEmit && npm run build && (cd dist && zip -qr /tmp/retrace-chrome-web-store.zip .)`. The manifest must be at the root of the ZIP.
3. In the dashboard, add a new item and upload the ZIP. Complete the Store listing, Privacy, and Distribution tabs. Use [store-assets/LISTING.md](../store-assets/LISTING.md) and [PRIVACY.md](../PRIVACY.md) as the checked-in copy. Review the copy and screenshots against the version you upload. Submit the first version manually with the desired visibility.
4. Record the extension ID from the item URL and the publisher ID from **Publisher → Settings** in the dashboard. After the listing is live, replace the placeholder Chrome Web Store link in [README.md](../README.md).

The index and API keys stay in the browser profile; chat history stays in memory during the current session. Indexing sends page text and selected media to Google Gemini. Search queries go to Gemini for embeddings. Chat sends prompts and relevant history results to the selected provider. Retrace does not run a backend. The store privacy answers must describe these provider transfers and the extension's broad browsing permissions accurately.

## Enable automatic updates

1. In Google Cloud, enable **Chrome Web Store API** for a project and create a service account. Add its email under **Account** in the Chrome Web Store Developer Dashboard. A publisher can have only one service account.
2. Create a JSON key for the service account. For `google-github-actions/auth@v3` to generate the short-lived OAuth token used by the workflow, grant the service account **Service Account Token Creator** on itself. Keep the JSON key out of the repository.
3. In GitHub repository **Settings → Secrets and variables → Actions**, set variables `CWS_PUBLISHER_ID` and `CWS_EXTENSION_ID`, and secret `CWS_SERVICE_ACCOUNT_JSON` to the complete JSON key. The workflow skips publishing until both IDs are set. It fails if only one ID or no key is present.
4. Merge the feature branch into `main`. Each push to `main` runs tests, type checking, builds a ZIP artifact, uploads it, checks the upload state, and submits the update for review. The package version appends the GitHub workflow run number to the base `manifest.json` version (for example `1.0.0.42`), so it increases on normal runs. Increase the base version in source when making a larger release. If a manual upload has a higher version, update the base version before the next automatic run.

The workflow can also be rerun from **Actions → Chrome Web Store → Run workflow** on `main`. A manual change to the store item's visibility must first be published manually with the new visibility before API publishing resumes.

Relevant documentation: [first publication](https://developer.chrome.com/docs/webstore/publish), [API V2](https://developer.chrome.com/docs/webstore/using-api), [service accounts](https://developer.chrome.com/docs/webstore/service-accounts).
