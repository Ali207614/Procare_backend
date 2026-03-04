### Secret Token in the URL (Most Reliable for OnlinePBX)

OnlinePBX allows you to define custom URLs for your webhooks, which means you can easily pass a secure query parameter. This is the most straightforward and stable method.

* **In OnlinePBX:** Navigate to **Integration > Webhooks** in your dashboard and click **Add**.
* **URL Field:** Enter your endpoint and append a secure, randomly generated string as a query parameter.
* *Example:* `https://your-domain.com/api/webhooks/onlinepbx?token=YOUR_SECURE_TOKEN`