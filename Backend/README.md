# Backend configuration

## Razorpay subscriptions

Set these backend environment variables before enabling subscription checkout:

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`

In the Razorpay dashboard, configure a webhook pointing to
`https://<your-backend-host>/api/subscriptions/razorpay/webhook` and subscribe to
the `payment.captured` event. Use the webhook secret generated for that webhook
as `RAZORPAY_WEBHOOK_SECRET`; it is separate from the API key secret. Keep all
three values private and out of source control.
