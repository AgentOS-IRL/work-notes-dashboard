import { test } from 'node:test';
import { generateSessionNameFromOpenRouter } from '../src/langchain/open-router-client';


test('generateSessionNameFromOpenRouter', async () => {
    const messages = [
        {
            role: 'user',
            content: 'this is a sample 2 note'
        },
        {
            role: 'user',
            content: 'Its a sample note just for testing the serivce'
        },
    ]

    const sessionName = await generateSessionNameFromOpenRouter(messages);
    console.log(sessionName);
});
