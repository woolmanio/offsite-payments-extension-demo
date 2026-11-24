import { createPaymentSession } from "~/payments.repository";

/**
 * Saves and starts a payment session.
 * Redirects back to shop if payment session was created.
 */
export const action = async ({ request }) => {
  const requestBody = await request.json();

  const shopDomain = request.headers.get("shopify-shop-domain");

  const paymentSession = await createPaymentSession(createParams(requestBody, shopDomain));

  if (!paymentSession) throw new Response("A PaymentSession couldn't be created.", { status: 500 });

  return { "redirect_url": buildRedirectUrl(request, paymentSession.id) };
}

const createParams = ({id, gid, group, amount, currency, test, kind, customer, payment_method, proposed_at, cancel_url}, shopDomain) => (
  {
    id,
    gid,
    group,
    amount,
    currency,
    test,
    kind,
    customer,
    paymentMethod: payment_method,
    proposedAt: proposed_at,
    cancelUrl: cancel_url,
    shop: shopDomain
  }
)

const buildRedirectUrl = (request, id) => {
  // request.url is http:// behind a TLS-terminating tunnel/proxy, and Shopify
  // checkout fails with a redirect_url that isn't https. Prefer the public app
  // URL provided by the Shopify CLI (SHOPIFY_APP_URL).
  const baseUrl = process.env.SHOPIFY_APP_URL?.replace(/\/$/, "");
  if (baseUrl) return `${baseUrl}/app/payment_simulator/${id}`;

  return `${request.url.slice(0, request.url.lastIndexOf("/"))}/payment_simulator/${id}`
}
