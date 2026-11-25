# Backend configuration

## Razorpay subscriptions

Set these backend environment variables before enabling subscription checkout:

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`

The checkout payment is verified by the backend directly with Razorpay, so no
webhook secret is required. Keep both API credentials private and out of source
control.
