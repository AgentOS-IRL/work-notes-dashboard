// Simpler open router client , meant for general llm tasks. 

import OpenAI from 'openai';
import { z } from 'zod';

// 1. Initialize the client pointing to OpenRouter
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": "http://localhost:3000", // Optional: for OpenRouter rankings
    "X-Title": "My TypeScript App",          // Optional: for OpenRouter rankings
  }
});

// // 2. Define your expected TypeScript structure using Zod
// const UserProfileSchema = z.object({
//   name: z.string(),
//   age: z.number(),
//   occupation: z.string(),
//   skills: z.array(z.string())
// });

// // Create a TypeScript type from the Zod schema
// type UserProfile = z.infer<typeof UserProfileSchema>;

// async function getStructuredData(): Promise<UserProfile | null> {
//   try {
//     const response = await openai.chat.completions.create({
//       // Choose an OpenRouter model good at following JSON instructions
//       model: "meta-llama/llama-3.1-8b-instruct", 
//       response_format: { type: "json_object" }, // Forces JSON output
//       messages: [
//         {
//           role: "system",
//           // You MUST explicitly tell the model to output JSON and provide the schema
//           content: `You are a helpful data extraction assistant. 
//           Respond ONLY with valid JSON matching this schema:
//           {
//             "name": "string",
//             "age": "number",
//             "occupation": "string",
//             "skills": ["string"]
//           }`
//         },
//         {
//           role: "user",
//           content: "Extract the profile: John is a 32-year-old software engineer who knows TypeScript, React, and Node.js."
//         }
//       ]
//     });

//     // 3. Extract and parse the response
//     const rawContent = response.choices[0]?.message?.content;
    
//     if (!rawContent) {
//       throw new Error("No content received from OpenRouter.");
//     }

//     // Parse the string into a JSON object, then validate it with Zod
//     const parsedJson = JSON.parse(rawContent);
//     const validatedData = UserProfileSchema.parse(parsedJson);

//     return validatedData;

//   } catch (error) {
//     console.error("Failed to fetch or parse structured data:", error);
//     return null;
//   }
// }

// // Execute
// getStructuredData().then(data => console.log(data));