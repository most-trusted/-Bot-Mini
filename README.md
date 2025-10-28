
# Bot-Mini

Deploy steps:
1. Push this repo to GitHub.
2. Create a new Render Web Service, connect to the GitHub repo.
3. Build & Start command: `npm install && npm start` (Render runs this automatically with `start`).
4. Open your-deployment-url and use the Code Generator page.

How pairing works:
- Visit `/`, enter the phone number (like `2547...`) and click Generate Code.
- The page will show a pairing **code** and a QR image. Copy that code and use your WhatsApp client to complete pairing.
- Once pairing completes, session credentials are saved to `./sessions/<sessionId>.json` and a persistent bot instance starts automatically.

Notes & next steps:
- This is a minimal combined template. For production you should add authentication on the generator endpoint and persist sessions to an external store (S3/MEGA/DB) if you redeploy or scale.
- Expand the command handler (`messages.upsert`) in `index.js` to implement the song downloader and any other commands.
