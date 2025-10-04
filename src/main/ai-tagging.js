const OpenAI = require("openai");

const TAGGING_SYSTEM_PROMPT = `You are an expert file tagging assistant. Your goal is to generate 4-6 highly relevant tags based solely on the provided file contents and title. Tags must be single words or very short phrases (1-2 words max) in English, focusing on key themes, topics, entities, or categories. Prioritize broad, umbrella terms that cover related subtopics without redundancy—e.g., use "Grading" to encompass penalties, appeals, and scores rather than separate tags. Always choose brevity and the most common/general terms over synonyms, specifics, or longer descriptions—e.g., use "Cat" instead of "Kitten," "Apple" (fruit) instead of "Granny Smith," or "Stack" instead of "Stack Operations". Use singular forms for nouns (e.g., "Linked List" instead of "Linked Lists") unless the concept inherently requires plural. Avoid generic tags like "document," "file" unless they uniquely apply. For normalization: If a tag has more than one word, use a single space to separate them; capitalize the first letter of each word in every tag. Output only the tags as a comma-separated list, with no additional explanation.`;

/**
 * Generate tags for a file using AI
 * @param {string} fileName - Name of the file
 * @param {string} fileContent - Content of the file
 * @param {object} aiSettings - AI settings {apiEndpoint, apiKey}
 * @returns {Promise<{success: boolean, tags?: string[], error?: string}>}
 */
async function generateTags(fileName, fileContent, aiSettings) {
    try {
        if (!aiSettings || !aiSettings.apiKey) {
            return {
                success: false,
                error: "AI settings not configured. Please set API key in settings.",
            };
        }

        // Create OpenAI client with custom endpoint
        const openai = new OpenAI({
            apiKey: aiSettings.apiKey,
            baseURL: aiSettings.apiEndpoint || "https://api.openai.com/v1",
        });

        // Truncate content if too long (limit to ~6000 characters to stay within token limits)
        const truncatedContent =
            fileContent.length > 6000
                ? fileContent.substring(0, 6000) + "\n\n[Content truncated...]"
                : fileContent;

        // Create user message
        const userMessage = `File name: ${fileName}\n\nFile content:\n${truncatedContent}`;

        // Call OpenAI API
        const completion = await openai.chat.completions.create({
            model: aiSettings.model || "gpt-4o-mini",
            messages: [
                { role: "system", content: TAGGING_SYSTEM_PROMPT },
                { role: "user", content: userMessage },
            ],
            temperature: 0.7,
            max_tokens: 100,
        });

        // Parse response
        const responseText = completion.choices[0].message.content.trim();

        // Split by comma and clean up tags
        const tags = responseText
            .split(",")
            .map((tag) => tag.trim())
            .filter((tag) => tag.length > 0 && tag.length <= 30); // Reasonable tag length limit

        if (tags.length === 0) {
            return {
                success: false,
                error: "No tags were generated. Please try again.",
            };
        }

        return { success: true, tags };
    } catch (error) {
        console.error("Error generating tags:", error);

        // Provide more specific error messages
        if (error.status === 401) {
            return {
                success: false,
                error: "Invalid API key. Please check your AI settings.",
            };
        } else if (error.status === 429) {
            return {
                success: false,
                error: "Rate limit exceeded. Please try again later.",
            };
        } else if (
            error.code === "ENOTFOUND" ||
            error.code === "ECONNREFUSED"
        ) {
            return {
                success: false,
                error: "Cannot connect to API endpoint. Please check your network and endpoint URL.",
            };
        }

        return {
            success: false,
            error: `Failed to generate tags: ${error.message}`,
        };
    }
}

module.exports = { generateTags };
