// Example of a modern Netlify Scheduled Function
export default async (req, context) => {
  console.log("This runs on a schedule!");
};

export const config = {
  schedule: "@daily" // rate or cron expression here
};
