# Offsite Payments App Demo (Shopify, Remix)

A working demo of a Shopify [offsite payments app](https://shopify.dev/docs/apps/payments), built on Shopify's Remix template. A test checkout on a development store sends a payment session to your local app, where you resolve or reject it in a simulator page. No real payment provider or bank is involved, and no money moves.

This repository is a fork of [Shopify's payments app template](https://github.com/Shopify/example-app--payments-app-template--remix). It includes the routes a simple offsite app needs, a rough client for the [Payments Apps API](https://shopify.dev/docs/api/payments-apps), and two bug fixes (see [Changes from the upstream template](#changes-from-the-upstream-template)). It is for learning and testing, not for production.

## How it works

```
Storefront checkout ──"Pay now"──▶ Shopify ──POST /app/payment_session──▶ your app
                                                                           │ saves the session,
Buyer's browser ◀── redirect to /app/payment_simulator/<id> ───────────────┘ returns redirect_url
        │
        └─ Resolve / Reject / Pending ─▶ your app ──GraphQL (Payments Apps API)──▶ Shopify
                                                                                    marks the order
```

- The **extension** (`extensions/<name>/shopify.extension.toml`) tells Shopify that your app is a payment provider and where to send payment and refund sessions.
- The **app** (Remix routes in `app/routes/`) receives those sessions and, in this demo, lets you resolve them by hand. A real provider would process the payment itself and resolve or reject the session automatically.

## Prerequisites

- Node.js and the [Shopify CLI](https://shopify.dev/docs/apps/tools/cli).
- A Shopify organization with **Payments Partner** access. This is required. Create the dev store and the app in that organization.

## Setup

1. **Create a dev store in your Payments Partner organization.**
   ```shell
   shopify store create dev --demo-data --country FI
   ```
   The CLI prompts for the organization, store name and plan. `--demo-data` populates the store with demo products, so you can check out later without adding any. `--country FI` creates a Finnish store. Keep `FI` in the extension's `supported_countries` (step 7).

2. **Create the app in the Dev Dashboard.** Give it a name and turn **embedding off**. Do not fill in anything else.
   Create the app here, not through the CLI.

3. **Scaffold the project from this repository.**
   ```shell
   shopify app init --template https://github.com/woolmanio/offsite-payments-extension-demo
   ```
   The CLI prompts you:
   - Choose your Payments Partner organization. Use the same organization that in which you create the app in step 2.
   - When asked whether to create a new app or use an existing one, choose **use existing app** and select the app from step 2.

   `init` copies the project, but `shopify.app.toml` still contains the template's placeholders (`name = "<App Name>"`, `client_id = "<API Client ID>"`). The next step links it.

4. **Link the project to the app.**
   ```shell
   npm run config:link
   ```
   Choose your organization, then **use existing app**, and select the app from step 2. If it asks for a configuration file name, the app name is fine. The CLI writes `shopify.app.<app-name>.toml` with the real `client_id` and makes it the active config. Delete the placeholder `shopify.app.toml` so it can't be picked up by mistake. If you ever have more than one linked config, switch with `npm run config:use <app-name>`.

   Then check that the active file contains:
   ```toml
   embedded = false

   [access_scopes]
   scopes = "write_payment_gateways,write_payment_sessions"

   [webhooks]
   api_version = "<a stable API version>"
   ```
   Replace the webhooks version if the CLI wrote one that has not been released yet. `application_url` and the redirect URLs are updated for you by `dev` (`automatically_update_urls_on_dev = true`).

5. **Make sure the extension exists.** Do this after linking (step 4): the extension is generated for the linked app. `extensions/` must contain a payments extension. If it is empty, generate one:
   ```shell
   npm run generate extension
   ```
   Choose **Payments extensions > Offsite**. This creates `extensions/<name>/shopify.extension.toml`.

6. **Start the dev server.**
   ```shell
   npm run dev
   ```
   Select your dev store when asked and note the **tunnel URL** the CLI prints (for example `https://xxxx.trycloudflare.com`). Use `npm run dev` rather than `shopify app dev`: the `predev` script runs the Prisma setup that creates the session table.

7. **Point the extension at your local app.** In `shopify.extension.toml`:
   ```toml
   payment_session_url = "https://<tunnel>/app/payment_session"
   refund_session_url  = "https://<tunnel>/app/refund_session"
   ```
   The paths must match the route file names, including the `/app` prefix. For manual capture and void, also set `capture_session_url` (`/app/capture_session`) and `void_session_url` (`/app/void_session`). Saving the file prints `Updated dev preview on <store>`.
   Make sure `supported_countries` includes `"FI"` to match the store from step 1: `supported_countries = ["FI"]`. A newly generated extension lists `"US"` by default.

8. **Deploy once.**
   ```shell
   npm run deploy
   ```
   See [When to deploy](#when-to-deploy) for why.

9. **Onboard the app.** Press `p` in the `dev` terminal to open the app home. Enter any **Account Name** (an identifier at your "provider"), tick **Ready?**, and submit. You should see "Settings updated!".

10. **Activate the provider in the store admin.** Go to **Settings > Payments**, open your payments app, turn on **test mode**, and click **Activate**.

11. **Open the app home in the browser you will use for checkout**, on the current tunnel URL. The simulator page sits under the app's authenticated routes. A browser without an app session for the current tunnel once received `400 Could not find a shop, can't authenticate request`, and opening the app home first is the most likely reason it then worked. This was not isolated.

12. **Place a test order at the storefront checkout.** Open the storefront (use the password under **Online Store > Preferences** if it is protected), add one of the demo products to the cart, and check out. Choose your provider and click **Pay now**. Do not create the order with **Orders > Create order** in the admin: that never calls a payments app.
    - The terminal shows `POST /app/payment_session 200`.
    - The browser lands on `/app/payment_simulator/<id>`. Choose **Resolve**, **Reject** or **Pending**. On Resolve, the order is marked paid.
    - When your app calls the Payments Apps API (on resolve, reject or pend, and when you submit the onboarding form), the terminal shows `[GraphQL] Making request…` and `[GraphQL] response: …`.

13. **Try refunds, captures and voids (optional).** Start the action from the order in the admin. Shopify POSTs to the matching session URL. Then open `/app/dashboard` in the app, click **Simulate**, and resolve or reject it.

## Each development session

1. `npm run dev` and note the new tunnel URL (the default tunnel URL changes on every run).
2. Update the extension URLs in `shopify.extension.toml`.
3. Open the app home in your checkout browser on the new tunnel URL.
4. Check out at the storefront.

## When to deploy

`npm run dev` and `npm run deploy` do different things.

- **`dev` creates a dev preview.** It applies your local app configuration and extensions to the chosen dev store only, and watches the files so edits sync (this is why saving `shopify.extension.toml` logs `Updated dev preview`). The preview stays on the store after you stop `dev`, until you run `shopify app dev clean` or uninstall the app. `dev clean` restores the store to the last released version.
- **`deploy` creates an app version and releases it.** A release replaces the active version for every store that has the app installed. Shopify's documentation says app configuration changes reach production only after a deploy. `shopify app deploy --no-release` creates a version without releasing it; release it later with `shopify app release --version=<version>`.

**Deploy when:**
- **It is the first run.** Observed here, and not explained by Shopify's documentation: the payment method did not appear at checkout until a version had been deployed and released, even though the dev preview was updating.
- **You change access scopes.** Shopify's documentation says to update the toml and deploy. Each store then has to approve the new scopes, which on a development store usually means reopening or reinstalling the app.
- **You want a store other than your dev store, or the released configuration, to see a change.**

**You do not need to deploy when:**
- the tunnel URL changed. Edit the extension URLs while `dev` is running. (A released version keeps the URLs it was deployed with, so after `dev clean`, or on any other store, it still calls the old tunnel address.)
- you only change code under `app/`. That is served by your local server and is not versioned.

Shopify's documentation does not list which toml fields the dev preview applies compared with a release. If something works in the preview but not after `dev clean`, or the other way around, deploy.

## Tunnel URL

- **Default CLI tunnel (simplest).** A new URL on every `dev` run. Update the extension URLs each time. The app URL and redirect URLs are updated for you.
- **Stable tunnel.** Use a tunnel service with a fixed domain (for example an ngrok static domain) and run `npm run dev -- --tunnel-url https://<your-domain>:<port>`. Set the extension URLs once. Check `npm run dev -- --help` for the exact flag format of your CLI version.

## Project layout

| Route (`app/routes/`) | Purpose |
|---|---|
| `app._index/` | Onboarding form. Calls `paymentsAppConfigure` and stores the configuration. |
| `app.payment_session.jsx` | Receives Shopify's payment session and returns the simulator `redirect_url`. |
| `app.refund_session.jsx`, `app.capture_session.jsx`, `app.void_session.jsx` | Receive refund, capture and void sessions. |
| `app.payment_simulator.$paymentId.jsx` | Simulator: resolve, reject or pend a payment. |
| `app.dashboard.jsx`, `app.dashboard_simulator.$paymentId.jsx` | Simulator for refund, capture and void sessions. |
| `webhooks.jsx` | Handles the `APP_UNINSTALLED` webhook. |

Other files: `app/payments-apps.graphql.js` (Payments Apps API client), `app/payments-apps.schema.js` (its GraphQL documents), `app/payments.repository.js` (database access), `prisma/schema.prisma` (SQLite schema).

Authenticate and query the Admin API with the `authenticate` export of `app/shopify.server.js`. See the [`@shopify/shopify-app-remix` documentation](https://www.npmjs.com/package/@shopify/shopify-app-remix#authenticating-admin-requests).

## Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| Onboarding form crashes with `Cannot read properties of null (reading 'userErrors')` | The Payments Apps API returned an error. Read the `[GraphQL] response:` line in the terminal. |
| `ACCESS_DENIED`, required access `write_payment_gateways` | The app's access token has no payment scopes. Put the scopes in the toml (step 4), run `npm run deploy`, run `shopify app dev clean`, delete the stale session (`sqlite3 prisma/dev.sqlite "DELETE FROM Session;"`), and start `dev` again. `select scope from Session;` should then list the scopes. |
| Provider cannot be activated, or the app keeps asking for setup | The stored configuration has `ready = false`. Resubmit the onboarding form with **Ready?** ticked. |
| Provider is missing at checkout | Not deployed (step 8), not activated or test mode off (step 10), or the checkout country is not in `supported_countries`. Choosing the Test Payment Gateway never reaches your app. |
| Nothing appears in the terminal when you pay | Wrong paths in the extension URLs (missing `_session` or `/app`), a stale tunnel host, or the order was created in the admin instead of at checkout. |
| Checkout says "There was an issue processing your payment" while the terminal shows `POST /app/payment_session 200` | The `redirect_url` must be https. See the first change under [Changes from the upstream template](#changes-from-the-upstream-template). |
| Simulator page returns `400 Could not find a shop, can't authenticate request` | The browser has no app session for the current tunnel. Open the app home on the current tunnel (step 11) and retry. |
| `The table main.Session does not exist` | The Prisma setup did not run. Use `npm run dev`, or run `npm run setup`. |
| "Payments App is not installed on this shop" | Uninstall and reinstall the app, or run `shopify app dev clean` and start `dev` again. |
| Navigation inside the app logs you out | Use `Link` from `@remix-run/react`, not `<a>`, so the user stays authenticated. |
| Reset local data | `npx prisma migrate reset`. This also clears the stored session, so the app has to authenticate again. |

## Changes from the upstream template

- `app/routes/app.payment_session.jsx`: the simulator `redirect_url` is built from `SHOPIFY_APP_URL` instead of `request.url`. Behind a tunnel that terminates TLS, `request.url` is `http://`, and checkout rejects the payment when the redirect is not https. If `SHOPIFY_APP_URL` is unset, the old behavior is the fallback.
- `app/payments.repository.js`: `getOrCreateConfiguration` updates the stored configuration on resubmit. Upstream used `update: {}`, so after a first (for example failed) submission the form values were ignored permanently.

## Beyond the demo

- **The simulator is not a payment provider.** In production, processing starts automatically once a session is created, and your app resolves or rejects the session itself.
- **mTLS** is not included in the template. It is expected to be configured in your own infrastructure.
- **API version.** The template's GraphQL client hardcodes the `unstable` Payments Apps API version, and the version dropdown in the onboarding form is not used. Shopify's tutorial says not to use `unstable` in production.
- **Storage.** Sessions and payment data are stored with [Prisma](https://www.prisma.io/) in SQLite (`prisma/schema.prisma`), which works for a single instance. For anything else, switch to another [datasource provider](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference#datasource) or a different [session storage adapter](https://github.com/Shopify/shopify-api-js/tree/main/docs/guides/session-storage.md).
- **Hosting.** Build with `npm run build` and follow Shopify's [deployment documentation](https://shopify.dev/docs/apps/deployment/web). Set `NODE_ENV=production`.

## Resources

- [Payments apps](https://shopify.dev/docs/apps/payments) and the [offsite payments CLI tutorial](https://shopify.dev/docs/apps/build/payments/offsite/use-the-cli?framework=remix) (it scaffolds with `--template none`, so it does not include this repository's routes or simulator)
- [Payments Apps API](https://shopify.dev/docs/api/payments-apps)
- [Shopify CLI](https://shopify.dev/docs/apps/tools/cli)
- [App versions and releasing](https://shopify.dev/docs/apps/launch/deployment/deploy-app-versions)
- [Managing access scopes](https://shopify.dev/docs/apps/build/authentication-authorization/manage-access-scopes)
- [Remix](https://remix.run/docs) and [`@shopify/shopify-app-remix`](https://github.com/Shopify/shopify-app-js/blob/main/packages/shopify-app-remix/README.md)
- [Polaris](https://polaris.shopify.com/)
