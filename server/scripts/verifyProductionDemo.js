require('dotenv').config();

const API_URL = String(process.env.VERIFY_API_URL || process.env.API_URL || '').trim().replace(/\/$/, '');

const fail = (message) => {
  throw new Error(message);
};

const requestJson = async (path) => {
  if (!API_URL) fail('Set VERIFY_API_URL to the deployed Snaply API URL before running verification.');
  const response = await fetch(`${API_URL}${path}`);
  const body = await response.json().catch(() => null);
  if (!response.ok) fail(`${path} returned HTTP ${response.status}: ${body?.message || 'request failed'}`);
  return body;
};

const verifyProductionDemo = async () => {
  const [health, stories, ethanMatches, sofiaMatches, reels] = await Promise.all([
    requestJson('/api/health'),
    requestJson('/api/stories'),
    requestJson('/api/search/users?q=ethan'),
    requestJson('/api/search/users?q=sofia'),
    requestJson('/api/reels'),
  ]);

  const storyRows = Array.isArray(stories) ? stories : [];
  const storyUsers = new Set(storyRows.map((story) => String(story?.label || '').toLowerCase()));
  const demoChat = new Map((health?.demoChat || []).map((entry) => [entry.username, entry]));
  const ethan = Array.isArray(ethanMatches) && ethanMatches.some((user) => user.username === 'ethan');
  const sofia = Array.isArray(sofiaMatches) && sofiaMatches.some((user) => user.username === 'sofia');
  const reelsWithVideo = (Array.isArray(reels) ? reels : []).filter((reel) => /^https?:\/\//i.test(String(reel?.videoUrl || '')));
  const reelsWithThumbnail = reelsWithVideo.filter((reel) => [reel.thumbnailUrl, reel.thumbnail, reel.posterUrl, reel.poster]
    .some((value) => typeof value === 'string' && value.trim() && !/\.(mp4|mov|m4v|webm)(?:[?#]|$)/i.test(value)));

  if (!storyUsers.has('your story') && !storyUsers.has('alicia')) fail('Current user Story entry was not returned.');
  if (!storyRows.some((story) => storyUsers.has(String(story?.label || '').toLowerCase()) && story?.stories?.length)) {
    fail('No grouped Story records were returned.');
  }
  if (!ethan || !sofia) fail('Ethan and Sofia were not found by the user search API.');
  if (!demoChat.has('ethan') || !demoChat.has('sofia')) fail('Health endpoint did not report both demo chat users.');
  if (!Array.isArray(reels) || reelsWithVideo.length !== reels.length) fail('One or more Reel records has no usable HTTPS video URL.');
  if (!reelsWithThumbnail.length) fail('No Reel with a usable persisted thumbnail was returned.');

  console.log('Production demo verification passed.');
  console.log(`Stories returned: ${storyRows.length}`);
  console.log(`Ethan present: ${ethan}; Sofia present: ${sofia}`);
  console.log(`Ethan online: ${demoChat.get('ethan').online}; Sofia online: ${demoChat.get('sofia').online}`);
  console.log(`Reels with usable video URLs: ${reelsWithVideo.length}`);
  console.log(`Reels with usable thumbnails: ${reelsWithThumbnail.length}`);
};

verifyProductionDemo().catch((error) => {
  console.error(`Production demo verification failed: ${error.message}`);
  process.exitCode = 1;
});
