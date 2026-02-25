const { exec } = require('child_process');
const config = require('../src/config');

console.log(`🚇 Starting ngrok tunnel to port ${config.PORT}...`);

const ngrok = exec(`ngrok http ${config.PORT}`, { stdio: 'inherit' });

ngrok.stdout?.on('data', (data) => {
    console.log(data.toString());
});

ngrok.stderr?.on('data', (data) => {
    console.error(data.toString());
});

ngrok.on('close', (code) => {
    console.log(`ngrok exited with code ${code}`);
});

console.log(`
📋 Instructions:
1. Copy the HTTPS URL from ngrok output
2. Go to Meta for Developers → Your App → Messenger → Settings
3. Paste the URL + "/webhook" as your Callback URL
4. Enter your Verify Token: "${config.FB_VERIFY_TOKEN}"
5. Subscribe to "messages" event
`);
