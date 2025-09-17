// Load environment variables as early as possible
import { config } from "dotenv";

// Configure dotenv to load .env file
config();

// Export a simple flag to ensure this module is loaded
export const envLoaded = true;