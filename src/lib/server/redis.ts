import { createClient } from 'redis';
import { KEYDB_PASSWORD, KEYDB_URL } from '$env/static/private';

// Create Redis client for KeyDB
// Build URL with password embedded for KeyDB authentication
const client = createClient({
    url: KEYDB_URL,
    password: KEYDB_PASSWORD
});

// Handle connection events
client.on('error', (err) => {
    console.error('Redis Client Error:', err);
});

client.on('connect', () => {
    console.log('Connected to KeyDB');
});

client.on('ready', () => {
    console.log('KeyDB client ready');
});

client.on('end', () => {
    console.log('KeyDB connection ended');
});

// Connect to Redis
let isConnected = false;

async function ensureConnection() {
    if (!isConnected) {
        try {
            await client.connect();
            isConnected = true;
        } catch (error) {
            console.error('Failed to connect to KeyDB:', error);
            throw error;
        }
    }
}

// Export the client and utility functions
export { client as redis };

export async function publishToChannel(channel: string, message: any) {
    try {
        await ensureConnection();
        const messageString = typeof message === 'string' ? message : JSON.stringify(message);
        const result = await client.publish(channel, messageString);
        console.log(`Published message to channel "${channel}". Subscribers: ${result}`);
        return result;
    } catch (error) {
        console.error(`Failed to publish to channel "${channel}":`, error);
        throw error;
    }
}

export async function subscribeToChannel(channel: string, callback: (message: string) => void) {
    try {
        await ensureConnection();
        await client.subscribe(channel, callback);
        console.log(`Subscribed to channel "${channel}"`);
    } catch (error) {
        console.error(`Failed to subscribe to channel "${channel}":`, error);
        throw error;
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    if (isConnected) {
        await client.quit();
        isConnected = false;
    }
});

process.on('SIGTERM', async () => {
    if (isConnected) {
        await client.quit();
        isConnected = false;
    }
});